-- ============================================================
-- HARDENING SEGURIDAD FASE 1 - Fix check_product_can_delete
-- Fecha: 2026-08-17
-- Objetivo: cerrar el oráculo cross-tenant. La versión anterior era
-- SECURITY DEFINER sin auth.uid() ni validación de negocio: cualquier
-- usuario autenticado podía sondear la existencia/uso de productos de
-- OTROS negocios conociendo su UUID (side-channel de información).
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.check_product_can_delete(p_product_id uuid)
RETURNS TABLE(
  has_sales boolean,
  has_purchases boolean,
  sales_count bigint,
  purchases_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_business_id uuid;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR p_product_id IS NULL THEN
    RAISE EXCEPTION 'Sesion invalida o producto no especificado';
  END IF;

  -- El producto debe pertenecer a un negocio al que el usuario tiene acceso.
  SELECT p.business_id
  INTO v_business_id
  FROM public.products p
  WHERE p.id = p_product_id
  LIMIT 1;

  IF v_business_id IS NULL THEN
    RAISE EXCEPTION 'Producto no encontrado';
  END IF;

  IF NOT public.can_access_business(v_business_id) THEN
    RAISE EXCEPTION 'No autorizado para consultar este producto';
  END IF;

  RETURN QUERY
  SELECT
    EXISTS(SELECT 1 FROM public.sale_details WHERE product_id = p_product_id),
    EXISTS(SELECT 1 FROM public.purchase_details WHERE product_id = p_product_id),
    (SELECT COUNT(*) FROM public.sale_details WHERE product_id = p_product_id),
    (SELECT COUNT(*) FROM public.purchase_details WHERE product_id = p_product_id);
END;
$$;

COMMENT ON FUNCTION public.check_product_can_delete(uuid)
IS 'Valida si un producto tiene ventas/compras que bloquean su delete. Restringido a negocios con acceso (can_access_business).';

REVOKE ALL ON FUNCTION public.check_product_can_delete(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_product_can_delete(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.check_product_can_delete(uuid) TO authenticated;

COMMIT;
