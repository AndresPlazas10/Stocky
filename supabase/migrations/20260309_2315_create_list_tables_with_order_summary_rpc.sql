-- ============================================================
-- RPC de listado de mesas con resumen de orden actual
-- Fecha: 2026-03-09
-- Objetivo: reducir roundtrips en mobile al traer en una sola
-- llamada mesa + orden actual + total de unidades.
-- ============================================================

CREATE OR REPLACE FUNCTION public.list_tables_with_order_summary(
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
  v_has_name boolean := false;
  v_name_expr text;
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

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tables'
      AND column_name = 'name'
  ) INTO v_has_name;

  v_name_expr := CASE
    WHEN v_has_name THEN 't.name::text'
    ELSE 'NULL::text'
  END;

  v_sql := format($sql$
    WITH order_units AS (
      SELECT
        oi.order_id,
        COALESCE(SUM(COALESCE(oi.quantity, 0)), 0)::integer AS units
      FROM public.order_items oi
      GROUP BY oi.order_id
    )
    SELECT
      t.id,
      t.business_id,
      CASE WHEN t.table_number IS NULL THEN NULL ELSE t.table_number::text END AS table_number,
      %s AS name,
      lower(COALESCE(t.status::text, 'available')) AS status,
      t.current_order_id,
      CASE
        WHEN o.id IS NULL THEN NULL
        ELSE jsonb_build_object(
          'id', o.id,
          'status', lower(COALESCE(o.status::text, 'open')),
          'total', COALESCE(o.total, 0)
        )
      END AS orders,
      COALESCE(ou.units, 0)::integer AS order_units
    FROM public.tables t
    LEFT JOIN public.orders o
      ON o.id = t.current_order_id
      AND o.business_id = t.business_id
    LEFT JOIN order_units ou
      ON ou.order_id = t.current_order_id
    WHERE t.business_id = $1
    ORDER BY
      CASE WHEN t.table_number IS NULL THEN 1 ELSE 0 END,
      t.table_number::text,
      t.id::text
  $sql$, v_name_expr);

  RETURN QUERY EXECUTE v_sql USING p_business_id;
END;
$$;

COMMENT ON FUNCTION public.list_tables_with_order_summary(uuid)
IS 'Lista mesas por negocio con orden actual y total de unidades en una sola consulta.';

REVOKE ALL ON FUNCTION public.list_tables_with_order_summary(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_tables_with_order_summary(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.list_tables_with_order_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_tables_with_order_summary(uuid) TO service_role;
