-- =====================================================
-- App updates config table
-- Fecha: 2026-03-14
-- Objetivo: publicar versión mínima/última para apps móviles
-- =====================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.app_updates (
  platform text PRIMARY KEY,
  latest_version text NOT NULL,
  min_supported_version text,
  cta_url text,
  message text,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.app_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_updates_select_policy ON public.app_updates;
CREATE POLICY app_updates_select_policy ON public.app_updates
  FOR SELECT
  TO authenticated
  USING (true);

COMMIT;
