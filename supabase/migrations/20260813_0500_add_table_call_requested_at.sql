-- =====================================================
-- ALERTA "LLAMAR" DE COCINA → MESEROS
-- Fecha: 2026-08-13
-- Objetivo: persistir la alerta de llamada de la cocina
-- en `tables.call_requested_at`. La app web/mobile de
-- los meseros se suscribe a realtime en `tables` y
-- muestra una campana animada en la mesa cuando la
-- cocina la activa. El mesero puede marcarla como vista
-- (la limpia a NULL).
-- Se exponen también los RPCs de mesas con la columna
-- para que la carga inicial la incluya.
-- =====================================================

BEGIN;

ALTER TABLE public.tables
  ADD COLUMN IF NOT EXISTS call_requested_at TIMESTAMPTZ;

COMMENT ON COLUMN public.tables.call_requested_at
IS 'Marca de tiempo de la alerta "Llamar" enviada por la cocina al mesero. NULL = sin alerta activa.';

-- 1) list_tables_with_order_summary (legacy) + call_requested_at
DROP FUNCTION IF EXISTS public.list_tables_with_order_summary(uuid);

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
  order_units integer,
  call_requested_at timestamptz
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
        t.current_order_id,
        t.call_requested_at
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
          'total', COALESCE(o.total, 0),
          'notes', COALESCE(o.notes, '')
        )
      END AS orders,
      COALESCE(ou.units, 0)::integer AS order_units,
      bt.call_requested_at
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
IS 'Lista mesas por negocio con resumen de orden actual (notes y call_requested_at incluidos).';

-- 2) list_tables_with_order_summary_fast (fast) + call_requested_at
DROP FUNCTION IF EXISTS public.list_tables_with_order_summary_fast(uuid);

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
  order_units integer,
  call_requested_at timestamptz
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
      t.current_order_id,
      t.call_requested_at
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
        'total', COALESCE(o.total, 0),
        'notes', COALESCE(o.notes, '')
      )
    END AS orders,
    COALESCE(ou.units, 0)::integer AS order_units,
    bt.call_requested_at
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
IS 'Version optimizada de list_tables_with_order_summary para mobile (notes y call_requested_at incluidos).';

REVOKE ALL ON FUNCTION public.list_tables_with_order_summary(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_tables_with_order_summary(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.list_tables_with_order_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_tables_with_order_summary(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.list_tables_with_order_summary_fast(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_tables_with_order_summary_fast(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.list_tables_with_order_summary_fast(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_tables_with_order_summary_fast(uuid) TO service_role;

ANALYZE public.tables;

COMMIT;
