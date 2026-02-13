-- ============================================================
-- VALIDACIÓN POST-DEPLOY: RPCs DE LISTADOS ENRIQUECIDOS
-- Fecha: 2026-02-13
-- Uso: Ejecutar en Supabase SQL Editor después de aplicar
--      supabase/migrations/20260213_1300_create_enriched_listing_rpcs.sql
-- ============================================================

-- 1) Verificar existencia de funciones esperadas
SELECT
  'get_sales_enriched' AS function_name,
  CASE
    WHEN to_regprocedure('public.get_sales_enriched(uuid,integer,integer,timestamptz,timestamptz,text,uuid,uuid,numeric,numeric,boolean)') IS NOT NULL
    THEN 'OK'
    ELSE 'MISSING'
  END AS exists_status
UNION ALL
SELECT
  'get_purchases_enriched' AS function_name,
  CASE
    WHEN to_regprocedure('public.get_purchases_enriched(uuid,integer,integer,timestamptz,timestamptz,uuid,uuid,numeric,numeric,boolean)') IS NOT NULL
    THEN 'OK'
    ELSE 'MISSING'
  END AS exists_status;

-- 2) Verificar grants (authenticated debe tener EXECUTE)
SELECT
  p.proname AS function_name,
  CASE
    WHEN has_function_privilege('authenticated', p.oid, 'EXECUTE')
    THEN 'OK'
    ELSE 'FAIL'
  END AS authenticated_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('get_sales_enriched', 'get_purchases_enriched')
ORDER BY p.proname;

-- 3) Probar ejecución (usa business_id válido al final)
-- SELECT * FROM public.get_sales_enriched(
--   p_business_id := '<BUSINESS_ID>'::uuid,
--   p_limit := 5,
--   p_offset := 0,
--   p_include_count := true
-- );
--
-- SELECT * FROM public.get_purchases_enriched(
--   p_business_id := '<BUSINESS_ID>'::uuid,
--   p_limit := 5,
--   p_offset := 0,
--   p_include_count := true
-- );
