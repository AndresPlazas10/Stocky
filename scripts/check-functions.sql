-- Script para verificar qué funciones existen en la base de datos
-- Ejecutar en Supabase SQL Editor

SELECT 
    routine_name as function_name,
    routine_schema as schema_name,
    routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_type = 'FUNCTION'
  AND routine_name IN (
    'reduce_stock',
    'increase_stock', 
    'update_purchase_total',
    'cleanup_expired_idempotency_requests',
    'prevent_duplicate_business_creation',
    'prevent_duplicate_employee_creation',
    'check_email_has_access',
    'is_stocky_admin',
    'activate_business_invoicing',
    'deactivate_business_invoicing',
    'user_has_business_access'
  )
ORDER BY routine_name;
