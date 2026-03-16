-- =====================================================
-- Security audit log indexes
-- Fecha: 2026-03-16
-- Objetivo: acelerar consultas de monitoreo y alertas
-- =====================================================

BEGIN;

CREATE INDEX IF NOT EXISTS security_audit_logs_action_idx
  ON public.security_audit_logs (action);

CREATE INDEX IF NOT EXISTS security_audit_logs_business_action_idx
  ON public.security_audit_logs (business_id, action, created_at DESC);

CREATE INDEX IF NOT EXISTS security_audit_logs_user_action_idx
  ON public.security_audit_logs (user_id, action, created_at DESC);

COMMIT;
