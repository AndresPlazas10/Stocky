-- ============================================================
-- BLOCK 3 - Infraestructura de idempotencia
-- Fecha: 2026-02-13
-- Objetivo: garantizar tabla base para deduplicar operaciones críticas.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.idempotency_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key varchar(255) NOT NULL UNIQUE,
  action_name varchar(100) NOT NULL,
  user_id uuid,
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE,
  request_payload jsonb,
  response_payload jsonb,
  status varchar(20) NOT NULL CHECK (status IN ('processing', 'completed', 'failed')),
  error_message text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  expires_at timestamptz DEFAULT (now() + interval '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_idempotency_requests_expires_at
  ON public.idempotency_requests(expires_at);

CREATE INDEX IF NOT EXISTS idx_idempotency_requests_business_action
  ON public.idempotency_requests(business_id, action_name, created_at DESC);

COMMENT ON TABLE public.idempotency_requests
IS 'Registro de solicitudes idempotentes para evitar duplicados por reintentos/doble click.';
