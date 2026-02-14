-- =====================================================
-- Fix visibilidad de compras (RLS + helper de acceso)
-- Fecha: 2026-02-13
-- Objetivo:
--   1) Evitar falsos negativos en can_access_business cuando employees.is_active es NULL
--   2) Normalizar políticas de purchases/suppliers con can_access_business
-- =====================================================

BEGIN;

-- 1) Helper de acceso: tratar NULL en is_active como activo por compatibilidad
CREATE OR REPLACE FUNCTION public.can_access_business(p_business_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR p_business_id IS NULL THEN
    RETURN false;
  END IF;

  -- Owner del negocio
  IF EXISTS (
    SELECT 1
    FROM public.businesses b
    WHERE b.id = p_business_id
      AND b.created_by = v_uid
  ) THEN
    RETURN true;
  END IF;

  -- Empleado del negocio: NULL se considera activo para no romper datos históricos
  IF EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.business_id = p_business_id
      AND e.user_id = v_uid
      AND COALESCE(e.is_active, true) = true
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.can_access_business(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_business(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_access_business(uuid) TO authenticated;

-- 2) Policies de purchases normalizadas (SELECT/INSERT/UPDATE/DELETE)
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS purchases_access_policy ON public.purchases;
DROP POLICY IF EXISTS purchases_select_policy ON public.purchases;
DROP POLICY IF EXISTS purchases_insert_policy ON public.purchases;
DROP POLICY IF EXISTS purchases_update_policy ON public.purchases;
DROP POLICY IF EXISTS purchases_delete_policy ON public.purchases;

CREATE POLICY purchases_access_policy ON public.purchases
  FOR ALL
  TO authenticated
  USING (
    public.can_access_business(purchases.business_id)
  )
  WITH CHECK (
    public.can_access_business(purchases.business_id)
  );

-- 3) Policies de suppliers normalizadas
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS suppliers_access_policy ON public.suppliers;
DROP POLICY IF EXISTS suppliers_select_policy ON public.suppliers;
DROP POLICY IF EXISTS suppliers_insert_policy ON public.suppliers;
DROP POLICY IF EXISTS suppliers_update_policy ON public.suppliers;
DROP POLICY IF EXISTS suppliers_delete_policy ON public.suppliers;

CREATE POLICY suppliers_access_policy ON public.suppliers
  FOR ALL
  TO authenticated
  USING (
    public.can_access_business(suppliers.business_id)
  )
  WITH CHECK (
    public.can_access_business(suppliers.business_id)
  );

-- 4) Policy SELECT de sales normalizada (lectura de ventas para empleados/owner)
-- Nota: se normaliza solo SELECT para no alterar reglas actuales de escritura/borrado.
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sales_access_policy ON public.sales;
DROP POLICY IF EXISTS sales_select_policy ON public.sales;

CREATE POLICY sales_select_policy ON public.sales
  FOR SELECT
  TO authenticated
  USING (
    public.can_access_business(sales.business_id)
  );

COMMIT;
