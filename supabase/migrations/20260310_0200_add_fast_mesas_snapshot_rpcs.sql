BEGIN;

CREATE INDEX IF NOT EXISTS idx_tables_business_current_order_id
  ON public.tables (business_id, current_order_id);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id_snapshot_cover
  ON public.order_items (order_id, id)
  INCLUDE (product_id, combo_id, quantity, price, subtotal);

CREATE OR REPLACE FUNCTION public.list_tables_with_order_summary_fast(
  p_business_id uuid
)
RETURNS TABLE (
  id uuid,
  business_id uuid,
  table_number text,
  name text,
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
      NULLIF(trim(to_jsonb(t)->>'name'), '')::text AS name,
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
    bt.name,
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
IS 'Version optimizada sin SQL dinamico de list_tables_with_order_summary para mobile.';

REVOKE ALL ON FUNCTION public.list_tables_with_order_summary_fast(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_tables_with_order_summary_fast(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.list_tables_with_order_summary_fast(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_tables_with_order_summary_fast(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.list_open_order_snapshot_fast(
  p_order_id uuid
)
RETURNS TABLE(
  order_id uuid,
  business_id uuid,
  total numeric,
  units integer,
  items jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_business_id uuid;
BEGIN
  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'p_order_id es obligatorio';
  END IF;

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sesion invalida: auth.uid() es NULL';
  END IF;

  SELECT o.business_id
  INTO v_business_id
  FROM public.orders o
  WHERE o.id = p_order_id
  LIMIT 1;

  IF v_business_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT public.can_access_business(v_business_id) THEN
    RAISE EXCEPTION 'No autorizado para acceder a esta orden';
  END IF;

  RETURN QUERY
  WITH selected_order AS (
    SELECT
      o.id,
      o.business_id,
      o.total AS stored_total
    FROM public.orders o
    WHERE o.id = p_order_id
    LIMIT 1
  ),
  order_items_base AS (
    SELECT
      oi.id,
      oi.order_id,
      oi.product_id,
      oi.combo_id,
      COALESCE(oi.quantity, 0)::numeric AS quantity,
      COALESCE(oi.price, 0)::numeric AS price,
      COALESCE(oi.subtotal, COALESCE(oi.quantity, 0) * COALESCE(oi.price, 0))::numeric AS subtotal
    FROM public.order_items oi
    WHERE oi.order_id = p_order_id
  )
  SELECT
    so.id AS order_id,
    so.business_id,
    COALESCE(SUM(oib.subtotal), so.stored_total, 0)::numeric AS total,
    COALESCE(SUM(oib.quantity), 0)::integer AS units,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', oib.id,
          'order_id', oib.order_id,
          'product_id', oib.product_id,
          'combo_id', oib.combo_id,
          'quantity', oib.quantity,
          'price', oib.price,
          'subtotal', oib.subtotal
        )
        ORDER BY oib.id
      ) FILTER (WHERE oib.id IS NOT NULL),
      '[]'::jsonb
    ) AS items
  FROM selected_order so
  LEFT JOIN order_items_base oib ON oib.order_id = so.id
  GROUP BY so.id, so.business_id, so.stored_total;
END;
$$;

COMMENT ON FUNCTION public.list_open_order_snapshot_fast(uuid)
IS 'Version optimizada de snapshot de orden abierta sin joins a catalogos para mobile first-paint.';

REVOKE ALL ON FUNCTION public.list_open_order_snapshot_fast(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_open_order_snapshot_fast(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.list_open_order_snapshot_fast(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_open_order_snapshot_fast(uuid) TO service_role;

ANALYZE public.tables;
ANALYZE public.order_items;

COMMIT;
