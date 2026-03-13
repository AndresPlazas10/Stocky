BEGIN;

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
    NULL::integer AS order_units
  FROM business_tables bt
  LEFT JOIN public.orders o
    ON o.id = bt.current_order_id
    AND o.business_id = bt.business_id
  ORDER BY
    CASE WHEN bt.table_number IS NULL THEN 1 ELSE 0 END,
    bt.table_number,
    bt.id::text;
END;
$$;

COMMENT ON FUNCTION public.list_tables_with_order_summary_fast(uuid)
IS 'Version optimizada de mesas para first-paint mobile: difiere order_units a background.';

ANALYZE public.tables;
ANALYZE public.orders;

COMMIT;
