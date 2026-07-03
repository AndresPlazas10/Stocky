-- Ejemplo de políticas RLS para `tables` y `audit_logs` en Supabase
-- Ajusta nombres de columnas/roles según tu esquema real.

-- Habilitar RLS
ALTER TABLE IF EXISTS public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_log ENABLE ROW LEVEL SECURITY;

-- [ELIMINADA 2026-07-03] tables_business_policy
-- Esta policy para rol 'public' usaba jwt.claims->>'business' que NO existe
-- en JWTs estándar de Supabase Auth. Causaba problemas de evaluación RLS
-- en realtime, haciendo que mesas desaparecieran de la UI.
-- Es redundante con las policies de rol 'authenticated' que usan get_user_business_ids().
-- NO recrear esta policy.
-- Ver migración: 20260703_0100_drop_redundant_tables_business_policy.sql

-- Política para `audit_log`: permitir SELECT sólo a usuarios del mismo business
DROP POLICY IF EXISTS audit_log_business_policy ON public.audit_log CASCADE;
CREATE POLICY audit_log_business_policy ON public.audit_log
  USING (
    business_id = (current_setting('jwt.claims', true)::json->>'business')::uuid
  );

-- Nota: la función `handle_table_transaction` está marcada SECURITY DEFINER y
-- ejecutada por el owner (p. ej. role de servicio). Si el owner tiene permisos
-- suficientes, la función podrá realizar UPDATE/INSERT incluso cuando RLS esté activa.
-- Asegúrate de que la función valida los claims/business (como hace la versión business-aware).
-- Asegúrate de que la función valida los claims/tenant (como hace la versión tenant-aware).
