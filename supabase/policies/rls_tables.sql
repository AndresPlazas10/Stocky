-- Ejemplo de políticas RLS para `tables` y `audit_logs` en Supabase
-- Ajusta nombres de columnas/roles según tu esquema real.

-- Habilitar RLS
ALTER TABLE IF EXISTS public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_log ENABLE ROW LEVEL SECURITY;

-- Política para `tables`: permitir SELECT/UPDATE sólo si business_id coincide con el claim JWT
-- Supabase expone los claims JWT con current_setting('jwt.claims', true)
-- Se asume que el claim contiene {"business": "<uuid>"}
DROP POLICY IF EXISTS tables_business_policy ON public.tables CASCADE;
CREATE POLICY tables_business_policy ON public.tables
  USING (
    business_id = (current_setting('jwt.claims', true)::json->>'business')::uuid
  )
  WITH CHECK (
    business_id = (current_setting('jwt.claims', true)::json->>'business')::uuid
  );

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
