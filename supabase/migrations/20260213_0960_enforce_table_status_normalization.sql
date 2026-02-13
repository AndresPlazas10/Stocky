-- ============================================================
-- BLOCK 4 - Enforcement de estado de mesas
-- Fecha: 2026-02-13
-- Objetivo: mantener estándar available/occupied en escrituras nuevas.
-- ============================================================

CREATE OR REPLACE FUNCTION public.normalize_table_status_before_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_status text := lower(coalesce(NEW.status, ''));
BEGIN
  IF v_status = '' THEN
    NEW.status := 'available';
    RETURN NEW;
  END IF;

  IF v_status = 'open' THEN
    NEW.status := 'occupied';
    RETURN NEW;
  END IF;

  IF v_status = 'closed' THEN
    NEW.status := 'available';
    RETURN NEW;
  END IF;

  IF v_status IN ('available', 'occupied') THEN
    NEW.status := v_status;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Estado de mesa inválido: %', NEW.status;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_table_status_before_write ON public.tables;
CREATE TRIGGER trg_normalize_table_status_before_write
BEFORE INSERT OR UPDATE OF status
ON public.tables
FOR EACH ROW
EXECUTE FUNCTION public.normalize_table_status_before_write();

COMMENT ON FUNCTION public.normalize_table_status_before_write()
IS 'Normaliza estados legacy de mesas (open/closed) a occupied/available y rechaza valores inválidos.';
