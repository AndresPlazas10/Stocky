-- =====================================================
-- LIMPIAR DATOS DE PRUEBA (Diciembre 11-12, 2025)
-- =====================================================
-- Este script elimina negocios y usuarios de prueba
-- creados durante el debugging del problema de RLS
-- =====================================================

-- PASO 1: Ver qué negocios fueron creados durante las pruebas
-- =====================================================
SELECT 
  id,
  name,
  created_by,
  created_at,
  CASE 
    WHEN created_at::date = '2025-12-11' THEN '🔴 Creado durante debugging'
    WHEN created_at::date = '2025-12-12' THEN '🔴 Creado durante debugging'
    ELSE '✅ Negocio legítimo'
  END as status
FROM businesses
ORDER BY created_at DESC;

-- PASO 2: Ver empleados asociados a esos negocios
-- =====================================================
SELECT 
  e.id,
  e.email,
  e.full_name,
  b.name as business_name,
  e.created_at,
  CASE 
    WHEN e.created_at::date IN ('2025-12-11', '2025-12-12') THEN '🔴 Empleado de prueba'
    ELSE '✅ Empleado real'
  END as status
FROM employees e
JOIN businesses b ON b.id = e.business_id
ORDER BY e.created_at DESC;

-- PASO 3: Ver usuarios huérfanos (sin negocio asociado)
-- =====================================================
SELECT 
  au.id,
  au.email,
  au.created_at,
  CASE 
    WHEN EXISTS (SELECT 1 FROM businesses WHERE created_by = au.id) THEN '✅ Tiene negocio'
    WHEN EXISTS (SELECT 1 FROM employees WHERE user_id = au.id) THEN '✅ Es empleado'
    ELSE '🔴 Usuario huérfano'
  END as status
FROM auth.users au
ORDER BY au.created_at DESC
LIMIT 20;

-- =====================================================
-- OPCIÓN A: ELIMINAR SOLO NEGOCIOS DE PRUEBA (SEGURO)
-- =====================================================
-- Esto eliminará negocios creados el 11 y 12 de diciembre
-- Y en cascada eliminará empleados, productos, ventas, etc.

/*
-- Descomenta estas líneas si estás SEGURO de eliminar:

DELETE FROM businesses 
WHERE created_at::date IN ('2025-12-11', '2025-12-12')
  AND name LIKE '%test%'  -- Solo elimina si tiene "test" en el nombre
RETURNING id, name, created_at;

*/

-- =====================================================
-- OPCIÓN B: ELIMINAR NEGOCIO ESPECÍFICO POR ID
-- =====================================================
-- Reemplaza 'TU-BUSINESS-ID-AQUI' con el ID del negocio de prueba

/*
-- Descomenta si quieres eliminar un negocio específico:

DELETE FROM businesses 
WHERE id = 'TU-BUSINESS-ID-AQUI'
RETURNING id, name, created_at;

*/

-- =====================================================
-- OPCIÓN C: ELIMINAR EMPLEADOS DE PRUEBA
-- =====================================================
-- Eliminar empleados con emails de prueba

/*
-- Descomenta para eliminar empleados de prueba:

DELETE FROM employees 
WHERE email LIKE '%test%' 
  OR email LIKE '%prueba%'
  OR created_at::date IN ('2025-12-11', '2025-12-12')
RETURNING id, email, full_name, created_at;

*/

-- =====================================================
-- OPCIÓN D: LIMPIAR USUARIOS HUÉRFANOS (AVANZADO)
-- =====================================================
-- CUIDADO: Esto requiere acceso directo a auth.users
-- Solo ejecutar si estás SEGURO

/*
-- Ver usuarios huérfanos primero:
SELECT 
  au.id,
  au.email,
  au.created_at
FROM auth.users au
WHERE NOT EXISTS (SELECT 1 FROM businesses WHERE created_by = au.id)
  AND NOT EXISTS (SELECT 1 FROM employees WHERE user_id = au.id)
  AND au.created_at::date IN ('2025-12-11', '2025-12-12');

-- Si quieres eliminarlos, usa Supabase Dashboard:
-- Authentication → Users → Buscar usuario → Delete User
*/

-- =====================================================
-- OPCIÓN E: RESETEAR TODO Y EMPEZAR LIMPIO (NUCLEAR)
-- =====================================================
-- ⚠️ SOLO USAR EN DESARROLLO - ELIMINA TODO

/*
-- ⚠️ PELIGRO: Esto eliminará TODOS los datos

TRUNCATE TABLE businesses CASCADE;
-- Esto eliminará:
-- - Todos los negocios
-- - Todos los empleados
-- - Todos los productos
-- - Todas las ventas
-- - Todas las compras
-- - Todos los clientes
-- - Todas las facturas
-- etc.

-- Luego necesitarás borrar usuarios manualmente en:
-- Supabase Dashboard → Authentication → Users
*/

-- =====================================================
-- RECOMENDACIÓN: ENFOQUE PASO A PASO
-- =====================================================

-- 1. Primero, IDENTIFICA negocios de prueba:
SELECT 
  id,
  name,
  created_at
FROM businesses
WHERE created_at::date IN ('2025-12-11', '2025-12-12')
ORDER BY created_at DESC;

-- 2. Verifica QUÉ datos tienen esos negocios:
-- Reemplaza 'BUSINESS-ID-AQUI' con el ID del paso anterior
/*
SELECT 'products' as tabla, COUNT(*) as cantidad FROM products WHERE business_id = 'BUSINESS-ID-AQUI'
UNION ALL
SELECT 'sales', COUNT(*) FROM sales WHERE business_id = 'BUSINESS-ID-AQUI'
UNION ALL
SELECT 'employees', COUNT(*) FROM employees WHERE business_id = 'BUSINESS-ID-AQUI'
UNION ALL
SELECT 'purchases', COUNT(*) FROM purchases WHERE business_id = 'BUSINESS-ID-AQUI';
*/

-- 3. Si está vacío o solo tiene datos de prueba, elimínalo:
-- DELETE FROM businesses WHERE id = 'BUSINESS-ID-AQUI';

-- =====================================================
-- SCRIPT DE LIMPIEZA AUTOMÁTICA (Recomendado)
-- =====================================================
-- Este script elimina negocios de prueba de forma segura

DO $$
DECLARE
  test_business RECORD;
  deleted_count INTEGER := 0;
BEGIN
  -- Buscar negocios creados el 11 o 12 de diciembre con "test" en el nombre
  FOR test_business IN 
    SELECT id, name, created_at 
    FROM businesses 
    WHERE created_at::date IN ('2025-12-11', '2025-12-12')
      AND (
        name ILIKE '%test%' 
        OR name ILIKE '%prueba%'
        OR name ILIKE '%demo%'
      )
  LOOP
    -- Eliminar el negocio (en cascada elimina todo lo relacionado)
    DELETE FROM businesses WHERE id = test_business.id;
    deleted_count := deleted_count + 1;
    
    RAISE NOTICE 'Eliminado: % (ID: %, Creado: %)', 
      test_business.name, 
      test_business.id, 
      test_business.created_at;
  END LOOP;
  
  RAISE NOTICE 'Total eliminados: % negocios de prueba', deleted_count;
END $$;

-- =====================================================
-- VERIFICACIÓN FINAL
-- =====================================================

-- Ver cuántos negocios quedan
SELECT COUNT(*) as total_businesses FROM businesses;

-- Ver cuántos empleados quedan
SELECT COUNT(*) as total_employees FROM employees;

-- Ver usuarios sin negocio ni rol de empleado
SELECT COUNT(*) as orphan_users
FROM auth.users au
WHERE NOT EXISTS (SELECT 1 FROM businesses WHERE created_by = au.id)
  AND NOT EXISTS (SELECT 1 FROM employees WHERE user_id = au.id);

-- =====================================================
-- NOTAS IMPORTANTES
-- =====================================================
/*
1. SIEMPRE ejecuta las consultas SELECT primero para ver qué se eliminará
2. Los DELETE CASCADE eliminarán automáticamente:
   - Empleados del negocio
   - Productos del negocio
   - Ventas del negocio
   - Compras del negocio
   - Facturas del negocio
   - Clientes del negocio
3. Para eliminar usuarios de auth.users, debes hacerlo desde:
   Supabase Dashboard → Authentication → Users
4. Si eliminas un negocio por error, NO hay undo
   - Haz backup antes si tienes dudas
5. El script automático solo elimina negocios con "test"/"prueba"/"demo" en el nombre
*/
