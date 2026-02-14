-- =====================================================
-- Normalizar acceso RLS de sales
-- Fecha: 2026-02-13
-- Objetivo:
--   - Evitar bloqueos por policies legacy en sales.
--   - Unificar SELECT/INSERT/UPDATE/DELETE con can_access_business.
-- =====================================================

BEGIN;

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sales_access_policy ON public.sales;
DROP POLICY IF EXISTS sales_select_policy ON public.sales;
DROP POLICY IF EXISTS sales_insert_policy ON public.sales;
DROP POLICY IF EXISTS sales_update_policy ON public.sales;
DROP POLICY IF EXISTS sales_delete_policy ON public.sales;

CREATE POLICY sales_access_policy ON public.sales
  FOR ALL
  TO authenticated
  USING (
    public.can_access_business(sales.business_id)
  )
  WITH CHECK (
    public.can_access_business(sales.business_id)
  );

COMMIT;
