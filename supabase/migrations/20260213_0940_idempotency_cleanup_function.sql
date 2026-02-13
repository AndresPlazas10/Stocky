-- ============================================================
-- BLOCK 3 - Limpieza de idempotencia expirada
-- Fecha: 2026-02-13
-- Objetivo: evitar crecimiento indefinido de idempotency_requests.
-- ============================================================

CREATE OR REPLACE FUNCTION public.cleanup_expired_idempotency_requests()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_count integer := 0;
BEGIN
  DELETE FROM public.idempotency_requests
  WHERE expires_at IS NOT NULL
    AND expires_at < now();

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_expired_idempotency_requests() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_expired_idempotency_requests() FROM anon;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_idempotency_requests() TO authenticated;

COMMENT ON FUNCTION public.cleanup_expired_idempotency_requests()
IS 'Elimina registros idempotentes expirados y retorna cantidad borrada.';
