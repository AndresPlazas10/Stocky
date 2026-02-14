-- =====================================================
-- Fix visibilidad de ventas (RLS + can_access_business)
-- Fecha: 2026-02-13
-- Objetivo:
--   - Permitir lectura de ventas para owner/empleados
--     usando can_access_business, incluyendo empleados
--     históricos con is_active = NULL.
-- =====================================================

BEGIN;

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
