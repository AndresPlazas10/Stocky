-- =====================================================
-- VERIFICAR TODO ANTES DE CREAR EMPLEADO
-- =====================================================
-- Verifica que todo esté configurado correctamente
-- =====================================================

-- 1. ¿Existe la función create_employee?
SELECT 
  '🔧 FUNCIÓN create_employee' as verificacion,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_proc 
      WHERE proname = 'create_employee'
    ) THEN '✅ Existe'
    ELSE '❌ NO EXISTE - Ejecuta FUNCIONES_EMPLEADOS_SECURITY_DEFINER.sql'
  END as estado;

-- 2. ¿El usuario andres_plazas100 tiene negocio?
SELECT 
  '🏢 NEGOCIO de andres_plazas100' as verificacion,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM businesses 
      WHERE created_by = '60bc26ce-1356-4a6d-ba05-9a991ee8fce6'
    ) THEN '✅ Tiene negocio'
    ELSE '❌ NO TIENE NEGOCIO - Ejecuta CREAR_NEGOCIO_PARA_USUARIO_ACTUAL.sql'
  END as estado,
  (SELECT id FROM businesses WHERE created_by = '60bc26ce-1356-4a6d-ba05-9a991ee8fce6' LIMIT 1) as business_id,
  (SELECT name FROM businesses WHERE created_by = '60bc26ce-1356-4a6d-ba05-9a991ee8fce6' LIMIT 1) as business_name;

-- 3. ¿Existe la función is_user_owner_of_business?
SELECT 
  '🔧 FUNCIÓN is_user_owner_of_business' as verificacion,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_proc 
      WHERE proname = 'is_user_owner_of_business'
    ) THEN '✅ Existe'
    ELSE '❌ NO EXISTE - Ejecuta FIX_RECURSION_BUSINESSES_EMPLOYEES.sql'
  END as estado;

-- 4. ¿Hay políticas RLS en employees?
SELECT 
  '🔒 POLÍTICAS RLS en employees' as verificacion,
  COUNT(*) as total_politicas,
  STRING_AGG(policyname, ', ') as politicas
FROM pg_policies
WHERE tablename = 'employees';
