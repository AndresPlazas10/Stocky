-- =====================================================
-- SCRIPT DE VERIFICACIÓN RÁPIDA
-- =====================================================
-- Ejecutar PRIMERO antes de cualquier corrección
-- =====================================================

-- VERIFICACIÓN 1: ¿Existe la función?
-- =====================================================
SELECT 
  'VERIFICACIÓN 1: Función existe' as test,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ SÍ EXISTE'
    ELSE '❌ NO EXISTE - DEBE CREARSE'
  END as resultado
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'generate_invoice_number';

-- VERIFICACIÓN 2: ¿Tiene los permisos correctos?
-- =====================================================
SELECT 
  'VERIFICACIÓN 2: Permisos otorgados' as test,
  CASE 
    WHEN COUNT(*) >= 2 THEN '✅ PERMISOS OK (authenticated + anon)'
    WHEN COUNT(*) = 1 THEN '⚠️  PERMISOS PARCIALES (falta uno)'
    ELSE '❌ SIN PERMISOS - DEBE OTORGARSE GRANT EXECUTE'
  END as resultado,
  STRING_AGG(grantee, ', ') as roles_con_permiso
FROM information_schema.routine_privileges
WHERE routine_name = 'generate_invoice_number'
  AND routine_schema = 'public'
  AND privilege_type = 'EXECUTE';

-- VERIFICACIÓN 3: ¿Tiene SECURITY DEFINER?
-- =====================================================
SELECT 
  'VERIFICACIÓN 3: Security mode' as test,
  CASE 
    WHEN security_type = 'DEFINER' THEN '✅ SECURITY DEFINER (correcto)'
    ELSE '❌ SECURITY INVOKER (debe ser DEFINER)'
  END as resultado,
  security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'generate_invoice_number';

-- VERIFICACIÓN 4: ¿Existe la tabla invoices?
-- =====================================================
SELECT 
  'VERIFICACIÓN 4: Tabla invoices existe' as test,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ TABLA EXISTE'
    ELSE '❌ TABLA NO EXISTE - DEBE CREARSE'
  END as resultado,
  CASE 
    WHEN COUNT(*) > 0 THEN (SELECT COUNT(*)::TEXT || ' facturas registradas' FROM invoices)
    ELSE 'N/A'
  END as info_adicional
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'invoices';

-- VERIFICACIÓN 5: ¿Hay al menos un business_id válido?
-- =====================================================
SELECT 
  'VERIFICACIÓN 5: Business disponible' as test,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ HAY BUSINESSES (' || COUNT(*)::TEXT || ' registrados)'
    ELSE '❌ NO HAY BUSINESSES - DEBE REGISTRARSE UNO'
  END as resultado,
  (SELECT id::TEXT FROM businesses LIMIT 1) as business_id_ejemplo
FROM businesses;

-- VERIFICACIÓN 6: Test de ejecución
-- =====================================================
DO $$
DECLARE
  test_business_id UUID;
  result TEXT;
  error_message TEXT;
BEGIN
  -- Intentar obtener un business_id
  SELECT id INTO test_business_id FROM businesses LIMIT 1;
  
  IF test_business_id IS NULL THEN
    RAISE NOTICE '❌ VERIFICACIÓN 6: No hay business_id para testear';
    RETURN;
  END IF;

  -- Intentar ejecutar la función
  BEGIN
    SELECT generate_invoice_number(test_business_id) INTO result;
    RAISE NOTICE '✅ VERIFICACIÓN 6: Función ejecutada exitosamente!';
    RAISE NOTICE '   Business ID usado: %', test_business_id;
    RAISE NOTICE '   Número generado: %', result;
  EXCEPTION
    WHEN OTHERS THEN
      error_message := SQLERRM;
      RAISE NOTICE '❌ VERIFICACIÓN 6: Error al ejecutar función';
      RAISE NOTICE '   Error: %', error_message;
      RAISE NOTICE '   Código: %', SQLSTATE;
  END;
END $$;

-- =====================================================
-- RESUMEN DE RESULTADOS
-- =====================================================
-- Interpreta los resultados:
-- 
-- ✅ Todas las verificaciones OK → El problema está en el código React
-- ❌ Verificación 1 falla → La función no existe, ejecutar fix_generate_invoice_number_rpc.sql
-- ❌ Verificación 2 falla → Faltan permisos, ejecutar GRANT EXECUTE
-- ❌ Verificación 3 falla → Función sin SECURITY DEFINER, recrear función
-- ❌ Verificación 4 falla → Tabla invoices no existe, crear estructura de BD
-- ❌ Verificación 5 falla → No hay businesses, registrar uno primero
-- ❌ Verificación 6 falla → Revisar logs del error para más detalles
-- =====================================================
