-- =====================================================
-- VERIFICAR Y LIMPIAR SESIÓN ACTUAL
-- =====================================================
-- Verifica el usuario actual y sus negocios
-- Ayuda a identificar problemas de múltiples cuentas
-- =====================================================

DO $$
DECLARE
  v_current_user_id UUID;
  v_user_email TEXT;
  v_business_record RECORD;
  v_count INT;
BEGIN
  -- Obtener usuario actual
  v_current_user_id := auth.uid();
  
  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'No hay sesión activa. Debes ejecutar este script mientras estás logueado en la aplicación.';
  END IF;
  
  RAISE NOTICE '=============================================';
  RAISE NOTICE '🔍 VERIFICACIÓN DE SESIÓN Y NEGOCIOS';
  RAISE NOTICE '=============================================';
  RAISE NOTICE '';
  RAISE NOTICE '👤 Tu usuario actual (auth.uid()): %', v_current_user_id;
  
  -- Obtener email del usuario
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = v_current_user_id;
  
  RAISE NOTICE '📧 Email: %', v_user_email;
  RAISE NOTICE '';
  
  -- ===================================================
  -- TUS NEGOCIOS (donde eres owner)
  -- ===================================================
  RAISE NOTICE '🏢 TUS NEGOCIOS (created_by = tu user_id):';
  RAISE NOTICE '---------------------------------------------';
  
  v_count := 0;
  FOR v_business_record IN
    SELECT id, name, email, username, created_at
    FROM businesses
    WHERE created_by = v_current_user_id
    ORDER BY created_at DESC
  LOOP
    v_count := v_count + 1;
    RAISE NOTICE '  ✅ Negocio #%:', v_count;
    RAISE NOTICE '     ID: %', v_business_record.id;
    RAISE NOTICE '     Nombre: %', v_business_record.name;
    RAISE NOTICE '     Email: %', v_business_record.email;
    RAISE NOTICE '     Username: %', v_business_record.username;
    RAISE NOTICE '     Creado: %', v_business_record.created_at;
    RAISE NOTICE '';
  END LOOP;
  
  IF v_count = 0 THEN
    RAISE NOTICE '  ❌ NO TIENES NINGÚN NEGOCIO';
    RAISE NOTICE '     → Debes ir a /register y crear tu negocio';
    RAISE NOTICE '';
  ELSIF v_count > 1 THEN
    RAISE NOTICE '  ⚠️  TIENES % NEGOCIOS (probablemente duplicados)', v_count;
    RAISE NOTICE '';
  ELSE
    RAISE NOTICE '  ✅ Tienes exactamente 1 negocio (correcto)';
    RAISE NOTICE '';
  END IF;
  
  -- ===================================================
  -- TODOS LOS USUARIOS EN auth.users
  -- ===================================================
  RAISE NOTICE '👥 TODOS LOS USUARIOS EN auth.users:';
  RAISE NOTICE '---------------------------------------------';
  
  v_count := 0;
  FOR v_business_record IN
    SELECT id, email, created_at,
           CASE WHEN id = v_current_user_id THEN true ELSE false END as is_current
    FROM auth.users
    ORDER BY created_at DESC
    LIMIT 10
  LOOP
    v_count := v_count + 1;
    IF v_business_record.is_current THEN
      RAISE NOTICE '  ✅ Usuario #% (TÚ - ACTUAL):', v_count;
    ELSE
      RAISE NOTICE '  👤 Usuario #%:', v_count;
    END IF;
    RAISE NOTICE '     ID: %', v_business_record.id;
    RAISE NOTICE '     Email: %', v_business_record.email;
    RAISE NOTICE '     Creado: %', v_business_record.created_at;
    RAISE NOTICE '';
  END LOOP;
  
  IF v_count > 1 THEN
    RAISE NOTICE '  ⚠️  HAY % USUARIOS - Probablemente creaste múltiples cuentas', v_count;
    RAISE NOTICE '';
  END IF;
  
  -- ===================================================
  -- TODOS LOS NEGOCIOS (para ver si hay problemas)
  -- ===================================================
  RAISE NOTICE '🌎 TODOS LOS NEGOCIOS EN LA BD:';
  RAISE NOTICE '---------------------------------------------';
  
  v_count := 0;
  FOR v_business_record IN
    SELECT id, name, created_by, email, username, created_at
    FROM businesses
    ORDER BY created_at DESC
  LOOP
    v_count := v_count + 1;
    
    IF v_business_record.created_by = v_current_user_id THEN
      RAISE NOTICE '  ✅ Negocio #% (TUYO):', v_count;
    ELSE
      RAISE NOTICE '  ⚠️  Negocio #% (de otro usuario):', v_count;
    END IF;
    
    RAISE NOTICE '     ID: %', v_business_record.id;
    RAISE NOTICE '     Nombre: %', v_business_record.name;
    RAISE NOTICE '     Owner: %', v_business_record.created_by;
    RAISE NOTICE '     Email: %', v_business_record.email;
    RAISE NOTICE '     Username: %', v_business_record.username;
    RAISE NOTICE '';
  END LOOP;
  
  -- ===================================================
  -- RECOMENDACIONES
  -- ===================================================
  RAISE NOTICE '=============================================';
  RAISE NOTICE '💡 DIAGNÓSTICO Y RECOMENDACIONES:';
  RAISE NOTICE '=============================================';
  RAISE NOTICE '';
  
  -- Contar negocios del usuario actual
  SELECT COUNT(*) INTO v_count
  FROM businesses
  WHERE created_by = v_current_user_id;
  
  IF v_count = 0 THEN
    RAISE NOTICE '❌ PROBLEMA: No tienes ningún negocio';
    RAISE NOTICE '   SOLUCIÓN: Ve a /register y crea tu negocio';
    RAISE NOTICE '';
  ELSIF v_count = 1 THEN
    RAISE NOTICE '✅ CORRECTO: Tienes exactamente 1 negocio';
    RAISE NOTICE '   → Puedes crear empleados sin problemas';
    RAISE NOTICE '';
  ELSE
    RAISE NOTICE '⚠️  PROBLEMA: Tienes % negocios (duplicados)', v_count;
    RAISE NOTICE '   SOLUCIÓN: Elimina los negocios duplicados más antiguos';
    RAISE NOTICE '';
  END IF;
  
  -- Verificar si hay múltiples usuarios
  SELECT COUNT(*) INTO v_count FROM auth.users;
  
  IF v_count > 1 THEN
    RAISE NOTICE '⚠️  ADVERTENCIA: Hay % usuarios en total', v_count;
    RAISE NOTICE '   Probablemente creaste múltiples cuentas';
    RAISE NOTICE '   Asegúrate de estar usando la cuenta correcta';
    RAISE NOTICE '';
  END IF;
  
  RAISE NOTICE '🔑 TU USER_ID ACTUAL: %', v_current_user_id;
  RAISE NOTICE '   Copia este ID y verifica que sea el mismo en la aplicación';
  RAISE NOTICE '';
  RAISE NOTICE '=============================================';
  
END $$;
