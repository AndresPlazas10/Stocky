-- =====================================================
-- VERIFICAR SI EXISTE LA FUNCIÓN create_employee
-- =====================================================

-- Ver si existe la función
SELECT 
  proname as nombre_funcion,
  prosecdef as es_security_definer,
  pg_get_functiondef(oid) as definicion
FROM pg_proc
WHERE proname = 'create_employee'
LIMIT 1;

-- Si no aparece nada arriba, la función NO EXISTE
-- Debes ejecutar: FUNCIONES_EMPLEADOS_SECURITY_DEFINER.sql
