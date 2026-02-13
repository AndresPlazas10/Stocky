-- ============================================================
-- HARDENING P0 - Step 5
-- Fecha: 2026-02-13
-- Objetivo: asegurar RPCs usadas por frontend para control de acceso
-- y alertas de stock bajo.
-- ============================================================

-- -----------------------------------------------------------------
-- check_business_access(p_business_id, p_user_id)
-- -----------------------------------------------------------------
-- Mantiene firma actual para compatibilidad, pero NO confía en p_user_id.
CREATE OR REPLACE FUNCTION public.check_business_access(
  p_business_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_uid uuid := auth.uid();
BEGIN
  IF p_business_id IS NULL OR p_user_id IS NULL THEN
    RETURN false;
  END IF;

  IF v_auth_uid IS NULL THEN
    RETURN false;
  END IF;

  -- Evita suplantación por parámetro cliente.
  IF p_user_id <> v_auth_uid THEN
    RETURN false;
  END IF;

  RETURN public.can_access_business(p_business_id);
END;
$$;

REVOKE ALL ON FUNCTION public.check_business_access(uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_business_access(uuid,uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.check_business_access(uuid,uuid) TO authenticated;

COMMENT ON FUNCTION public.check_business_access(uuid,uuid)
IS 'Verifica acceso al negocio usando auth.uid(); p_user_id debe coincidir con el caller autenticado.';

-- -----------------------------------------------------------------
-- get_low_stock_products(p_business_id, p_threshold)
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_low_stock_products(
  p_business_id uuid,
  p_threshold integer DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  name text,
  code text,
  current_stock integer,
  price numeric,
  category text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_business_id IS NULL THEN
    RAISE EXCEPTION 'p_business_id es obligatorio';
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sesión inválida: auth.uid() es NULL';
  END IF;

  IF NOT public.can_access_business(p_business_id) THEN
    RAISE EXCEPTION 'No autorizado para consultar productos de este negocio';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.code,
    p.stock::integer AS current_stock,
    COALESCE(p.sale_price, p.purchase_price, 0)::numeric AS price,
    p.category
  FROM public.products p
  WHERE p.business_id = p_business_id
    AND p.is_active = true
    AND p.stock <= GREATEST(COALESCE(p_threshold, 10), 0)
  ORDER BY p.stock ASC, p.name ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_low_stock_products(uuid,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_low_stock_products(uuid,integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_low_stock_products(uuid,integer) TO authenticated;

COMMENT ON FUNCTION public.get_low_stock_products(uuid,integer)
IS 'Retorna productos con stock bajo, validando acceso del caller al negocio.';
