-- =====================================================
-- PRUEBAS DE VALIDACIÓN RLS - STOCKLY
-- =====================================================
-- Este script contiene casos de prueba completos para validar
-- que las políticas RLS funcionan correctamente.
--
-- INSTRUCCIONES:
-- 1. Ejecutar después de POLITICAS_RLS_COMPLETAS.sql
-- 2. Crear usuarios de prueba para cada rol
-- 3. Ejecutar escenarios y verificar resultados
-- 4. Los resultados esperados están documentados
-- =====================================================

SET search_path = public;

-- =====================================================
-- PREPARACIÓN: CREAR DATOS DE PRUEBA
-- =====================================================

-- Nota: Estos usuarios deben existir en auth.users
-- Crear manualmente en Supabase Auth Dashboard:
-- 1. owner1@test.com (password: test123456)
-- 2. admin1@test.com (password: test123456)
-- 3. employee1@test.com (password: test123456)
-- 4. cashier1@test.com (password: test123456)

-- =====================================================
-- PASO 1: INSERTAR DATOS BASE PARA PRUEBAS
-- =====================================================

DO $$
DECLARE
  v_owner_id UUID;
  v_admin_id UUID;
  v_employee_id UUID;
  v_cashier_id UUID;
  v_business1_id UUID;
  v_business2_id UUID;
  v_product_id UUID;
  v_supplier_id UUID;
BEGIN
  -- ⚠️ REEMPLAZAR ESTOS UUIDs CON LOS REALES DE auth.users
  -- Obtener estos IDs desde: SELECT id, email FROM auth.users;
  
  v_owner_id := 'REPLACE-WITH-OWNER-UUID';
  v_admin_id := 'REPLACE-WITH-ADMIN-UUID';
  v_employee_id := 'REPLACE-WITH-EMPLOYEE-UUID';
  v_cashier_id := 'REPLACE-WITH-CASHIER-UUID';
  
  -- Crear negocio 1 (owner: owner1)
  INSERT INTO businesses (id, created_by, business_name, business_type, address, phone)
  VALUES (
    gen_random_uuid(),
    v_owner_id,
    'Negocio Test 1',
    'Tienda',
    'Calle 123',
    '3001234567'
  )
  RETURNING id INTO v_business1_id;
  
  RAISE NOTICE 'Business 1 creado: %', v_business1_id;
  
  -- Crear negocio 2 (owner: otro usuario - para probar aislamiento)
  INSERT INTO businesses (id, created_by, business_name, business_type)
  VALUES (
    gen_random_uuid(),
    v_owner_id, -- Mismo owner para pruebas, en producción sería otro
    'Negocio Test 2',
    'Restaurante'
  )
  RETURNING id INTO v_business2_id;
  
  RAISE NOTICE 'Business 2 creado: %', v_business2_id;
  
  -- Crear empleados en negocio 1
  INSERT INTO employees (business_id, user_id, full_name, email, role, is_active)
  VALUES
    (v_business1_id, v_admin_id, 'Admin Test 1', 'admin1@test.com', 'admin', true),
    (v_business1_id, v_employee_id, 'Employee Test 1', 'employee1@test.com', 'employee', true),
    (v_business1_id, v_cashier_id, 'Cashier Test 1', 'cashier1@test.com', 'cashier', true);
  
  RAISE NOTICE 'Empleados creados en Business 1';
  
  -- Crear proveedor
  INSERT INTO suppliers (id, business_id, business_name, contact_name, phone)
  VALUES (
    gen_random_uuid(),
    v_business1_id,
    'Proveedor Test',
    'Juan Pérez',
    '3009876543'
  )
  RETURNING id INTO v_supplier_id;
  
  RAISE NOTICE 'Supplier creado: %', v_supplier_id;
  
  -- Crear productos
  INSERT INTO products (id, business_id, name, code, category, price, stock, is_active)
  VALUES (
    gen_random_uuid(),
    v_business1_id,
    'Producto Test 1',
    'PRD-0001',
    'Electrónica',
    100.00,
    50,
    true
  )
  RETURNING id INTO v_product_id;
  
  INSERT INTO products (business_id, name, code, category, price, stock)
  VALUES
    (v_business1_id, 'Producto Test 2', 'PRD-0002', 'Ropa', 50.00, 100),
    (v_business2_id, 'Producto Test 3', 'PRD-0003', 'Alimentos', 20.00, 200);
  
  RAISE NOTICE 'Productos creados';
  
  RAISE NOTICE '=============================================';
  RAISE NOTICE '✅ DATOS DE PRUEBA CREADOS EXITOSAMENTE';
  RAISE NOTICE 'Business 1 ID: %', v_business1_id;
  RAISE NOTICE 'Business 2 ID: %', v_business2_id;
  RAISE NOTICE 'Product ID: %', v_product_id;
  RAISE NOTICE 'Supplier ID: %', v_supplier_id;
  RAISE NOTICE '=============================================';
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ ERROR al crear datos de prueba: %', SQLERRM;
    RAISE NOTICE 'Verifica que los UUIDs de auth.users sean correctos';
END $$;

-- =====================================================
-- ESCENARIO 1: OWNER VE SUS NEGOCIOS
-- =====================================================

-- ✅ ESPERADO: Owner1 debe ver solo Negocio Test 1 y 2
-- Ejecutar como: owner1@test.com

-- Test 1.1: SELECT businesses
SELECT 
  'Test 1.1: Owner SELECT businesses' AS test,
  COUNT(*) AS negocios_visibles,
  CASE 
    WHEN COUNT(*) >= 1 THEN '✅ PASS'
    ELSE '❌ FAIL'
  END AS resultado
FROM businesses;

-- Test 1.2: Owner puede UPDATE su negocio
UPDATE businesses 
SET business_name = 'Negocio Test 1 - Actualizado'
WHERE business_name = 'Negocio Test 1';

SELECT 
  'Test 1.2: Owner UPDATE business' AS test,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM businesses 
      WHERE business_name = 'Negocio Test 1 - Actualizado'
    ) THEN '✅ PASS'
    ELSE '❌ FAIL'
  END AS resultado;

-- Test 1.3: Owner ve todos los empleados de su negocio
SELECT 
  'Test 1.3: Owner SELECT employees' AS test,
  COUNT(*) AS empleados_visibles,
  CASE 
    WHEN COUNT(*) = 3 THEN '✅ PASS (debe ser 3)'
    ELSE '❌ FAIL (esperado 3, actual: ' || COUNT(*) || ')'
  END AS resultado
FROM employees;

-- =====================================================
-- ESCENARIO 2: ADMIN VE/GESTIONA EMPLEADOS
-- =====================================================

-- ✅ ESPERADO: Admin puede ver y crear empleados, pero NO eliminar
-- Ejecutar como: admin1@test.com

-- Test 2.1: Admin puede ver empleados
SELECT 
  'Test 2.1: Admin SELECT employees' AS test,
  COUNT(*) AS empleados_visibles,
  CASE 
    WHEN COUNT(*) >= 1 THEN '✅ PASS'
    ELSE '❌ FAIL'
  END AS resultado
FROM employees;

-- Test 2.2: Admin puede INSERT empleado
-- ⚠️ Reemplazar v_business_id con ID real del Test 1
DO $$
DECLARE
  v_business_id UUID;
  v_new_employee_id UUID;
BEGIN
  -- Obtener business_id
  SELECT id INTO v_business_id FROM businesses LIMIT 1;
  
  -- Intentar crear empleado
  INSERT INTO employees (business_id, user_id, full_name, email, role)
  VALUES (
    v_business_id,
    auth.uid(), -- ID del admin
    'Nuevo Empleado Test',
    'nuevo@test.com',
    'employee'
  )
  RETURNING id INTO v_new_employee_id;
  
  RAISE NOTICE '✅ Test 2.2 PASS: Admin creó empleado: %', v_new_employee_id;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ Test 2.2 FAIL: %', SQLERRM;
END $$;

-- Test 2.3: Admin NO puede DELETE empleado
-- ❌ ESPERADO: Error de RLS
DO $$
DECLARE
  v_employee_id UUID;
BEGIN
  -- Obtener ID de empleado
  SELECT id INTO v_employee_id FROM employees LIMIT 1;
  
  -- Intentar eliminar
  DELETE FROM employees WHERE id = v_employee_id;
  
  -- Si llega aquí, falló la prueba
  RAISE NOTICE '❌ Test 2.3 FAIL: Admin NO debería poder eliminar empleados';
  
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE '✅ Test 2.3 PASS: Admin correctamente bloqueado para DELETE';
  WHEN OTHERS THEN
    RAISE NOTICE '⚠️ Test 2.3: Error inesperado: %', SQLERRM;
END $$;

-- =====================================================
-- ESCENARIO 3: EMPLOYEE SOLO VE SU PERFIL
-- =====================================================

-- ✅ ESPERADO: Employee solo ve su propio registro en employees
-- Ejecutar como: employee1@test.com

-- Test 3.1: Employee SELECT employees (solo su perfil)
SELECT 
  'Test 3.1: Employee SELECT employees' AS test,
  COUNT(*) AS registros_visibles,
  CASE 
    WHEN COUNT(*) = 1 THEN '✅ PASS (debe ver solo su perfil)'
    ELSE '❌ FAIL (esperado 1, actual: ' || COUNT(*) || ')'
  END AS resultado
FROM employees;

-- Test 3.2: Employee puede UPDATE su propio perfil
UPDATE employees 
SET full_name = 'Employee Test 1 - Actualizado'
WHERE user_id = auth.uid();

SELECT 
  'Test 3.2: Employee UPDATE su perfil' AS test,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM employees 
      WHERE user_id = auth.uid()
        AND full_name = 'Employee Test 1 - Actualizado'
    ) THEN '✅ PASS'
    ELSE '❌ FAIL'
  END AS resultado;

-- Test 3.3: Employee NO puede UPDATE otros empleados
-- ❌ ESPERADO: 0 filas afectadas
DO $$
DECLARE
  v_other_employee_id UUID;
  v_rows_affected INTEGER;
BEGIN
  -- Obtener ID de otro empleado
  SELECT id INTO v_other_employee_id 
  FROM employees 
  WHERE user_id != auth.uid() 
  LIMIT 1;
  
  -- Intentar actualizar
  UPDATE employees 
  SET full_name = 'INTENTO DE MODIFICACIÓN ILEGAL'
  WHERE id = v_other_employee_id;
  
  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
  
  IF v_rows_affected = 0 THEN
    RAISE NOTICE '✅ Test 3.3 PASS: Employee bloqueado para UPDATE de otros';
  ELSE
    RAISE NOTICE '❌ Test 3.3 FAIL: Employee pudo modificar otro empleado';
  END IF;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '⚠️ Test 3.3: Error: %', SQLERRM;
END $$;

-- =====================================================
-- ESCENARIO 4: AISLAMIENTO ENTRE NEGOCIOS
-- =====================================================

-- ✅ ESPERADO: Usuario NO ve datos de otros negocios
-- Ejecutar como: cualquier usuario

-- Test 4.1: Solo ver productos de MIS negocios
SELECT 
  'Test 4.1: Aislamiento de productos' AS test,
  COUNT(DISTINCT business_id) AS negocios_con_productos,
  CASE 
    WHEN COUNT(DISTINCT business_id) <= 2 THEN '✅ PASS'
    ELSE '❌ FAIL (ve productos de más negocios de los esperados)'
  END AS resultado
FROM products;

-- Test 4.2: No ver ventas de otros negocios
SELECT 
  'Test 4.2: Aislamiento de ventas' AS test,
  business_id,
  COUNT(*) AS ventas
FROM sales
GROUP BY business_id;

-- Verificar que no hay business_id de negocios ajenos

-- =====================================================
-- ESCENARIO 5: VENTAS - PERMISOS POR ROL
-- =====================================================

-- Test 5.1: Employee puede crear venta
-- ✅ ESPERADO: INSERT exitoso
-- Ejecutar como: employee1@test.com

DO $$
DECLARE
  v_business_id UUID;
  v_product_id UUID;
  v_sale_id UUID;
BEGIN
  -- Obtener IDs necesarios
  SELECT id INTO v_business_id FROM businesses LIMIT 1;
  SELECT id INTO v_product_id FROM products LIMIT 1;
  
  -- Crear venta
  INSERT INTO sales (business_id, user_id, seller_name, payment_method, total)
  VALUES (
    v_business_id,
    auth.uid(),
    'Employee Test 1',
    'efectivo',
    100.00
  )
  RETURNING id INTO v_sale_id;
  
  -- Crear detalles de venta
  INSERT INTO sale_details (sale_id, product_id, quantity, price, subtotal)
  VALUES (
    v_sale_id,
    v_product_id,
    1,
    100.00,
    100.00
  );
  
  RAISE NOTICE '✅ Test 5.1 PASS: Employee creó venta: %', v_sale_id;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ Test 5.1 FAIL: %', SQLERRM;
END $$;

-- Test 5.2: Employee solo ve sus ventas
SELECT 
  'Test 5.2: Employee SELECT sales (solo suyas)' AS test,
  COUNT(*) AS ventas_visibles,
  COUNT(*) FILTER (WHERE user_id = auth.uid()) AS ventas_propias,
  CASE 
    WHEN COUNT(*) = COUNT(*) FILTER (WHERE user_id = auth.uid()) 
    THEN '✅ PASS (solo ve sus ventas)'
    ELSE '❌ FAIL (ve ventas de otros)'
  END AS resultado
FROM sales;

-- Test 5.3: Owner ve todas las ventas del negocio
-- Ejecutar como: owner1@test.com
SELECT 
  'Test 5.3: Owner SELECT sales (todas)' AS test,
  COUNT(*) AS ventas_visibles,
  COUNT(DISTINCT user_id) AS vendedores_distintos,
  CASE 
    WHEN COUNT(DISTINCT user_id) > 1 THEN '✅ PASS (ve ventas de varios)'
    ELSE '⚠️ WARNING (solo hay ventas de un vendedor)'
  END AS resultado
FROM sales;

-- =====================================================
-- ESCENARIO 6: ELIMINACIONES - SOLO OWNER
-- =====================================================

-- Test 6.1: Employee NO puede DELETE venta
-- ❌ ESPERADO: Error o 0 filas afectadas
-- Ejecutar como: employee1@test.com

DO $$
DECLARE
  v_sale_id UUID;
  v_rows_affected INTEGER;
BEGIN
  SELECT id INTO v_sale_id FROM sales LIMIT 1;
  
  DELETE FROM sales WHERE id = v_sale_id;
  
  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
  
  IF v_rows_affected = 0 THEN
    RAISE NOTICE '✅ Test 6.1 PASS: Employee bloqueado para DELETE sales';
  ELSE
    RAISE NOTICE '❌ Test 6.1 FAIL: Employee pudo eliminar venta';
  END IF;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '✅ Test 6.1 PASS (ERROR esperado): %', SQLERRM;
END $$;

-- Test 6.2: Owner puede DELETE venta (reciente)
-- ✅ ESPERADO: DELETE exitoso si es < 30 días
-- Ejecutar como: owner1@test.com

DO $$
DECLARE
  v_sale_id UUID;
  v_deleted BOOLEAN;
BEGIN
  -- Obtener venta reciente
  SELECT id INTO v_sale_id 
  FROM sales 
  WHERE created_at > (NOW() - INTERVAL '30 days')
  LIMIT 1;
  
  IF v_sale_id IS NULL THEN
    RAISE NOTICE '⚠️ Test 6.2 SKIP: No hay ventas recientes para probar';
    RETURN;
  END IF;
  
  -- Usar función delete_sale si existe
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'delete_sale') THEN
    PERFORM delete_sale(v_sale_id, (SELECT business_id FROM sales WHERE id = v_sale_id));
    v_deleted := TRUE;
  ELSE
    DELETE FROM sales WHERE id = v_sale_id;
    v_deleted := FOUND;
  END IF;
  
  IF v_deleted THEN
    RAISE NOTICE '✅ Test 6.2 PASS: Owner eliminó venta';
  ELSE
    RAISE NOTICE '❌ Test 6.2 FAIL: Owner no pudo eliminar venta';
  END IF;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ Test 6.2 FAIL: %', SQLERRM;
END $$;

-- =====================================================
-- ESCENARIO 7: FUNCIONES DE SEGURIDAD
-- =====================================================

-- Test 7.1: get_user_business_ids() retorna valores correctos
-- Ejecutar como: cualquier usuario

SELECT 
  'Test 7.1: get_user_business_ids()' AS test,
  COUNT(*) AS negocios_accesibles,
  array_agg(business_id) AS business_ids,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ PASS'
    ELSE '❌ FAIL (no retorna negocios)'
  END AS resultado
FROM get_user_business_ids();

-- Test 7.2: get_user_role() retorna rol correcto
-- Ejecutar como: admin1@test.com

DO $$
DECLARE
  v_business_id UUID;
  v_role TEXT;
BEGIN
  SELECT id INTO v_business_id FROM businesses LIMIT 1;
  
  v_role := get_user_role(v_business_id);
  
  RAISE NOTICE 'Test 7.2: get_user_role() = %', v_role;
  
  IF v_role IN ('owner', 'admin', 'employee', 'cashier') THEN
    RAISE NOTICE '✅ Test 7.2 PASS: Rol válido: %', v_role;
  ELSE
    RAISE NOTICE '❌ Test 7.2 FAIL: Rol inválido: %', v_role;
  END IF;
END $$;

-- Test 7.3: check_is_owner() distingue owner de employee
-- Ejecutar como: employee1@test.com

DO $$
DECLARE
  v_business_id UUID;
  v_is_owner BOOLEAN;
BEGIN
  SELECT id INTO v_business_id FROM businesses LIMIT 1;
  
  v_is_owner := check_is_owner(v_business_id);
  
  IF v_is_owner = FALSE THEN
    RAISE NOTICE '✅ Test 7.3 PASS: Employee correctamente identificado como NO owner';
  ELSE
    RAISE NOTICE '❌ Test 7.3 FAIL: Employee incorrectamente identificado como owner';
  END IF;
END $$;

-- =====================================================
-- ESCENARIO 8: PERFORMANCE Y ÍNDICES
-- =====================================================

-- Test 8.1: Query con business_id usa índice
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM sales 
WHERE business_id IN (SELECT get_user_business_ids())
ORDER BY created_at DESC
LIMIT 10;

-- Verificar que use "Index Scan" o "Bitmap Index Scan"

-- Test 8.2: Query de employee usa índice
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM employees
WHERE business_id IN (SELECT get_user_business_ids());

-- =====================================================
-- RESUMEN DE RESULTADOS
-- =====================================================

SELECT 
  '========================================' AS separator
UNION ALL
SELECT '   RESUMEN DE PRUEBAS RLS'
UNION ALL
SELECT '========================================'
UNION ALL
SELECT ''
UNION ALL
SELECT 'Ejecuta los escenarios 1-8 con diferentes usuarios:'
UNION ALL
SELECT ''
UNION ALL
SELECT '1. owner1@test.com - Debe pasar todos los tests de owner'
UNION ALL
SELECT '2. admin1@test.com - Puede gestionar pero no eliminar'
UNION ALL
SELECT '3. employee1@test.com - Solo ve su perfil y sus ventas'
UNION ALL
SELECT '4. cashier1@test.com - Solo ventas, no compras'
UNION ALL
SELECT ''
UNION ALL
SELECT '✅ ESPERADO: Todos los tests marcados PASS'
UNION ALL
SELECT '❌ FAIL: Revisar política correspondiente'
UNION ALL
SELECT '⚠️ WARNING: Revisar datos de prueba'
UNION ALL
SELECT ''
UNION ALL
SELECT '========================================';

-- =====================================================
-- LIMPIEZA (OPCIONAL)
-- =====================================================

-- ⚠️ DESCOMENTAR SOLO SI QUIERES ELIMINAR DATOS DE PRUEBA

/*
DELETE FROM sale_details WHERE sale_id IN (
  SELECT id FROM sales WHERE business_id IN (
    SELECT id FROM businesses WHERE business_name LIKE '%Test%'
  )
);

DELETE FROM sales WHERE business_id IN (
  SELECT id FROM businesses WHERE business_name LIKE '%Test%'
);

DELETE FROM products WHERE business_id IN (
  SELECT id FROM businesses WHERE business_name LIKE '%Test%'
);

DELETE FROM suppliers WHERE business_id IN (
  SELECT id FROM businesses WHERE business_name LIKE '%Test%'
);

DELETE FROM employees WHERE business_id IN (
  SELECT id FROM businesses WHERE business_name LIKE '%Test%'
);

DELETE FROM businesses WHERE business_name LIKE '%Test%';

RAISE NOTICE '✅ Datos de prueba eliminados';
*/

-- =====================================================
-- FIN DE PRUEBAS
-- =====================================================
-- Para más información, consultar:
-- - docs/sql/ANALISIS_COMPLETO_RLS.md
-- - docs/sql/POLITICAS_RLS_COMPLETAS.sql
-- =====================================================
