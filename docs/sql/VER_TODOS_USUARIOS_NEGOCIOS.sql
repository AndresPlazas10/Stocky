-- =====================================================
-- VER TODOS LOS USUARIOS Y NEGOCIOS
-- =====================================================
-- NO requiere sesión activa
-- Muestra todos los usuarios y negocios para diagnosticar
-- =====================================================

DO $$
DECLARE
  v_user_record RECORD;
  v_business_record RECORD;
  v_user_count INT;
  v_business_count INT;
BEGIN
  RAISE NOTICE '=============================================';
  RAISE NOTICE '👥 TODOS LOS USUARIOS (auth.users)';
  RAISE NOTICE '=============================================';
  RAISE NOTICE '';
  
  v_user_count := 0;
  FOR v_user_record IN
    SELECT id, email, created_at, email_confirmed_at
    FROM auth.users
    ORDER BY created_at DESC
  LOOP
    v_user_count := v_user_count + 1;
    RAISE NOTICE 'Usuario #%:', v_user_count;
    RAISE NOTICE '  ID: %', v_user_record.id;
    RAISE NOTICE '  Email: %', v_user_record.email;
    RAISE NOTICE '  Creado: %', v_user_record.created_at;
    RAISE NOTICE '  Email confirmado: %', v_user_record.email_confirmed_at;
    RAISE NOTICE '';
  END LOOP;
  
  RAISE NOTICE 'TOTAL USUARIOS: %', v_user_count;
  RAISE NOTICE '';
  RAISE NOTICE '=============================================';
  RAISE NOTICE '🏢 TODOS LOS NEGOCIOS (businesses)';
  RAISE NOTICE '=============================================';
  RAISE NOTICE '';
  
  v_business_count := 0;
  FOR v_business_record IN
    SELECT id, name, created_by, email, username, created_at
    FROM businesses
    ORDER BY created_at DESC
  LOOP
    v_business_count := v_business_count + 1;
    RAISE NOTICE 'Negocio #%:', v_business_count;
    RAISE NOTICE '  ID: %', v_business_record.id;
    RAISE NOTICE '  Nombre: %', v_business_record.name;
    RAISE NOTICE '  Owner (created_by): %', v_business_record.created_by;
    RAISE NOTICE '  Email: %', v_business_record.email;
    RAISE NOTICE '  Username: %', v_business_record.username;
    RAISE NOTICE '  Creado: %', v_business_record.created_at;
    RAISE NOTICE '';
  END LOOP;
  
  RAISE NOTICE 'TOTAL NEGOCIOS: %', v_business_count;
  RAISE NOTICE '';
  
  -- ===================================================
  -- CRUCE: Qué usuario es owner de qué negocio
  -- ===================================================
  RAISE NOTICE '=============================================';
  RAISE NOTICE '🔗 RELACIÓN USUARIO → NEGOCIO';
  RAISE NOTICE '=============================================';
  RAISE NOTICE '';
  
  FOR v_business_record IN
    SELECT 
      u.id as user_id,
      u.email as user_email,
      b.id as business_id,
      b.name as business_name,
      b.username as business_username
    FROM auth.users u
    LEFT JOIN businesses b ON b.created_by = u.id
    ORDER BY u.created_at DESC
  LOOP
    IF v_business_record.business_id IS NOT NULL THEN
      RAISE NOTICE '✅ Usuario: % (ID: %)', v_business_record.user_email, v_business_record.user_id;
      RAISE NOTICE '   → Negocio: % (@%)', v_business_record.business_name, v_business_record.business_username;
      RAISE NOTICE '   → Business ID: %', v_business_record.business_id;
    ELSE
      RAISE NOTICE '❌ Usuario: % (ID: %)', v_business_record.user_email, v_business_record.user_id;
      RAISE NOTICE '   → SIN NEGOCIO';
    END IF;
    RAISE NOTICE '';
  END LOOP;
  
  -- ===================================================
  -- DIAGNÓSTICO
  -- ===================================================
  RAISE NOTICE '=============================================';
  RAISE NOTICE '💡 DIAGNÓSTICO:';
  RAISE NOTICE '=============================================';
  RAISE NOTICE '';
  
  IF v_user_count > v_business_count THEN
    RAISE NOTICE '⚠️  Hay más usuarios (%) que negocios (%)', v_user_count, v_business_count;
    RAISE NOTICE '   Algunos usuarios NO tienen negocio';
    RAISE NOTICE '';
  ELSIF v_business_count > v_user_count THEN
    RAISE NOTICE '⚠️  Hay más negocios (%) que usuarios (%)', v_business_count, v_user_count;
    RAISE NOTICE '   Esto NO debería pasar';
    RAISE NOTICE '';
  ELSE
    RAISE NOTICE '✅ Hay igual cantidad de usuarios y negocios (%)', v_user_count;
    RAISE NOTICE '';
  END IF;
  
  IF v_user_count > 1 THEN
    RAISE NOTICE '⚠️  HAY MÚLTIPLES USUARIOS (%):', v_user_count;
    RAISE NOTICE '   Probablemente creaste varias cuentas';
    RAISE NOTICE '   Debes cerrar sesión y loguearte con el usuario correcto';
    RAISE NOTICE '';
  END IF;
  
  RAISE NOTICE '=============================================';
  RAISE NOTICE '📋 INSTRUCCIONES:';
  RAISE NOTICE '=============================================';
  RAISE NOTICE '';
  RAISE NOTICE '1. Copia el USER_ID del usuario que quieres usar';
  RAISE NOTICE '2. En la aplicación, abre la consola del navegador (F12)';
  RAISE NOTICE '3. Intenta crear un empleado';
  RAISE NOTICE '4. Verás el debug con los IDs - compara con esta lista';
  RAISE NOTICE '';
  RAISE NOTICE '=============================================';
  
END $$;
