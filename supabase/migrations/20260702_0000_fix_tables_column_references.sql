BEGIN;

-- ============================================================
-- Fix 1: open_close_table_transaction
-- The `tables` table does NOT have `opened_at` or `closed_at` columns.
-- Those belong on the `orders` table. Remove the incorrect references.
-- ============================================================

CREATE OR REPLACE FUNCTION public.open_close_table_transaction(
  p_table_id uuid,
  p_action text,
  p_user_id uuid
)
RETURNS TABLE (
  id uuid,
  business_id uuid,
  current_order_id uuid,
  status text,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := timezone('utc', now());
  v_action text := lower(trim(coalesce(p_action, '')));
  v_auth_uid uuid := auth.uid();
  v_business_id uuid;
  v_current_order_id uuid;
  v_order_id uuid;
  v_is_authorized boolean := false;
BEGIN
  IF p_table_id IS NULL THEN
    RAISE EXCEPTION 'p_table_id es obligatorio';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id es obligatorio';
  END IF;

  IF v_action NOT IN ('open', 'close') THEN
    RAISE EXCEPTION 'Acción inválida: %', p_action;
  END IF;

  IF v_auth_uid IS NOT NULL AND v_auth_uid <> p_user_id THEN
    RAISE EXCEPTION 'Sesión inválida para ejecutar operación de mesa';
  END IF;

  PERFORM set_config('stocky.skip_table_sync_from_orders', '1', true);

  SELECT t.business_id, t.current_order_id
  INTO v_business_id, v_current_order_id
  FROM public.tables t
  WHERE t.id = p_table_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mesa % no encontrada', p_table_id;
  END IF;

  SELECT (
    EXISTS (
      SELECT 1
      FROM public.businesses b
      WHERE b.id = v_business_id
        AND b.created_by = p_user_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.business_id = v_business_id
        AND e.user_id = p_user_id
        AND e.is_active = true
    )
  )
  INTO v_is_authorized;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'No autorizado para operar mesas de este negocio';
  END IF;

  IF v_action = 'open' THEN
    IF v_current_order_id IS NOT NULL THEN
      SELECT o.id
      INTO v_order_id
      FROM public.orders o
      WHERE o.id = v_current_order_id
        AND o.business_id = v_business_id
        AND o.status = 'open'
      FOR UPDATE;
    END IF;

    IF v_order_id IS NULL THEN
      SELECT o.id
      INTO v_order_id
      FROM public.orders o
      WHERE o.business_id = v_business_id
        AND o.table_id = p_table_id
        AND o.status = 'open'
      ORDER BY o.id DESC
      LIMIT 1
      FOR UPDATE;
    END IF;

    IF v_order_id IS NULL THEN
      INSERT INTO public.orders (
        business_id,
        table_id,
        user_id,
        status,
        total,
        opened_at
      )
      VALUES (
        v_business_id,
        p_table_id,
        p_user_id,
        'open',
        0,
        v_now
      )
      RETURNING orders.id INTO v_order_id;
    ELSE
      UPDATE public.orders o
      SET status = 'open',
          table_id = p_table_id,
          closed_at = NULL,
          opened_at = COALESCE(o.opened_at, v_now),
          updated_at = v_now,
          user_id = COALESCE(o.user_id, p_user_id)
      WHERE o.id = v_order_id;
    END IF;

    UPDATE public.tables t
    SET current_order_id = v_order_id,
        status = 'occupied',
        updated_at = v_now
    WHERE t.id = p_table_id
      AND t.business_id = v_business_id;
  ELSE
    IF v_current_order_id IS NOT NULL THEN
      UPDATE public.orders o
      SET status = 'closed',
          closed_at = v_now,
          updated_at = v_now
      WHERE o.id = v_current_order_id
        AND o.business_id = v_business_id
        AND o.status = 'open';
    ELSE
      UPDATE public.orders o
      SET status = 'closed',
          closed_at = v_now,
          updated_at = v_now
      WHERE o.business_id = v_business_id
        AND o.table_id = p_table_id
        AND o.status = 'open';
    END IF;

    UPDATE public.tables t
    SET current_order_id = NULL,
        status = 'available',
        updated_at = v_now
    WHERE t.id = p_table_id
      AND t.business_id = v_business_id;
  END IF;

  RETURN QUERY
  SELECT
    t.id,
    t.business_id,
    t.current_order_id,
    t.status,
    t.updated_at
  FROM public.tables t
  WHERE t.id = p_table_id
    AND t.business_id = v_business_id;
END;
$$;

COMMENT ON FUNCTION public.open_close_table_transaction(uuid, text, uuid)
IS 'Version corregida: removed opened_at/closed_at from tables (those columns belong on orders).';

-- ============================================================
-- Fix 2: list_tables_with_order_summary
-- The `tables` table has `table_name`, not `name`.
-- ============================================================

CREATE OR REPLACE FUNCTION public.list_tables_with_order_summary(
  p_business_id uuid
)
RETURNS TABLE (
  id uuid,
  business_id uuid,
  table_number text,
  table_name text,
  status text,
  current_order_id uuid,
  orders jsonb,
  order_units integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_sql text;
BEGIN
  IF p_business_id IS NULL THEN
    RAISE EXCEPTION 'p_business_id es obligatorio';
  END IF;

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sesión inválida: auth.uid() es NULL';
  END IF;

  IF NOT public.can_access_business(p_business_id) THEN
    RAISE EXCEPTION 'No autorizado para acceder a mesas de este negocio';
  END IF;

  v_sql := $sql$
    WITH business_tables AS (
      SELECT
        t.id,
        t.business_id,
        CASE WHEN t.table_number IS NULL THEN NULL ELSE t.table_number::text END AS table_number,
        t.table_name,
        lower(COALESCE(t.status::text, 'available')) AS status,
        t.current_order_id
      FROM public.tables t
      WHERE t.business_id = $1
    ),
    order_units AS (
      SELECT
        oi.order_id,
        COALESCE(SUM(COALESCE(oi.quantity, 0)), 0)::integer AS units
      FROM public.order_items oi
      JOIN business_tables bt ON bt.current_order_id = oi.order_id
      GROUP BY oi.order_id
    )
    SELECT
      bt.id,
      bt.business_id,
      bt.table_number,
      bt.table_name,
      bt.status,
      bt.current_order_id,
      CASE
        WHEN o.id IS NULL THEN NULL
        ELSE jsonb_build_object(
          'id', o.id,
          'status', lower(COALESCE(o.status::text, 'open')),
          'total', COALESCE(o.total, 0)
        )
      END AS orders,
      COALESCE(ou.units, 0)::integer AS order_units
    FROM business_tables bt
    LEFT JOIN public.orders o
      ON o.id = bt.current_order_id
      AND o.business_id = bt.business_id
    LEFT JOIN order_units ou
      ON ou.order_id = bt.current_order_id
    ORDER BY
      CASE WHEN bt.table_number IS NULL THEN 1 ELSE 0 END,
      bt.table_number,
      bt.id::text
  $sql$;

  RETURN QUERY EXECUTE v_sql USING p_business_id;
END;
$$;

COMMENT ON FUNCTION public.list_tables_with_order_summary(uuid)
IS 'Lista mesas por negocio con resumen de orden actual. Corregido: usa table_name en lugar de name.';

-- ============================================================
-- Fix 3: list_tables_with_order_summary_fast (with units)
-- The `tables` table has `table_name`, not `name`.
-- ============================================================

CREATE OR REPLACE FUNCTION public.list_tables_with_order_summary_fast(
  p_business_id uuid
)
RETURNS TABLE (
  id uuid,
  business_id uuid,
  table_number text,
  table_name text,
  status text,
  current_order_id uuid,
  orders jsonb,
  order_units integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF p_business_id IS NULL THEN
    RAISE EXCEPTION 'p_business_id es obligatorio';
  END IF;

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sesion invalida: auth.uid() es NULL';
  END IF;

  IF NOT public.can_access_business(p_business_id) THEN
    RAISE EXCEPTION 'No autorizado para acceder a mesas de este negocio';
  END IF;

  RETURN QUERY
  WITH business_tables AS (
    SELECT
      t.id,
      t.business_id,
      CASE WHEN t.table_number IS NULL THEN NULL ELSE t.table_number::text END AS table_number,
      t.table_name,
      lower(COALESCE(t.status::text, 'available')) AS status,
      t.current_order_id
    FROM public.tables t
    WHERE t.business_id = p_business_id
  ),
  order_units AS (
    SELECT
      oi.order_id,
      COALESCE(SUM(COALESCE(oi.quantity, 0)), 0)::integer AS units
    FROM public.order_items oi
    JOIN business_tables bt ON bt.current_order_id = oi.order_id
    GROUP BY oi.order_id
  )
  SELECT
    bt.id,
    bt.business_id,
    bt.table_number,
    bt.table_name,
    bt.status,
    bt.current_order_id,
    CASE
      WHEN o.id IS NULL THEN NULL
      ELSE jsonb_build_object(
        'id', o.id,
        'status', lower(COALESCE(o.status::text, 'open')),
        'total', COALESCE(o.total, 0)
      )
    END AS orders,
    COALESCE(ou.units, 0)::integer AS order_units
  FROM business_tables bt
  LEFT JOIN public.orders o
    ON o.id = bt.current_order_id
    AND o.business_id = bt.business_id
  LEFT JOIN order_units ou
    ON ou.order_id = bt.current_order_id
  ORDER BY
    CASE WHEN bt.table_number IS NULL THEN 1 ELSE 0 END,
    bt.table_number,
    bt.id::text;
END;
$$;

COMMENT ON FUNCTION public.list_tables_with_order_summary_fast(uuid)
IS 'Version optimizada de list_tables_with_order_summary para mobile. Corregido: usa table_name.';

REVOKE ALL ON FUNCTION public.list_tables_with_order_summary_fast(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_tables_with_order_summary_fast(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.list_tables_with_order_summary_fast(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_tables_with_order_summary_fast(uuid) TO service_role;

ANALYZE public.tables;
ANALYZE public.orders;

COMMIT;
