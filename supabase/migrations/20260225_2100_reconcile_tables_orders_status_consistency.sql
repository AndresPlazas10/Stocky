-- ============================================================
-- Reconciliacion estricta entre tables.status y current_order_id
-- Fecha: 2026-02-25
-- Objetivo: eliminar inconsistencias de estado de mesas.
-- ============================================================

-- Si una mesa tiene current_order_id => occupied.
-- Si no tiene current_order_id => available.
CREATE OR REPLACE FUNCTION public.reconcile_table_status_with_current_order()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.current_order_id IS NULL THEN
    NEW.status := 'available';
  ELSE
    NEW.status := 'occupied';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reconcile_table_status_with_current_order ON public.tables;
CREATE TRIGGER trg_reconcile_table_status_with_current_order
BEFORE INSERT OR UPDATE OF status, current_order_id
ON public.tables
FOR EACH ROW
EXECUTE FUNCTION public.reconcile_table_status_with_current_order();

COMMENT ON FUNCTION public.reconcile_table_status_with_current_order()
IS 'Fuerza consistencia: mesa con orden actual siempre occupied; sin orden actual siempre available.';

-- Sincroniza automáticamente la mesa cuando cambia el estado de una orden.
CREATE OR REPLACE FUNCTION public.sync_table_state_from_order_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- UPDATE: si la orden deja de estar abierta, liberar mesa previa.
  IF TG_OP = 'UPDATE' THEN
    IF OLD.table_id IS NOT NULL
       AND lower(coalesce(OLD.status, '')) = 'open'
       AND (
         NEW.table_id IS DISTINCT FROM OLD.table_id
         OR lower(coalesce(NEW.status, '')) <> 'open'
       ) THEN
      UPDATE public.tables
      SET current_order_id = NULL,
          status = 'available',
          updated_at = timezone('utc', now())
      WHERE id = OLD.table_id
        AND business_id = OLD.business_id
        AND current_order_id = OLD.id;
    END IF;
  END IF;

  -- INSERT/UPDATE: orden abierta y ligada a mesa => ocupar mesa.
  IF NEW.table_id IS NOT NULL
     AND lower(coalesce(NEW.status, '')) = 'open' THEN
    UPDATE public.tables
    SET current_order_id = NEW.id,
        status = 'occupied',
        updated_at = timezone('utc', now())
    WHERE id = NEW.table_id
      AND business_id = NEW.business_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_table_state_from_order_insert ON public.orders;
CREATE TRIGGER trg_sync_table_state_from_order_insert
AFTER INSERT
ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.sync_table_state_from_order_status();

DROP TRIGGER IF EXISTS trg_sync_table_state_from_order_update ON public.orders;
CREATE TRIGGER trg_sync_table_state_from_order_update
AFTER UPDATE OF status, table_id, business_id
ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.sync_table_state_from_order_status();

COMMENT ON FUNCTION public.sync_table_state_from_order_status()
IS 'Mantiene sincronizados tables.current_order_id/status cuando una orden se abre, cambia de mesa o se cierra.';

-- Saneamiento inicial de datos existentes:
-- 1) Quitar referencias a órdenes no abiertas o de otro negocio.
UPDATE public.tables t
SET current_order_id = NULL
WHERE t.current_order_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = t.current_order_id
      AND o.business_id = t.business_id
      AND lower(coalesce(o.status, '')) = 'open'
  );

-- 2) Reconciliar status final según current_order_id.
UPDATE public.tables
SET status = CASE
  WHEN current_order_id IS NULL THEN 'available'
  ELSE 'occupied'
END;
