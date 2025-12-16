-- 🔍 SCRIPT DE DEBUG PARA PROBLEMAS DE RLS EN SUPPLIERS
-- Ejecuta esto en Supabase SQL Editor para diagnosticar

-- 1️⃣ Verificar función get_user_business_ids() existe y funciona
SELECT get_user_business_ids() as mis_business_ids;
-- Resultado esperado: Array de UUIDs de tus negocios

-- 2️⃣ Verificar que RLS está habilitado en suppliers
SELECT 
  schemaname, 
  tablename, 
  rowsecurity
FROM pg_tables 
WHERE tablename = 'suppliers';
-- rowsecurity debe ser 't' (true)

-- 3️⃣ Ver todas las políticas de suppliers
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'suppliers';

-- 4️⃣ Verificar si puedes ver suppliers (SELECT)
SELECT COUNT(*) as total_suppliers_visible FROM suppliers;

-- 5️⃣ Intentar insertar un proveedor de prueba (simulado)
-- Esto NO insertará nada, solo verifica si pasaría la política
DO $$
DECLARE
  v_business_id UUID;
  v_can_insert BOOLEAN;
BEGIN
  -- Obtener tu primer business_id
  SELECT business_id INTO v_business_id 
  FROM get_user_business_ids() 
  LIMIT 1;
  
  IF v_business_id IS NULL THEN
    RAISE NOTICE '❌ ERROR: No tienes acceso a ningún negocio';
    RAISE NOTICE 'Revisa la función get_user_business_ids()';
  ELSE
    RAISE NOTICE '✅ Business ID detectado: %', v_business_id;
    
    -- Verificar si el business_id está en get_user_business_ids()
    SELECT v_business_id = ANY(SELECT * FROM get_user_business_ids()) 
    INTO v_can_insert;
    
    IF v_can_insert THEN
      RAISE NOTICE '✅ Política INSERT pasaría: SÍ puedes crear proveedores en este negocio';
    ELSE
      RAISE NOTICE '❌ Política INSERT fallaría: NO tienes acceso a este business_id';
    END IF;
  END IF;
END $$;

-- 6️⃣ Ver detalles de tu usuario actual
SELECT 
  auth.uid() as mi_user_id,
  auth.email() as mi_email;

-- 7️⃣ Ver relación usuario-negocio (businesses)
SELECT 
  b.id as business_id,
  b.name as business_name,
  b.created_by,
  CASE 
    WHEN b.created_by = auth.uid() THEN 'Owner'
    ELSE 'No Owner'
  END as mi_rol_en_business
FROM businesses b
WHERE b.created_by = auth.uid();

-- 8️⃣ Ver relación usuario-negocio (employees)
SELECT 
  e.business_id,
  b.name as business_name,
  e.user_id,
  e.role,
  e.is_active,
  CASE 
    WHEN e.user_id = auth.uid() THEN 'Yo'
    ELSE 'Otro'
  END as es_mi_empleado
FROM employees e
LEFT JOIN businesses b ON e.business_id = b.id
WHERE e.user_id = auth.uid();

-- ✅ RESULTADO ESPERADO:
-- - Queries 1, 6, 7, 8 deben mostrar tus datos
-- - Query 5 debe decir "SÍ puedes crear proveedores"
-- - Si alguna falla, hay un problema de configuración

-- 🔧 POSIBLES SOLUCIONES:

-- Si no tienes business_id en get_user_business_ids():
-- 1. Verifica que exists un registro en 'businesses' donde created_by = tu user_id
-- 2. O verifica que exists un registro en 'employees' donde user_id = tu user_id AND is_active = true

-- Si get_user_business_ids() está vacío, ejecutar:
-- SELECT * FROM businesses WHERE created_by = auth.uid();
-- SELECT * FROM employees WHERE user_id = auth.uid();
