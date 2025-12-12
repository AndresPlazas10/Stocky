-- =====================================================
-- 🔍 DIAGNÓSTICO SIMPLE - VER TODO EN RESULTADOS
-- =====================================================

-- 1. ¿Existe get_my_business_ids?
SELECT 
  '1. FUNCIÓN' as diagnostico,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public' AND p.proname = 'get_my_business_ids'
    ) THEN '✅ EXISTE'
    ELSE '❌ NO EXISTE'
  END as estado;

-- 2. ¿RLS habilitado?
SELECT 
  '2. RLS' as diagnostico,
  CASE 
    WHEN relrowsecurity THEN '✅ HABILITADO'
    ELSE '❌ DESHABILITADO'
  END as estado
FROM pg_class
WHERE relname = 'employees';

-- 3. Políticas actuales
SELECT 
  '3. POLÍTICAS' as diagnostico,
  policyname,
  cmd as operacion
FROM pg_policies
WHERE tablename = 'employees'
ORDER BY cmd;

-- 4. Mis negocios
SELECT 
  '4. MIS NEGOCIOS' as diagnostico,
  id,
  name,
  CASE 
    WHEN created_by = auth.uid() THEN '✅ SOY OWNER'
    ELSE '❌ No soy owner'
  END as relacion
FROM businesses
WHERE created_by = auth.uid();

-- 5. ¿Cuántos negocios devuelve la función?
SELECT 
  '5. TEST FUNCIÓN' as diagnostico,
  get_my_business_ids() as business_id;

-- 6. Empleados visibles
SELECT 
  '6. EMPLEADOS VISIBLES' as diagnostico,
  COUNT(*) as total
FROM employees;

-- 7. RESUMEN
SELECT 
  '7. RESUMEN' as seccion,
  'Función existe: ' || CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_my_business_ids') THEN 'SÍ' ELSE 'NO' END as check1,
  'RLS habilitado: ' || CASE WHEN (SELECT relrowsecurity FROM pg_class WHERE relname = 'employees') THEN 'SÍ' ELSE 'NO' END as check2,
  'Políticas: ' || (SELECT COUNT(*)::text FROM pg_policies WHERE tablename = 'employees') as check3,
  'Negocios: ' || (SELECT COUNT(*)::text FROM businesses WHERE created_by = auth.uid()) as check4;
