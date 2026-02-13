-- ============================================================
-- VALIDACIÓN POST-DEPLOY: VENTAS CON STOCK NEGATIVO
-- Fecha: 2026-02-13
-- Uso: Ejecutar en Supabase SQL Editor después de aplicar migraciones.
-- Objetivo:
--   1) Confirmar que create_sale_complete ya NO contiene bloqueo
--      por "Stock insuficiente".
--   2) Confirmar que sigue descontando stock (stock = stock - qty).
-- ============================================================

-- 1) Verificar definición de función
WITH fn AS (
  SELECT pg_get_functiondef(p.oid) AS def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'create_sale_complete'
    AND pg_get_function_identity_arguments(p.oid) = 'p_business_id uuid, p_user_id uuid, p_seller_name text, p_payment_method text, p_items jsonb, p_order_id uuid DEFAULT NULL::uuid, p_table_id uuid DEFAULT NULL::uuid'
)
SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM fn)
    THEN 'OK'
    ELSE 'MISSING'
  END AS function_exists,
  CASE
    WHEN EXISTS (SELECT 1 FROM fn WHERE def ILIKE '%Stock insuficiente%')
    THEN 'FAIL'
    ELSE 'OK'
  END AS no_stock_block_validation,
  CASE
    WHEN EXISTS (SELECT 1 FROM fn WHERE def ILIKE '%SET stock = stock - v_quantity%')
    THEN 'OK'
    ELSE 'FAIL'
  END AS stock_update_still_present;

-- 2) Resultado resumido legible
DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'create_sale_complete'
    AND pg_get_function_identity_arguments(p.oid) = 'p_business_id uuid, p_user_id uuid, p_seller_name text, p_payment_method text, p_items jsonb, p_order_id uuid DEFAULT NULL::uuid, p_table_id uuid DEFAULT NULL::uuid';

  IF v_def IS NULL THEN
    RAISE NOTICE '❌ FAIL: No existe la función public.create_sale_complete esperada.';
    RETURN;
  END IF;

  IF v_def ILIKE '%Stock insuficiente%' THEN
    RAISE NOTICE '❌ FAIL: La función aún contiene validación de stock insuficiente.';
  ELSE
    RAISE NOTICE '✅ OK: No hay bloqueo por stock insuficiente en create_sale_complete.';
  END IF;

  IF v_def ILIKE '%SET stock = stock - v_quantity%' THEN
    RAISE NOTICE '✅ OK: La función sigue descontando stock por venta.';
  ELSE
    RAISE NOTICE '❌ FAIL: No se encontró descuento de stock en la función.';
  END IF;
END $$;

-- 3) Validación funcional recomendada (manual desde la app)
--    a) Deja un producto con stock 0.
--    b) Crea venta con cantidad 1 desde el módulo Ventas.
--    c) Verifica en products que stock quedó en -1.
--
-- Consulta útil:
-- SELECT id, name, stock
-- FROM public.products
-- WHERE business_id = '<BUSINESS_ID>'
-- ORDER BY updated_at DESC NULLS LAST
-- LIMIT 20;
