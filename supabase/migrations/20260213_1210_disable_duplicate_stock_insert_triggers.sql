-- ============================================================
-- Evitar doble descuento/aumento de stock por triggers legacy
-- Fecha: 2026-02-13
-- Problema:
--   - El flujo actual (RPC/servicios) ya actualiza stock.
--   - Triggers legacy en INSERT de detalles vuelven a ajustar stock.
--   - Resultado: descuentos/aumentos duplicados.
--
-- Esta migración desactiva SOLO triggers de INSERT que duplican lógica:
--   1) trigger_reduce_stock_on_sale (sale_details AFTER INSERT)
--   2) trigger_increase_stock_on_purchase (purchase_details AFTER INSERT)
--
-- NO toca triggers de DELETE (rollback), para no romper restauraciones.
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'sale_details'
      AND t.tgname = 'trigger_reduce_stock_on_sale'
      AND NOT t.tgisinternal
  ) THEN
    EXECUTE 'DROP TRIGGER trigger_reduce_stock_on_sale ON public.sale_details';
    RAISE NOTICE '✅ Trigger eliminado: public.sale_details.trigger_reduce_stock_on_sale';
  ELSE
    RAISE NOTICE 'ℹ️ Trigger no existe: public.sale_details.trigger_reduce_stock_on_sale';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'purchase_details'
      AND t.tgname = 'trigger_increase_stock_on_purchase'
      AND NOT t.tgisinternal
  ) THEN
    EXECUTE 'DROP TRIGGER trigger_increase_stock_on_purchase ON public.purchase_details';
    RAISE NOTICE '✅ Trigger eliminado: public.purchase_details.trigger_increase_stock_on_purchase';
  ELSE
    RAISE NOTICE 'ℹ️ Trigger no existe: public.purchase_details.trigger_increase_stock_on_purchase';
  END IF;
END $$;

-- Verificación rápida
SELECT
  c.relname AS table_name,
  t.tgname AS trigger_name,
  pg_get_triggerdef(t.oid) AS trigger_def
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('sale_details', 'purchase_details')
  AND NOT t.tgisinternal
ORDER BY c.relname, t.tgname;
