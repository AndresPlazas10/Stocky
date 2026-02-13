-- ============================================================
-- VALIDACIÓN HARDENING MULTI-TENANT (POST DEPLOY)
-- Fecha: 2026-02-13
-- Uso: ejecutar en staging/prod después de migraciones 20260213_*
-- ============================================================

-- ------------------------------------------------------------
-- 1) Confirmar funciones nuevas/críticas
-- ------------------------------------------------------------
SELECT proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS args,
       prosecdef AS security_definer
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND proname IN (
    'can_access_business',
    'create_sale_complete',
    'update_stock_batch',
    'restore_stock_batch',
    'get_business_dashboard_metrics',
    'get_business_today_metrics',
    'check_business_access',
    'get_low_stock_products',
    'create_split_sales_complete'
  )
ORDER BY proname;

-- ------------------------------------------------------------
-- 2) Verificar que no queden grants EXECUTE a anon en funciones sensibles
-- ------------------------------------------------------------
SELECT n.nspname AS schema_name,
       p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS args,
       p.oid::regprocedure AS signature
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'generate_invoice_number',
    'create_sale_complete',
    'update_stock_batch',
    'restore_stock_batch',
    'get_business_dashboard_metrics',
    'get_business_today_metrics',
    'check_business_access',
    'get_low_stock_products',
    'create_split_sales_complete',
    'create_employee',
    'delete_auth_user',
    'increase_stock',
    'reduce_stock',
    'restore_stock_from_invoice'
  )
  AND has_function_privilege('anon', p.oid, 'EXECUTE')
ORDER BY function_name;

-- Resultado esperado: 0 filas.

-- ------------------------------------------------------------
-- 3) Verificar que employees ya no tenga policy USING (true)
-- ------------------------------------------------------------
SELECT schemaname,
       tablename,
       policyname,
       cmd,
       qual,
       with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'employees'
ORDER BY policyname;

-- Revisar manualmente que qual no sea "true".

-- ------------------------------------------------------------
-- 4) Verificar que can_access_business exista y sea ejecutable por authenticated
-- ------------------------------------------------------------
SELECT
  p.oid::regprocedure AS signature,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'can_access_business';

-- Resultado esperado: authenticated=true, anon=false.

-- ------------------------------------------------------------
-- 5) Smoke test lógico de consistencia mesa/orden abierta
-- ------------------------------------------------------------
SELECT t.id AS table_id,
       t.business_id,
       t.current_order_id,
       o.status AS order_status
FROM public.tables t
LEFT JOIN public.orders o ON o.id = t.current_order_id
WHERE t.current_order_id IS NOT NULL
  AND (o.id IS NULL OR lower(coalesce(o.status,'')) <> 'open');

-- Resultado esperado: 0 filas.

-- ------------------------------------------------------------
-- 6) Verificar que la nueva RPC atómica de split exista
-- ------------------------------------------------------------
SELECT p.oid::regprocedure AS signature,
       prosecdef AS security_definer
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'create_split_sales_complete';

-- Resultado esperado: 1 fila.

-- ------------------------------------------------------------
-- 7) Verificar triggers de invariantes orders <-> tables
-- ------------------------------------------------------------
SELECT event_object_table AS table_name,
       trigger_name,
       action_timing,
       event_manipulation AS event
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name IN (
    'trg_enforce_order_open_invariants',
    'trg_enforce_table_current_order_invariants'
  )
ORDER BY trigger_name, event;

-- Resultado esperado: triggers presentes en orders y tables.

-- ------------------------------------------------------------
-- 8) Verificar wrappers idempotentes y grants
-- ------------------------------------------------------------
SELECT p.oid::regprocedure AS signature,
       prosecdef AS security_definer,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'create_sale_complete_idempotent',
    'create_split_sales_complete_idempotent'
  )
ORDER BY p.proname;

-- Resultado esperado: funciones presentes, authenticated=true, anon=false.

-- ------------------------------------------------------------
-- 9) Verificar tabla de idempotencia
-- ------------------------------------------------------------
SELECT to_regclass('public.idempotency_requests') AS idempotency_table;

-- Resultado esperado: public.idempotency_requests

-- ------------------------------------------------------------
-- 10) Verificar función de limpieza de idempotencia
-- ------------------------------------------------------------
SELECT p.oid::regprocedure AS signature,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'cleanup_expired_idempotency_requests';

-- Resultado esperado: función presente, authenticated=true, anon=false.

-- ------------------------------------------------------------
-- 11) Verificar RPCs de gestión de empleados endurecidas
-- ------------------------------------------------------------
SELECT p.oid::regprocedure AS signature,
       prosecdef AS security_definer,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'can_manage_business_employees',
    'create_employee',
    'delete_employee',
    'delete_auth_user'
  )
ORDER BY p.proname;

-- Resultado esperado:
-- - funciones presentes
-- - authenticated=true
-- - anon=false
-- ============================================================
