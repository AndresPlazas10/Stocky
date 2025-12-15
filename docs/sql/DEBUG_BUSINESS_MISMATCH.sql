-- =====================================================
-- DEBUG: VERIFICAR NEGOCIO DEL USUARIO
-- =====================================================
-- Este script ayuda a identificar por qué se carga
-- un negocio que no pertenece al usuario actual
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
  
  RAISE NOTICE '=============================================';
  RAISE NOTICE '🔍 DIAGNÓSTICO: NEGOCIO DEL USUARIO';
  RAISE NOTICE '=============================================';
  RAISE NOTICE '';
  RAISE NOTICE '👤 Usuario actual (auth.uid()): %', v_current_user_id;
  
  -- Obtener email del usuario actual
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = v_current_user_id;
  
  RAISE NOTICE '📧 Email del usuario: %', v_user_email;
  RAISE NOTICE '';
  
  -- ===================================================
  -- NEGOCIOS DONDE ES OWNER (created_by)
  -- ===================================================
  RAISE NOTICE '🏢 NEGOCIOS DONDE ERES OWNER (created_by = tu user_id):';
  RAISE NOTICE '---------------------------------------------';
  
  v_count := 0;
  FOR v_business_record IN
    SELECT id, name, created_by, email, created_at
    FROM businesses
    WHERE created_by = v_current_user_id
    ORDER BY created_at DESC
  LOOP
    v_count := v_count + 1;
    RAISE NOTICE '  %️⃣  Business ID: %', v_count, v_business_record.id;
    RAISE NOTICE '     Nombre: %', v_business_record.name;
    RAISE NOTICE '     Owner (created_by): %', v_business_record.created_by;
    RAISE NOTICE '     Email: %', v_business_record.email;
    RAISE NOTICE '     Creado: %', v_business_record.created_at;
    RAISE NOTICE '';
  END LOOP;
  
  IF v_count = 0 THEN
    RAISE NOTICE '  ❌ NO ERES OWNER DE NINGÚN NEGOCIO';
    RAISE NOTICE '';
  END IF;
  
  -- ===================================================
  -- NEGOCIOS CON TU EMAIL (pero diferente owner)
  -- ===================================================
  RAISE NOTICE '📧 NEGOCIOS CON TU EMAIL (pero owner diferente):';
  RAISE NOTICE '---------------------------------------------';
  
  v_count := 0;
  FOR v_business_record IN
    SELECT id, name, created_by, email, created_at
    FROM businesses
    WHERE email = v_user_email
      AND created_by != v_current_user_id
    ORDER BY created_at DESC
  LOOP
    v_count := v_count + 1;
    RAISE NOTICE '  ⚠️  Business ID: %', v_business_record.id;
    RAISE NOTICE '     Nombre: %', v_business_record.name;
    RAISE NOTICE '     Owner (created_by): % ⚠️ NO ERES TÚ', v_business_record.created_by;
    RAISE NOTICE '     Email: %', v_business_record.email;
    RAISE NOTICE '     Creado: %', v_business_record.created_at;
    RAISE NOTICE '';
  END LOOP;
  
  IF v_count > 0 THEN
    RAISE NOTICE '  ⚠️  PROBLEMA: Hay negocios con tu email pero owner diferente';
    RAISE NOTICE '      El fallback en Dashboard.jsx está cargando el negocio equivocado';
    RAISE NOTICE '';
  ELSE
    RAISE NOTICE '  ✅ No hay negocios con tu email y owner diferente';
    RAISE NOTICE '';
  END IF;
  
  -- ===================================================
  -- NEGOCIOS DONDE ERES EMPLEADO
  -- ===================================================
  RAISE NOTICE '👨‍💼 NEGOCIOS DONDE ERES EMPLEADO:';
  RAISE NOTICE '---------------------------------------------';
  
  v_count := 0;
  FOR v_business_record IN
    SELECT DISTINCT b.id, b.name, b.created_by, b.email, e.role, e.is_active, b.created_at
    FROM businesses b
    INNER JOIN employees e ON e.business_id = b.id
    WHERE e.user_id = v_current_user_id
    ORDER BY b.created_at DESC
  LOOP
    v_count := v_count + 1;
    RAISE NOTICE '  %️⃣  Business ID: %', v_count, v_business_record.id;
    RAISE NOTICE '     Nombre: %', v_business_record.name;
    RAISE NOTICE '     Owner (created_by): %', v_business_record.created_by;
    RAISE NOTICE '     Tu rol: %', v_business_record.role;
    RAISE NOTICE '     Activo: %', v_business_record.is_active;
    RAISE NOTICE '';
  END LOOP;
  
  IF v_count = 0 THEN
    RAISE NOTICE '  ❌ NO ERES EMPLEADO DE NINGÚN NEGOCIO';
    RAISE NOTICE '';
  END IF;
  
  -- ===================================================
  -- TODOS LOS NEGOCIOS (para comparar)
  -- ===================================================
  RAISE NOTICE '🌎 TODOS LOS NEGOCIOS EN LA BD:';
  RAISE NOTICE '---------------------------------------------';
  
  v_count := 0;
  FOR v_business_record IN
    SELECT id, name, created_by, email, created_at
    FROM businesses
    ORDER BY created_at DESC
    LIMIT 10
  LOOP
    v_count := v_count + 1;
    RAISE NOTICE '  %️⃣  Business ID: %', v_count, v_business_record.id;
    RAISE NOTICE '     Nombre: %', v_business_record.name;
    RAISE NOTICE '     Owner: %', v_business_record.created_by;
    RAISE NOTICE '     Email: %', v_business_record.email;
    
    IF v_business_record.created_by = v_current_user_id THEN
      RAISE NOTICE '     ✅ ERES EL OWNER';
    ELSIF v_business_record.email = v_user_email THEN
      RAISE NOTICE '     ⚠️  TU EMAIL, PERO NO ERES OWNER';
    END IF;
    
    RAISE NOTICE '';
  END LOOP;
  
  -- ===================================================
  -- RESUMEN Y RECOMENDACIONES
  -- ===================================================
  RAISE NOTICE '=============================================';
  RAISE NOTICE '💡 RECOMENDACIONES:';
  RAISE NOTICE '=============================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Si hay negocios con tu email pero owner diferente:';
  RAISE NOTICE '  1️⃣  Debes crear TU PROPIO NEGOCIO';
  RAISE NOTICE '  2️⃣  O el owner del negocio debe agregarte como empleado';
  RAISE NOTICE '  3️⃣  O eliminar el fallback por email en Dashboard.jsx';
  RAISE NOTICE '';
  RAISE NOTICE 'Si NO eres owner de ningún negocio:';
  RAISE NOTICE '  1️⃣  Ve a /register y crea tu negocio';
  RAISE NOTICE '  2️⃣  Asegúrate de usar el mismo email/cuenta';
  RAISE NOTICE '';
  RAISE NOTICE '=============================================';
  
END $$;
