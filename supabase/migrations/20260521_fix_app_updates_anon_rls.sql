-- ============================================================
-- Permitir consulta anónima de app_updates (no es info sensible)
-- ============================================================
DROP POLICY IF EXISTS app_updates_select_policy_anon ON public.app_updates;
CREATE POLICY app_updates_select_policy_anon ON public.app_updates
  FOR SELECT
  TO anon
  USING (true);
