-- ============================================================
-- Eliminar policy redundante tables_business_policy
-- Fecha: 2026-07-03
-- Motivo: Esta policy para rol 'public' usa jwt.claims->>'business'
-- que no existe en JWTs estándar de Supabase Auth.
-- Es redundante con tables_all/tables_select_policy (rol 'authenticated')
-- que usan get_user_business_ids() y funcionan correctamente.
-- Puede causar problemas de evaluación RLS en realtime.
-- ============================================================

DROP POLICY IF EXISTS tables_business_policy ON public.tables;
