BEGIN;

CREATE OR REPLACE FUNCTION public.list_inventory_products_fast(
  p_business_id uuid,
  p_active_only boolean DEFAULT false
)
RETURNS TABLE(
  id uuid,
  business_id uuid,
  code text,
  name text,
  category text,
  purchase_price numeric,
  sale_price numeric,
  stock numeric,
  min_stock numeric,
  unit text,
  supplier_id uuid,
  is_active boolean,
  manage_stock boolean,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
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
    RAISE EXCEPTION 'No autorizado para acceder a inventario de este negocio';
  END IF;

  RETURN QUERY
  SELECT
    pr.id,
    pr.business_id,
    pr.code::text,
    pr.name::text,
    pr.category::text,
    COALESCE(pr.purchase_price, 0)::numeric AS purchase_price,
    COALESCE(pr.sale_price, 0)::numeric AS sale_price,
    COALESCE(pr.stock, 0)::numeric AS stock,
    COALESCE(pr.min_stock, 0)::numeric AS min_stock,
    COALESCE(pr.unit::text, 'unit') AS unit,
    pr.supplier_id,
    COALESCE(pr.is_active, true) AS is_active,
    COALESCE(pr.manage_stock, true) AS manage_stock,
    pr.created_at
  FROM public.products pr
  WHERE pr.business_id = p_business_id
    AND (
      NOT COALESCE(p_active_only, false)
      OR COALESCE(pr.is_active, true)
    )
  ORDER BY pr.created_at DESC NULLS LAST, pr.id DESC;
END;
$$;

COMMENT ON FUNCTION public.list_inventory_products_fast(uuid, boolean)
IS 'Version optimizada de inventario para mobile first-paint (sin join a suppliers).';

REVOKE ALL ON FUNCTION public.list_inventory_products_fast(uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_inventory_products_fast(uuid, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.list_inventory_products_fast(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_inventory_products_fast(uuid, boolean) TO service_role;

ANALYZE public.products;

COMMIT;
