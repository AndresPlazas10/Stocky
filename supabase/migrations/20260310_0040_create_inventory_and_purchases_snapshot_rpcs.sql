BEGIN;

CREATE OR REPLACE FUNCTION public.list_recent_purchases_with_supplier(
  p_business_id uuid,
  p_limit integer DEFAULT 40
)
RETURNS TABLE(
  id uuid,
  business_id uuid,
  user_id uuid,
  supplier_id uuid,
  payment_method text,
  notes text,
  total numeric,
  created_at timestamptz,
  supplier jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 40), 1), 200);
BEGIN
  IF p_business_id IS NULL THEN
    RAISE EXCEPTION 'p_business_id es obligatorio';
  END IF;

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sesion invalida: auth.uid() es NULL';
  END IF;

  IF NOT public.can_access_business(p_business_id) THEN
    RAISE EXCEPTION 'No autorizado para acceder a compras de este negocio';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.business_id,
    p.user_id,
    p.supplier_id,
    lower(COALESCE(p.payment_method::text, 'cash')) AS payment_method,
    p.notes::text,
    COALESCE(p.total, 0)::numeric AS total,
    p.created_at,
    CASE
      WHEN s.id IS NULL THEN NULL
      ELSE jsonb_build_object(
        'id', s.id,
        'business_name', s.business_name,
        'contact_name', s.contact_name
      )
    END AS supplier
  FROM public.purchases p
  LEFT JOIN public.suppliers s
    ON s.id = p.supplier_id
    AND s.business_id = p.business_id
  WHERE p.business_id = p_business_id
  ORDER BY p.created_at DESC NULLS LAST, p.id DESC
  LIMIT v_limit;
END;
$$;

COMMENT ON FUNCTION public.list_recent_purchases_with_supplier(uuid, integer)
IS 'Devuelve compras recientes por negocio con proveedor embebido para mobile first-paint.';

REVOKE ALL ON FUNCTION public.list_recent_purchases_with_supplier(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_recent_purchases_with_supplier(uuid, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.list_recent_purchases_with_supplier(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_recent_purchases_with_supplier(uuid, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.list_inventory_products_with_supplier(
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
  created_at timestamptz,
  supplier jsonb
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
    pr.created_at,
    CASE
      WHEN s.id IS NULL THEN NULL
      ELSE jsonb_build_object(
        'id', s.id,
        'business_name', s.business_name,
        'contact_name', s.contact_name
      )
    END AS supplier
  FROM public.products pr
  LEFT JOIN public.suppliers s
    ON s.id = pr.supplier_id
    AND s.business_id = pr.business_id
  WHERE pr.business_id = p_business_id
    AND (
      NOT COALESCE(p_active_only, false)
      OR COALESCE(pr.is_active, true)
    )
  ORDER BY pr.created_at DESC NULLS LAST, pr.id DESC;
END;
$$;

COMMENT ON FUNCTION public.list_inventory_products_with_supplier(uuid, boolean)
IS 'Devuelve inventario por negocio con proveedor embebido en una sola consulta para mobile.';

REVOKE ALL ON FUNCTION public.list_inventory_products_with_supplier(uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_inventory_products_with_supplier(uuid, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.list_inventory_products_with_supplier(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_inventory_products_with_supplier(uuid, boolean) TO service_role;

COMMIT;
