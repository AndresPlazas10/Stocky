-- Politicas RLS para `tables` y `audit_log`
-- Ultima actualizacion: 2026-07-13

ALTER TABLE IF EXISTS public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_log ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Politicas para `tables` (rol authenticated)
-- Usan can_access_business() para verificar autorizacion.
-- ============================================================

DROP POLICY IF EXISTS tables_select_policy ON public.tables;
CREATE POLICY tables_select_policy ON public.tables
  FOR SELECT TO authenticated
  USING (public.can_access_business(business_id));

DROP POLICY IF EXISTS tables_insert_policy ON public.tables;
CREATE POLICY tables_insert_policy ON public.tables
  FOR INSERT TO authenticated
  WITH CHECK (public.can_access_business(business_id));

DROP POLICY IF EXISTS tables_update_policy ON public.tables;
CREATE POLICY tables_update_policy ON public.tables
  FOR UPDATE TO authenticated
  USING (public.can_access_business(business_id))
  WITH CHECK (public.can_access_business(business_id));

DROP POLICY IF EXISTS tables_delete_policy ON public.tables;
CREATE POLICY tables_delete_policy ON public.tables
  FOR DELETE TO authenticated
  USING (public.can_access_business(business_id));

-- ============================================================
-- Politicas para `audit_log` (rol authenticated)
-- ============================================================

DROP POLICY IF EXISTS audit_log_business_policy ON public.audit_log CASCADE;
DROP POLICY IF EXISTS audit_log_select_policy ON public.audit_log;
CREATE POLICY audit_log_select_policy ON public.audit_log
  FOR SELECT TO authenticated
  USING (public.can_access_business(business_id));

DROP POLICY IF EXISTS audit_log_insert_policy ON public.audit_log;
CREATE POLICY audit_log_insert_policy ON public.audit_log
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.can_access_business(business_id)
  );
