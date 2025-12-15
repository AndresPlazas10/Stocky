-- =====================================================
-- DIAGNÓSTICO DE PROBLEMA DE EMPLEADO
-- =====================================================
-- Este script te ayuda a diagnosticar por qué un empleado
-- no puede ingresar al sistema
-- =====================================================

-- PASO 1: Reemplaza 'EMAIL_DEL_EMPLEADO' con el email real
-- del empleado que tiene problemas

DO $$
DECLARE
  v_email TEXT := 'EMAIL_DEL_EMPLEADO'; -- CAMBIAR ESTE EMAIL
  v_user_id UUID;
  v_employee_record RECORD;
  v_business_record RECORD;
BEGIN
  RAISE NOTICE '=============================================';
  RAISE NOTICE '🔍 DIAGNÓSTICO DE EMPLEADO';
  RAISE NOTICE '=============================================';
  RAISE NOTICE '';
  
  -- Buscar user_id en auth.users
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = v_email;
  
  IF v_user_id IS NULL THEN
    RAISE NOTICE '❌ ERROR: No se encontró usuario con email: %', v_email;
    RAISE NOTICE '   El usuario no existe en auth.users';
    RETURN;
  END IF;
  
  RAISE NOTICE '✅ Usuario encontrado:';
  RAISE NOTICE '   Email: %', v_email;
  RAISE NOTICE '   User ID: %', v_user_id;
  RAISE NOTICE '';
  
  -- Buscar registro en tabla employees
  SELECT * INTO v_employee_record
  FROM employees
  WHERE user_id = v_user_id;
  
  IF v_employee_record IS NULL THEN
    RAISE NOTICE '❌ ERROR: No hay registro de empleado';
    RAISE NOTICE '   El usuario no está registrado en la tabla employees';
    RAISE NOTICE '';
    RAISE NOTICE '💡 SOLUCIÓN:';
    RAISE NOTICE '   El owner debe invitar a este usuario como empleado';
    RETURN;
  END IF;
  
  RAISE NOTICE '✅ Registro de empleado encontrado:';
  RAISE NOTICE '   ID: %', v_employee_record.id;
  RAISE NOTICE '   Business ID: %', v_employee_record.business_id;
  RAISE NOTICE '   Role: %', v_employee_record.role;
  RAISE NOTICE '   Is Active: %', v_employee_record.is_active;
  RAISE NOTICE '   Full Name: %', v_employee_record.full_name;
  RAISE NOTICE '   Email: %', v_employee_record.email;
  RAISE NOTICE '';
  
  -- Verificar si está activo
  IF v_employee_record.is_active = FALSE THEN
    RAISE NOTICE '❌ PROBLEMA ENCONTRADO:';
    RAISE NOTICE '   El empleado está INACTIVO (is_active = false)';
    RAISE NOTICE '';
    RAISE NOTICE '💡 SOLUCIÓN:';
    RAISE NOTICE '   El owner debe activar al empleado con este SQL:';
    RAISE NOTICE '';
    RAISE NOTICE '   UPDATE employees';
    RAISE NOTICE '   SET is_active = true';
    RAISE NOTICE '   WHERE id = ''%'';', v_employee_record.id;
    RAISE NOTICE '';
    RETURN;
  END IF;
  
  RAISE NOTICE '✅ El empleado está activo';
  RAISE NOTICE '';
  
  -- Verificar business_id
  IF v_employee_record.business_id IS NULL THEN
    RAISE NOTICE '❌ ERROR: No tiene business_id asignado';
    RAISE NOTICE '   El empleado no está vinculado a ningún negocio';
    RETURN;
  END IF;
  
  -- Buscar el negocio
  SELECT * INTO v_business_record
  FROM businesses
  WHERE id = v_employee_record.business_id;
  
  IF v_business_record IS NULL THEN
    RAISE NOTICE '❌ ERROR: El negocio no existe';
    RAISE NOTICE '   Business ID: %', v_employee_record.business_id;
    RAISE NOTICE '   El negocio fue eliminado o no existe';
    RETURN;
  END IF;
  
  RAISE NOTICE '✅ Negocio encontrado:';
  RAISE NOTICE '   ID: %', v_business_record.id;
  RAISE NOTICE '   Nombre: %', v_business_record.name;
  RAISE NOTICE '   Owner (created_by): %', v_business_record.created_by;
  RAISE NOTICE '';
  
  -- Verificar permisos RLS
  RAISE NOTICE '🔒 VERIFICACIÓN DE PERMISOS RLS:';
  RAISE NOTICE '';
  
  -- Simular get_user_business_ids()
  DECLARE
    v_business_count INT;
  BEGIN
    SELECT COUNT(*) INTO v_business_count
    FROM (
      SELECT id FROM businesses WHERE created_by = v_user_id
      UNION
      SELECT business_id FROM employees 
      WHERE user_id = v_user_id AND is_active = true
    ) AS accessible_businesses;
    
    RAISE NOTICE '   Negocios accesibles: %', v_business_count;
    
    IF v_business_count = 0 THEN
      RAISE NOTICE '   ❌ El empleado NO tiene acceso a ningún negocio';
      RAISE NOTICE '   Esto bloqueará todas las consultas RLS';
    ELSE
      RAISE NOTICE '   ✅ El empleado tiene acceso a % negocio(s)', v_business_count;
    END IF;
  END;
  
  RAISE NOTICE '';
  RAISE NOTICE '=============================================';
  RAISE NOTICE '📊 RESUMEN';
  RAISE NOTICE '=============================================';
  
  IF v_employee_record.is_active = TRUE AND v_business_record.id IS NOT NULL THEN
    RAISE NOTICE '✅ TODO PARECE CORRECTO';
    RAISE NOTICE '';
    RAISE NOTICE 'Si aún hay error, verifica:';
    RAISE NOTICE '1. Las políticas RLS están habilitadas correctamente';
    RAISE NOTICE '2. La función get_user_business_ids() existe';
    RAISE NOTICE '3. El empleado tiene permisos en auth.users';
    RAISE NOTICE '';
    RAISE NOTICE 'Ejecuta este query para verificar la función:';
    RAISE NOTICE 'SELECT * FROM get_user_business_ids();';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '=============================================';
END $$;
