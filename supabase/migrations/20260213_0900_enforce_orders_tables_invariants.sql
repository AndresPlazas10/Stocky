-- ============================================================
-- BLOCK 3 - Invariantes de datos (orders <-> tables)
-- Fecha: 2026-02-13
-- Objetivo: prevenir estados inválidos sin romper datos históricos.
-- ============================================================

-- Índices de apoyo para validaciones y consultas frecuentes.
CREATE INDEX IF NOT EXISTS idx_orders_open_table
  ON public.orders(table_id, business_id)
  WHERE table_id IS NOT NULL AND lower(coalesce(status, '')) = 'open';

CREATE INDEX IF NOT EXISTS idx_tables_current_order
  ON public.tables(current_order_id)
  WHERE current_order_id IS NOT NULL;

-- -----------------------------------------------------------------
-- Trigger 1: invariantes al abrir/actualizar órdenes
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_order_open_invariants()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_table_business uuid;
BEGIN
  -- Solo aplica cuando la orden queda abierta y ligada a mesa.
  IF NEW.table_id IS NULL OR lower(coalesce(NEW.status, '')) <> 'open' THEN
    RETURN NEW;
  END IF;

  -- Serializa por mesa para evitar carreras de doble orden abierta.
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.table_id::text, 0));

  SELECT t.business_id
  INTO v_table_business
  FROM public.tables t
  WHERE t.id = NEW.table_id;

  IF v_table_business IS NULL THEN
    RAISE EXCEPTION 'La mesa % no existe', NEW.table_id;
  END IF;

  IF NEW.business_id IS DISTINCT FROM v_table_business THEN
    RAISE EXCEPTION 'Inconsistencia: order.business_id (%) != table.business_id (%)', NEW.business_id, v_table_business;
  END IF;

  -- No permitir más de una orden abierta por mesa.
  IF EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.table_id = NEW.table_id
      AND lower(coalesce(o.status, '')) = 'open'
      AND o.id <> NEW.id
  ) THEN
    RAISE EXCEPTION 'Ya existe una orden abierta para la mesa %', NEW.table_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_order_open_invariants ON public.orders;
CREATE TRIGGER trg_enforce_order_open_invariants
BEFORE INSERT OR UPDATE OF table_id, status, business_id
ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.enforce_order_open_invariants();

-- -----------------------------------------------------------------
-- Trigger 2: invariantes al asignar current_order_id en mesas
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_table_current_order_invariants()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_order_business uuid;
  v_order_status text;
  v_order_table_id uuid;
BEGIN
  -- Si no hay orden actual, no validar relación cruzada.
  IF NEW.current_order_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Serializa por orden para evitar que dos mesas apunten a la misma orden.
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.current_order_id::text, 0));

  SELECT o.business_id, o.status, o.table_id
  INTO v_order_business, v_order_status, v_order_table_id
  FROM public.orders o
  WHERE o.id = NEW.current_order_id;

  IF v_order_business IS NULL THEN
    RAISE EXCEPTION 'La orden % no existe', NEW.current_order_id;
  END IF;

  IF NEW.business_id IS DISTINCT FROM v_order_business THEN
    RAISE EXCEPTION 'Inconsistencia: table.business_id (%) != order.business_id (%)', NEW.business_id, v_order_business;
  END IF;

  IF lower(coalesce(v_order_status, '')) <> 'open' THEN
    RAISE EXCEPTION 'No se puede asignar una orden no abierta (%) a una mesa', v_order_status;
  END IF;

  IF v_order_table_id IS NOT NULL AND v_order_table_id <> NEW.id THEN
    RAISE EXCEPTION 'La orden % ya está ligada a otra mesa (%)', NEW.current_order_id, v_order_table_id;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.tables t
    WHERE t.current_order_id = NEW.current_order_id
      AND t.id <> NEW.id
  ) THEN
    RAISE EXCEPTION 'La orden % ya está asignada a otra mesa', NEW.current_order_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_table_current_order_invariants ON public.tables;
CREATE TRIGGER trg_enforce_table_current_order_invariants
BEFORE INSERT OR UPDATE OF current_order_id, business_id
ON public.tables
FOR EACH ROW
EXECUTE FUNCTION public.enforce_table_current_order_invariants();

COMMENT ON FUNCTION public.enforce_order_open_invariants()
IS 'Garantiza una sola orden abierta por mesa y coherencia de business_id en orders abiertas.';

COMMENT ON FUNCTION public.enforce_table_current_order_invariants()
IS 'Garantiza coherencia entre tables.current_order_id y orders (mismo negocio, orden abierta y no duplicada).';
