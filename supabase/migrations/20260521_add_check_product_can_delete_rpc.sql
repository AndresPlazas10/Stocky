-- ============================================================
-- RPC: check_product_can_delete
-- Retorna si un producto tiene ventas/compras que bloquean delete
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_product_can_delete(p_product_id uuid)
RETURNS TABLE(
  has_sales boolean,
  has_purchases boolean,
  sales_count bigint,
  purchases_count bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    EXISTS(SELECT 1 FROM public.sale_details WHERE product_id = p_product_id),
    EXISTS(SELECT 1 FROM public.purchase_details WHERE product_id = p_product_id),
    (SELECT COUNT(*) FROM public.sale_details WHERE product_id = p_product_id),
    (SELECT COUNT(*) FROM public.purchase_details WHERE product_id = p_product_id);
$$;

REVOKE ALL ON FUNCTION public.check_product_can_delete(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_product_can_delete(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.check_product_can_delete(uuid) TO authenticated;
