-- =====================================================
-- Fix search_path for SECURITY DEFINER functions
-- Fecha: 2026-03-16
-- Objetivo: evitar escalado via search_path en funciones security definer
-- =====================================================

BEGIN;

ALTER FUNCTION public.handle_table_transaction(uuid, text, uuid, text)
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.refresh_business_metrics()
  SET search_path = public, pg_catalog;

COMMIT;
