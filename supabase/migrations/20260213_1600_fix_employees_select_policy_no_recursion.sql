-- =====================================================
-- Fix employees SELECT policy (sin recursión)
-- Fecha: 2026-02-13
-- Objetivo:
--   - Evitar dependencia circular entre employees RLS y
--     public.can_access_business(...)
-- =====================================================

BEGIN;

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employees_select_all ON public.employees;
DROP POLICY IF EXISTS employees_select_policy ON public.employees;

CREATE POLICY employees_select_policy ON public.employees
  FOR SELECT
  TO authenticated
  USING (
    employees.user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.businesses b
      WHERE b.id = employees.business_id
        AND b.created_by = (SELECT auth.uid())
    )
  );

COMMIT;
