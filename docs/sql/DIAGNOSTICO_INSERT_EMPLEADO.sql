-- =====================================================
-- DIAGNÓSTICO: ERROR AL CREAR EMPLEADO
-- =====================================================
-- Ayuda a diagnosticar: "new row violates row-level 
-- security policy for table employees"
-- =====================================================

-- INSTRUCCIONES:
-- 1. Reemplaza los valores en las variables
-- 2. Ejecuta este script en Supabase SQL Editor

DO $$
DECLARE
  -- ⚠️ CAMBIAR ESTOS VALORES:
  v_business_id UUID := 'TU-BUSINESS-ID-AQUI'; -- ID del negocio
  v_test_user_id UUID := auth.uid(); -- Usuario actual (el que intenta crear empleado)
  
  -- Variables de diagnóstico
  v_business_exists BOOLEAN;
  v_is_owner BOOLEAN;
  v_function_exists BOOLEAN;
  v_can_insert BOOLEAN;
BEGIN
  RAISE NOTICE '=============================================';
  RAISE NOTICE '🔍 DIAGNÓSTICO: ERROR AL CREAR EMPLEADO';
  RAISE NOTICE '=============================================';
  RAISE NOTICE '';
  RAISE NOTICE '📋 INFORMACIÓN BÁSICA:';
  RAISE NOTICE '   Business ID: %', v_business_id;
  RAISE NOTICE '   User ID (actual): %', v_test_user_id;
  RAISE NOTICE '';
  
  -- =====================================================
  -- PASO 1: Verificar que el negocio existe
  -- =====================================================
  
  SELECT EXISTS(SELECT 1 FROM businesses WHERE id = v_business_id)
  INTO v_business_exists;
  
  IF NOT v_business_exists THEN
    RAISE NOTICE '❌ ERROR: El negocio no existe';
    RAISE NOTICE '   Business ID: %', v_business_id;
    RAISE NOTICE '';
    RAISE NOTICE '💡 SOLUCIÓN:';
    RAISE NOTICE '   Verifica que el business_id sea correcto';
    RAISE NOTICE '   SELECT id, name FROM businesses;';
    RETURN;
  END IF;
  
  RAISE NOTICE '✅ El negocio existe';
  RAISE NOTICE '';
  
  -- =====================================================
  -- PASO 2: Verificar si eres owner del negocio
  -- =====================================================
  
  SELECT EXISTS(
    SELECT 1 FROM businesses 
    WHERE id = v_business_id AND created_by = v_test_user_id
  ) INTO v_is_owner;
  
  IF NOT v_is_owner THEN
    RAISE NOTICE '❌ ERROR: No eres owner del negocio';
    RAISE NOTICE '   Business ID: %', v_business_id;
    RAISE NOTICE '   Tu User ID: %', v_test_user_id;
    RAISE NOTICE '';
    
    -- Mostrar quién es el owner
    DECLARE
      v_actual_owner UUID;
    BEGIN
      SELECT created_by INTO v_actual_owner
      FROM businesses WHERE id = v_business_id;
      
      RAISE NOTICE '   Owner real del negocio: %', v_actual_owner;
    END;
    
    RAISE NOTICE '';
    RAISE NOTICE '💡 SOLUCIÓN:';
    RAISE NOTICE '   Solo el OWNER del negocio puede crear empleados';
    RAISE NOTICE '   Debes iniciar sesión como el usuario owner';
    RETURN;
  END IF;
  
  RAISE NOTICE '✅ Eres owner del negocio';
  RAISE NOTICE '';
  
  -- =====================================================
  -- PASO 3: Verificar que la función helper existe
  -- =====================================================
  
  SELECT EXISTS(
    SELECT 1 FROM pg_proc 
    WHERE proname = 'is_user_owner_of_business'
  ) INTO v_function_exists;
  
  IF NOT v_function_exists THEN
    RAISE NOTICE '❌ ERROR: Función is_user_owner_of_business() no existe';
    RAISE NOTICE '';
    RAISE NOTICE '💡 SOLUCIÓN:';
    RAISE NOTICE '   Debes ejecutar FIX_RECURSION_BUSINESSES_EMPLOYEES.sql primero';
    RAISE NOTICE '   Este script crea las funciones helper necesarias';
    RETURN;
  END IF;
  
  RAISE NOTICE '✅ Función is_user_owner_of_business() existe';
  RAISE NOTICE '';
  
  -- =====================================================
  -- PASO 4: Probar la función helper
  -- =====================================================
  
  SELECT is_user_owner_of_business(v_business_id) INTO v_can_insert;
  
  IF NOT v_can_insert THEN
    RAISE NOTICE '❌ ERROR: is_user_owner_of_business() retorna FALSE';
    RAISE NOTICE '   Esto NO debería pasar si eres owner';
    RAISE NOTICE '';
    RAISE NOTICE '💡 POSIBLE CAUSA:';
    RAISE NOTICE '   La función tiene un problema de permisos o implementación';
    RAISE NOTICE '';
    RAISE NOTICE '   Verifica la función con:';
    RAISE NOTICE '   SELECT is_user_owner_of_business(''%'');', v_business_id;
    RETURN;
  END IF;
  
  RAISE NOTICE '✅ Función is_user_owner_of_business() retorna TRUE';
  RAISE NOTICE '';
  
  -- =====================================================
  -- PASO 5: Verificar política RLS de employees
  -- =====================================================
  
  DECLARE
    v_policy_exists BOOLEAN;
  BEGIN
    SELECT EXISTS(
      SELECT 1 FROM pg_policies
      WHERE tablename = 'employees' 
        AND policyname = 'employees_insert_policy'
    ) INTO v_policy_exists;
    
    IF NOT v_policy_exists THEN
      RAISE NOTICE '❌ ERROR: Política employees_insert_policy no existe';
      RAISE NOTICE '';
      RAISE NOTICE '💡 SOLUCIÓN:';
      RAISE NOTICE '   Ejecuta RLS_EMPLOYEES.sql para crear las políticas';
      RETURN;
    END IF;
    
    RAISE NOTICE '✅ Política employees_insert_policy existe';
    
    -- Mostrar la política
    DECLARE
      v_policy_def TEXT;
    BEGIN
      SELECT with_check::TEXT INTO v_policy_def
      FROM pg_policies
      WHERE tablename = 'employees' AND policyname = 'employees_insert_policy';
      
      RAISE NOTICE '   WITH CHECK: %', v_policy_def;
    END;
  END;
  
  RAISE NOTICE '';
  
  -- =====================================================
  -- PASO 6: Test de INSERT (simulado)
  -- =====================================================
  
  RAISE NOTICE '🧪 TEST DE INSERT:';
  RAISE NOTICE '';
  
  BEGIN
    -- Intentar INSERT en employees (rollback al final)
    INSERT INTO employees (
      business_id,
      user_id,
      role,
      full_name,
      email,
      is_active
    ) VALUES (
      v_business_id,
      gen_random_uuid(), -- Usuario temporal
      'cajero',
      'Test Employee',
      'test@example.com',
      true
    );
    
    RAISE NOTICE '✅ INSERT EXITOSO (test)';
    RAISE NOTICE '   La política RLS permite crear empleados';
    
    -- Rollback para no crear registro real
    RAISE EXCEPTION 'ROLLBACK_TEST' USING ERRCODE = '00000';
    
  EXCEPTION
    WHEN SQLSTATE '00000' THEN
      -- Ignorar el rollback intencional
      NULL;
    WHEN OTHERS THEN
      RAISE NOTICE '❌ INSERT FALLÓ (test)';
      RAISE NOTICE '   Error: %', SQLERRM;
      RAISE NOTICE '';
      RAISE NOTICE '💡 CAUSA:';
      RAISE NOTICE '   La política RLS está bloqueando el INSERT';
      RAISE NOTICE '   Verifica que:';
      RAISE NOTICE '   1. Ejecutaste FIX_RECURSION_BUSINESSES_EMPLOYEES.sql';
      RAISE NOTICE '   2. Ejecutaste RLS_EMPLOYEES.sql actualizado';
      RAISE NOTICE '   3. La función is_user_owner_of_business() funciona';
  END;
  
  RAISE NOTICE '';
  RAISE NOTICE '=============================================';
  RAISE NOTICE '📊 RESUMEN';
  RAISE NOTICE '=============================================';
  
  IF v_business_exists AND v_is_owner AND v_function_exists AND v_can_insert THEN
    RAISE NOTICE '✅ TODO PARECE CORRECTO';
    RAISE NOTICE '';
    RAISE NOTICE 'Deberías poder crear empleados sin problema.';
    RAISE NOTICE 'Si aún hay error, verifica:';
    RAISE NOTICE '1. Que ejecutaste FIX_RECURSION_BUSINESSES_EMPLOYEES.sql';
    RAISE NOTICE '2. Que ejecutaste RLS_EMPLOYEES.sql (versión actualizada)';
    RAISE NOTICE '3. Que el user_id del empleado a crear es válido';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '=============================================';
END $$;
