-- =====================================================
-- FIX COMPLETO: Todas las funciones con search_path
-- =====================================================
-- Este script agrega SET search_path a TODAS las versiones
-- de cada función (sobrecargadas)
-- =====================================================

-- Ver todas las funciones y sus parámetros
SELECT 
  p.proname as nombre,
  pg_get_function_identity_arguments(p.oid) as parametros,
  CASE 
    WHEN p.proconfig IS NOT NULL AND array_to_string(p.proconfig, ',') LIKE '%search_path%'
    THEN '✅ Tiene search_path'
    ELSE '❌ Falta search_path'
  END as estado
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN (
    'reduce_stock',
    'increase_stock',
    'update_purchase_total',
    'cleanup_expired_idempotency_requests',
    'prevent_duplicate_business_creation',
    'prevent_duplicate_employee_creation',
    'check_email_has_access',
    'user_has_business_access',
    'update_stock_batch',
    'restore_stock_batch',
    'update_updated_at_column',
    'is_stocky_admin',
    'activate_business_invoicing',
    'deactivate_business_invoicing'
  )
ORDER BY nombre, parametros;

-- =====================================================
-- AHORA: Ejecuta este comando SQL para corregir TODO
-- =====================================================

DO $$
DECLARE
  func RECORD;
  func_def TEXT;
BEGIN
  -- Iterar sobre todas las funciones que necesitan corrección
  FOR func IN 
    SELECT 
      p.oid,
      p.proname,
      n.nspname,
      pg_get_functiondef(p.oid) as definition
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'reduce_stock',
        'increase_stock',
        'update_purchase_total',
        'cleanup_expired_idempotency_requests',
        'prevent_duplicate_business_creation',
        'prevent_duplicate_employee_creation',
        'check_email_has_access',
        'user_has_business_access',
        'update_stock_batch',
        'restore_stock_batch',
        'update_updated_at_column',
        'is_stocky_admin',
        'activate_business_invoicing',
        'deactivate_business_invoicing'
      )
      AND (p.proconfig IS NULL OR array_to_string(p.proconfig, ',') NOT LIKE '%search_path%')
  LOOP
    -- Obtener la definición completa
    func_def := func.definition;
    
    -- Reemplazar para agregar SET search_path
    -- Buscar LANGUAGE y agregar SET antes
    func_def := regexp_replace(
      func_def,
      'LANGUAGE ([a-z]+)',
      'LANGUAGE \1\nSET search_path = public',
      'i'
    );
    
    -- Ejecutar la definición modificada
    BEGIN
      EXECUTE func_def;
      RAISE NOTICE 'Actualizado: %.%', func.nspname, func.proname;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Error en %.%: %', func.nspname, func.proname, SQLERRM;
    END;
  END LOOP;
END $$;

-- =====================================================
-- VERIFICACIÓN FINAL
-- =====================================================

SELECT 
  p.proname as "Función",
  pg_get_function_identity_arguments(p.oid) as "Parámetros",
  CASE 
    WHEN p.proconfig IS NOT NULL AND array_to_string(p.proconfig, ',') LIKE '%search_path%'
    THEN '✅ CORRECTO'
    ELSE '❌ FALTA'
  END as "Estado"
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN (
    'reduce_stock',
    'increase_stock',
    'update_purchase_total',
    'cleanup_expired_idempotency_requests',
    'prevent_duplicate_business_creation',
    'prevent_duplicate_employee_creation',
    'check_email_has_access',
    'user_has_business_access',
    'update_stock_batch',
    'restore_stock_batch',
    'update_updated_at_column',
    'is_stocky_admin',
    'activate_business_invoicing',
    'deactivate_business_invoicing'
  )
ORDER BY "Función", "Parámetros";
