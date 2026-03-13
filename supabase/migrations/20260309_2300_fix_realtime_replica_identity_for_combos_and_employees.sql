-- =====================================================
-- FIX REALTIME PAYLOAD FOR FILTERED CHANNELS
-- Fecha: 2026-03-09
-- Objetivo:
--  1) Asegurar payload completo en UPDATE/DELETE para combos y employees
--  2) Evitar perdida de eventos en canales filtrados por business_id
-- =====================================================

ALTER TABLE IF EXISTS public.combos REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.employees REPLICA IDENTITY FULL;

-- =====================================================
-- Fin
-- =====================================================
