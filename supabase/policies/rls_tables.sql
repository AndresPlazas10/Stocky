-- Ejemplo de políticas RLS para `tables` y `audit_logs` en Supabase
-- Ajusta nombres de columnas/roles según tu esquema real.

-- Habilitar RLS
ALTER TABLE IF EXISTS public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Política para `tables`: permitir SELECT/UPDATE sólo si tenant_id coincide con el claim JWT
-- Supabase expone los claims JWT con current_setting('jwt.claims', true)
-- Se asume que el claim contiene {"tenant": "<uuid>"}
CREATE POLICY IF NOT EXISTS tables_tenant_policy ON public.tables
  USING (
    tenant_id = (current_setting('jwt.claims', true)::json->>'tenant')::uuid
  )
  WITH CHECK (
    tenant_id = (current_setting('jwt.claims', true)::json->>'tenant')::uuid
  );

-- Política para `audit_logs`: permitir SELECT sólo a usuarios del mismo tenant
CREATE POLICY IF NOT EXISTS audit_logs_tenant_policy ON public.audit_logs
  USING (
    tenant_id = (current_setting('jwt.claims', true)::json->>'tenant')::uuid
  );

-- Nota: la función `handle_table_transaction` está marcada SECURITY DEFINER y
-- ejecutada por el owner (p. ej. role de servicio). Si el owner tiene permisos
-- suficientes, la función podrá realizar UPDATE/INSERT incluso cuando RLS esté activa.
-- Asegúrate de que la función valida los claims/tenant (como hace la versión tenant-aware).
