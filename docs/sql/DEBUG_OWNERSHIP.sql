-- =====================================================
-- DIAGNÓSTICO: Verificar auth.uid() y ownership
-- =====================================================

DO $$
DECLARE
  v_current_user_id UUID;
  v_business_id UUID;
  v_business_owner UUID;
  v_is_owner BOOLEAN;
BEGIN
  RAISE NOTICE '=============================================';
  RAISE NOTICE '🔍 DIAGNÓSTICO: VERIFICAR OWNERSHIP';
  RAISE NOTICE '=============================================';
  RAISE NOTICE '';
  
  -- Obtener usuario actual
  SELECT auth.uid() INTO v_current_user_id;
  RAISE NOTICE 'Usuario actual (auth.uid()): %', v_current_user_id;
  RAISE NOTICE '';
  
  -- Listar negocios del usuario
  RAISE NOTICE '📋 NEGOCIOS DONDE ERES OWNER:';
  FOR v_business_id, v_business_owner IN 
    SELECT id, created_by FROM businesses WHERE created_by = v_current_user_id
  LOOP
    RAISE NOTICE '  Business ID: %', v_business_id;
    RAISE NOTICE '  Created by: %', v_business_owner;
    RAISE NOTICE '';
  END LOOP;
  
  -- Si no hay negocios
  IF NOT EXISTS (SELECT 1 FROM businesses WHERE created_by = v_current_user_id) THEN
    RAISE NOTICE '❌ NO ERES OWNER DE NINGÚN NEGOCIO';
    RAISE NOTICE '';
    RAISE NOTICE 'Negocios existentes:';
    FOR v_business_id, v_business_owner IN 
      SELECT id, created_by FROM businesses LIMIT 5
    LOOP
      RAISE NOTICE '  Business ID: %', v_business_id;
      RAISE NOTICE '  Owner ID: %', v_business_owner;
      RAISE NOTICE '  ¿Es tuyo?: %', v_business_owner = v_current_user_id;
      RAISE NOTICE '';
    END LOOP;
  END IF;
  
  RAISE NOTICE '=============================================';
END $$;

-- Test de la función is_user_owner_of_business
DO $$
DECLARE
  v_test_business_id UUID;
  v_result BOOLEAN;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🧪 TEST: is_user_owner_of_business()';
  RAISE NOTICE '';
  
  -- Obtener primer negocio del usuario
  SELECT id INTO v_test_business_id
  FROM businesses 
  WHERE created_by = auth.uid()
  LIMIT 1;
  
  IF v_test_business_id IS NULL THEN
    RAISE NOTICE '❌ No tienes negocios para probar';
    RETURN;
  END IF;
  
  RAISE NOTICE 'Probando con business_id: %', v_test_business_id;
  
  -- Probar función
  SELECT is_user_owner_of_business(v_test_business_id) INTO v_result;
  
  RAISE NOTICE 'Resultado: %', v_result;
  
  IF v_result THEN
    RAISE NOTICE '✅ La función funciona correctamente';
  ELSE
    RAISE NOTICE '❌ La función retorna FALSE (problema de auth.uid())';
  END IF;
  
  RAISE NOTICE '';
END $$;
