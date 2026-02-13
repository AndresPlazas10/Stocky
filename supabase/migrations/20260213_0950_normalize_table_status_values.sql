-- ============================================================
-- BLOCK 4 - Unificación de modelo de estado de mesas
-- Fecha: 2026-02-13
-- Objetivo: normalizar valores legacy (open/closed) a estándar app.
-- ============================================================

UPDATE public.tables
SET status = 'occupied'
WHERE lower(coalesce(status, '')) = 'open';

UPDATE public.tables
SET status = 'available'
WHERE lower(coalesce(status, '')) = 'closed';

COMMENT ON TABLE public.tables IS
  'Estados de mesa normalizados al estándar: available/occupied (legacy open/closed migrado).';
