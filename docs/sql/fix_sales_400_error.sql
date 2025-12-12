-- =====================================================
-- DIAGNÓSTICO Y CORRECCIÓN: ERROR 400 POST /sales
-- =====================================================
-- Ejecutar en Supabase SQL Editor
-- =====================================================

-- PASO 1: VER ESTRUCTURA ACTUAL DE TABLA SALES
-- =====================================================
SELECT 
  column_name,
  data_type,
  character_maximum_length,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'sales'
ORDER BY ordinal_position;

-- PASO 2: VERIFICAR FOREIGN KEYS
-- =====================================================
SELECT
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'sales';

-- PASO 3: ELIMINAR CONSTRAINT FK A CUSTOMERS (SI EXISTE)
-- =====================================================
DO $$
BEGIN
  -- Eliminar FK a tabla customers
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'sales_customer_id_fkey'
      AND table_name = 'sales'
  ) THEN
    ALTER TABLE sales DROP CONSTRAINT sales_customer_id_fkey;
    RAISE NOTICE '✅ FK sales_customer_id_fkey eliminada';
  ELSE
    RAISE NOTICE 'ℹ️  FK sales_customer_id_fkey no existe';
  END IF;
END $$;

-- PASO 4: ELIMINAR COLUMNA CUSTOMER_ID (SI EXISTE)
-- =====================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sales'
      AND column_name = 'customer_id'
  ) THEN
    ALTER TABLE sales DROP COLUMN customer_id;
    RAISE NOTICE '✅ Columna customer_id eliminada';
  ELSE
    RAISE NOTICE 'ℹ️  Columna customer_id no existe';
  END IF;
END $$;

-- PASO 5: VERIFICAR COLUMNAS REQUERIDAS
-- =====================================================
DO $$
DECLARE
  missing_columns TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Verificar business_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sales'
      AND column_name = 'business_id'
  ) THEN
    missing_columns := array_append(missing_columns, 'business_id');
  END IF;

  -- Verificar user_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sales'
      AND column_name = 'user_id'
  ) THEN
    missing_columns := array_append(missing_columns, 'user_id');
  END IF;

  -- Verificar seller_name
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sales'
      AND column_name = 'seller_name'
  ) THEN
    missing_columns := array_append(missing_columns, 'seller_name');
  END IF;

  -- Verificar total
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sales'
      AND column_name = 'total'
  ) THEN
    missing_columns := array_append(missing_columns, 'total');
  END IF;

  -- Verificar payment_method
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sales'
      AND column_name = 'payment_method'
  ) THEN
    missing_columns := array_append(missing_columns, 'payment_method');
  END IF;

  IF array_length(missing_columns, 1) > 0 THEN
    RAISE EXCEPTION '❌ Faltan columnas: %', array_to_string(missing_columns, ', ');
  ELSE
    RAISE NOTICE '✅ Todas las columnas requeridas existen';
  END IF;
END $$;

-- PASO 6: VERIFICAR RLS
-- =====================================================
SELECT 
  schemaname,
  tablename,
  CASE WHEN rowsecurity THEN '🔒 HABILITADO' ELSE '🔓 DESHABILITADO' END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'sales';

-- PASO 7: VER POLÍTICAS RLS (SI EXISTEN)
-- =====================================================
SELECT 
  policyname,
  cmd as operacion,
  qual as condicion
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'sales';

-- PASO 8: TEST DE INSERT
-- =====================================================
-- REEMPLAZAR CON TUS VALORES REALES
DO $$
DECLARE
  test_business_id UUID := '3f2b775e-a4dd-432a-9913-b73d50238975';
  test_user_id UUID := '3382bbb1-0477-4950-bec0-6fccb74c111c';
  test_sale_id UUID;
BEGIN
  -- Intentar insert de prueba
  INSERT INTO sales (
    business_id,
    user_id,
    seller_name,
    total,
    payment_method
  ) VALUES (
    test_business_id,
    test_user_id,
    'Test Vendedor',
    1000.00,
    'cash'
  ) RETURNING id INTO test_sale_id;

  RAISE NOTICE '✅ INSERT exitoso! Sale ID: %', test_sale_id;

  -- Eliminar venta de prueba
  DELETE FROM sales WHERE id = test_sale_id;
  RAISE NOTICE '🧹 Venta de prueba eliminada';

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ ERROR en INSERT: %', SQLERRM;
    RAISE NOTICE '💡 Detalles: %', SQLSTATE;
END $$;

-- PASO 9: ESTRUCTURA FINAL ESPERADA
-- =====================================================
COMMENT ON TABLE sales IS 'Tabla de ventas - NO debe tener customer_id';

-- Verificar estructura final
SELECT 
  column_name,
  data_type,
  is_nullable,
  CASE 
    WHEN column_name = 'id' THEN '✅ PK auto-generado'
    WHEN column_name = 'business_id' THEN '✅ FK a businesses (requerido)'
    WHEN column_name = 'user_id' THEN '✅ FK a auth.users (opcional)'
    WHEN column_name = 'seller_name' THEN '✅ Nombre del vendedor'
    WHEN column_name = 'total' THEN '✅ Total de la venta'
    WHEN column_name = 'payment_method' THEN '✅ Método de pago'
    WHEN column_name = 'created_at' THEN '✅ Timestamp'
    WHEN column_name = 'customer_id' THEN '❌ NO DEBE EXISTIR'
    ELSE '⚠️  Columna adicional'
  END as nota
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'sales'
ORDER BY ordinal_position;

-- =====================================================
-- RESUMEN
-- =====================================================
/*
CAMBIOS REALIZADOS:
1. ✅ Verificada estructura de tabla sales
2. ✅ Eliminada FK a tabla customers (si existía)
3. ✅ Eliminada columna customer_id (si existía)
4. ✅ Verificadas todas las columnas requeridas
5. ✅ Verificado estado de RLS
6. ✅ Test de INSERT ejecutado

ESTRUCTURA FINAL:
- id (UUID, PK)
- business_id (UUID, FK a businesses, NOT NULL)
- user_id (UUID, FK a auth.users, nullable)
- seller_name (TEXT, nullable)
- total (NUMERIC, NOT NULL, default 0)
- payment_method (TEXT, nullable)
- created_at (TIMESTAMP, auto)

❌ NO DEBE TENER:
- customer_id (tabla customers eliminada)

CÓDIGO REACT CORRECTO:
const saleData = {
  business_id: businessId,
  user_id: user.id,
  seller_name: sellerName,
  total: total,
  payment_method: paymentMethod
};
// ❌ NO incluir customer_id
*/
