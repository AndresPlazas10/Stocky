-- =====================================================
-- 🔍 DIAGNÓSTICO COMPLETO - PROBLEMA EMPLEADOS 403
-- =====================================================
-- Este script verifica TODAS las posibles causas del error 403
-- =====================================================

-- =====================================================
-- 1. VERIFICAR FUNCIÓN get_my_business_ids
-- =====================================================

DO $$
DECLARE
  func_exists BOOLEAN;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '1. VERIFICANDO FUNCIÓN get_my_business_ids';
  RAISE NOTICE '========================================';
  
  SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname = 'get_my_business_ids'
  ) INTO func_exists;
  
  IF func_exists THEN
    RAISE NOTICE '✅ Función get_my_business_ids EXISTE';
  ELSE
    RAISE NOTICE '❌ ERROR CRÍTICO: Función get_my_business_ids NO EXISTE';
    RAISE NOTICE '   → Esto causará error en las políticas RLS';
  END IF;
END $$;

-- Ver definición de la función
SELECT 
  p.proname as nombre_funcion,
  pg_get_functiondef(p.oid) as definicion
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname = 'get_my_business_ids';

-- =====================================================
-- 2. VERIFICAR RLS EN TABLA EMPLOYEES
-- =====================================================

DO $$
DECLARE
  rls_enabled BOOLEAN;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '2. VERIFICANDO RLS EN EMPLOYEES';
  RAISE NOTICE '========================================';
  
  SELECT relrowsecurity INTO rls_enabled
  FROM pg_class
  WHERE relname = 'employees';
  
  IF rls_enabled THEN
    RAISE NOTICE '✅ RLS está HABILITADO en employees';
  ELSE
    RAISE NOTICE '❌ RLS está DESHABILITADO en employees';
  END IF;
END $$;

-- =====================================================
-- 3. VERIFICAR POLÍTICAS ACTUALES
-- =====================================================

SELECT 
  '3. POLÍTICAS ACTUALES' as seccion,
  policyname as politica,
  cmd as operacion,
  CASE 
    WHEN permissive = 'PERMISSIVE' THEN '✅ Permisiva'
    ELSE '⚠️ Restrictiva'
  END as tipo,
  roles as roles
FROM pg_policies
WHERE tablename = 'employees'
ORDER BY cmd, policyname;

-- Ver detalles completos de las políticas
SELECT 
  policyname,
  cmd,
  qual as condicion_using,
  with_check as condicion_check
FROM pg_policies
WHERE tablename = 'employees';

-- =====================================================
-- 4. PROBAR LA FUNCIÓN get_my_business_ids
-- =====================================================

DO $$
DECLARE
  my_businesses UUID[];
  business_count INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '4. PROBANDO get_my_business_ids()';
  RAISE NOTICE '========================================';
  
  -- Intentar ejecutar la función
  BEGIN
    SELECT ARRAY(SELECT get_my_business_ids()) INTO my_businesses;
    business_count := array_length(my_businesses, 1);
    
    IF business_count > 0 THEN
      RAISE NOTICE '✅ Función ejecutada correctamente';
      RAISE NOTICE 'Negocios encontrados: %', business_count;
      RAISE NOTICE 'IDs: %', my_businesses;
    ELSE
      RAISE NOTICE '⚠️  Función ejecutó pero no devolvió negocios';
      RAISE NOTICE 'Usuario actual no tiene negocios asociados';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ ERROR al ejecutar get_my_business_ids()';
    RAISE NOTICE 'Error: %', SQLERRM;
  END;
END $$;

-- =====================================================
-- 5. VERIFICAR USUARIO ACTUAL
-- =====================================================

SELECT 
  '5. USUARIO ACTUAL' as seccion,
  auth.uid() as user_id,
  auth.jwt() ->> 'email' as email,
  auth.jwt() ->> 'role' as role;

-- Ver negocios del usuario actual
SELECT 
  '5b. MIS NEGOCIOS' as seccion,
  id,
  name as business_name,
  created_by,
  CASE 
    WHEN created_by = auth.uid() THEN '✅ SOY OWNER'
    ELSE '❌ No soy owner'
  END as relacion
FROM businesses
WHERE created_by = auth.uid();

-- =====================================================
-- 6. VERIFICAR TABLA EMPLOYEES
-- =====================================================

SELECT 
  '6. ESTRUCTURA EMPLOYEES' as seccion,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'employees'
ORDER BY ordinal_position;

-- Contar empleados totales (sin filtro RLS)
DO $$
DECLARE
  total_employees INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '6b. EMPLEADOS EN LA BASE DE DATOS';
  RAISE NOTICE '========================================';
  
  -- Esto puede fallar si RLS bloquea el acceso
  BEGIN
    SELECT COUNT(*) INTO total_employees FROM employees;
    RAISE NOTICE 'Total empleados visible: %', total_employees;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ No se puede contar empleados (RLS bloqueando)';
  END;
END $$;

-- =====================================================
-- 7. SIMULAR INSERCIÓN (sin ejecutar)
-- =====================================================

DO $$
DECLARE
  test_business_id UUID;
  can_insert BOOLEAN;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '7. SIMULACIÓN DE INSERCIÓN';
  RAISE NOTICE '========================================';
  
  -- Obtener primer business del usuario
  SELECT id INTO test_business_id
  FROM businesses
  WHERE created_by = auth.uid()
  LIMIT 1;
  
  IF test_business_id IS NULL THEN
    RAISE NOTICE '❌ ERROR CRÍTICO: No tienes ningún negocio';
    RAISE NOTICE '   → No puedes crear empleados sin un negocio';
    RETURN;
  END IF;
  
  RAISE NOTICE 'Business ID para prueba: %', test_business_id;
  
  -- Verificar si la política permitiría la inserción
  SELECT 
    test_business_id IN (SELECT get_my_business_ids())
  INTO can_insert;
  
  IF can_insert THEN
    RAISE NOTICE '✅ La política DEBERÍA permitir la inserción';
  ELSE
    RAISE NOTICE '❌ La política BLOQUEARÁ la inserción';
    RAISE NOTICE '   → Problema con get_my_business_ids()';
  END IF;
END $$;

-- =====================================================
-- 8. VERIFICAR PERMISOS EN LA TABLA
-- =====================================================

SELECT 
  '8. PERMISOS TABLA EMPLOYEES' as seccion,
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'employees'
AND grantee IN ('authenticated', 'anon', 'postgres')
ORDER BY grantee, privilege_type;

-- =====================================================
-- 9. RESUMEN Y DIAGNÓSTICO
-- =====================================================

DO $$
DECLARE
  has_function BOOLEAN;
  has_rls BOOLEAN;
  has_policies BOOLEAN;
  has_business BOOLEAN;
  policy_count INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '9. RESUMEN DEL DIAGNÓSTICO';
  RAISE NOTICE '========================================';
  
  -- Verificar función
  SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'get_my_business_ids'
  ) INTO has_function;
  
  -- Verificar RLS
  SELECT relrowsecurity INTO has_rls
  FROM pg_class WHERE relname = 'employees';
  
  -- Verificar políticas
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies WHERE tablename = 'employees';
  has_policies := policy_count >= 4;
  
  -- Verificar business
  SELECT EXISTS (
    SELECT 1 FROM businesses WHERE created_by = auth.uid()
  ) INTO has_business;
  
  RAISE NOTICE '';
  IF has_function THEN
    RAISE NOTICE '✅ Función get_my_business_ids existe';
  ELSE
    RAISE NOTICE '❌ PROBLEMA: Falta función get_my_business_ids';
  END IF;
  
  IF has_rls THEN
    RAISE NOTICE '✅ RLS habilitado';
  ELSE
    RAISE NOTICE '❌ PROBLEMA: RLS deshabilitado';
  END IF;
  
  IF has_policies THEN
    RAISE NOTICE '✅ Políticas configuradas (%)', policy_count;
  ELSE
    RAISE NOTICE '❌ PROBLEMA: Faltan políticas (solo %)', policy_count;
  END IF;
  
  IF has_business THEN
    RAISE NOTICE '✅ Usuario tiene negocio';
  ELSE
    RAISE NOTICE '❌ PROBLEMA: Usuario no tiene negocio';
  END IF;
  
  RAISE NOTICE '';
  IF has_function AND has_rls AND has_policies AND has_business THEN
    RAISE NOTICE '🎉 TODO PARECE CORRECTO';
    RAISE NOTICE '   Si aún hay error 403, revisa:';
    RAISE NOTICE '   1. Que el user_id del nuevo empleado no sea NULL';
    RAISE NOTICE '   2. Que estés usando el business_id correcto';
    RAISE NOTICE '   3. Los logs de la consola del navegador';
  ELSE
    RAISE NOTICE '⚠️  HAY PROBLEMAS - Revisa los errores arriba';
  END IF;
END $$;

-- =====================================================
-- 10. SOLUCIONES POSIBLES
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '10. SOLUCIONES SI HAY PROBLEMAS';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Si get_my_business_ids NO existe:';
  RAISE NOTICE '  → Ejecuta: docs/sql/optimize_rls_performance.sql';
  RAISE NOTICE '';
  RAISE NOTICE 'Si RLS está deshabilitado:';
  RAISE NOTICE '  → ALTER TABLE employees ENABLE ROW LEVEL SECURITY;';
  RAISE NOTICE '';
  RAISE NOTICE 'Si faltan políticas:';
  RAISE NOTICE '  → Ejecuta: docs/sql/fix_employees_rls.sql';
  RAISE NOTICE '';
  RAISE NOTICE 'Si no tienes negocio:';
  RAISE NOTICE '  → Crea un negocio primero desde el registro';
  RAISE NOTICE '';
END $$;

-- =====================================================
-- FIN DEL DIAGNÓSTICO
-- =====================================================
