-- =====================================================
-- OBTENER SCHEMA COMPLETO DE TODAS LAS TABLAS
-- =====================================================
-- Este script muestra todas las tablas y sus columnas
-- con tipos de datos, restricciones, valores por defecto, etc.
-- =====================================================

-- PARTE 1: Lista de todas las tablas
-- =====================================================
SELECT 
  schemaname,
  tablename,
  tableowner
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- PARTE 2: Columnas de cada tabla con detalles completos
-- =====================================================
SELECT 
  t.table_name AS tabla,
  c.column_name AS columna,
  c.ordinal_position AS posicion,
  c.data_type AS tipo,
  c.character_maximum_length AS longitud_max,
  c.is_nullable AS nullable,
  c.column_default AS valor_default,
  CASE 
    WHEN pk.column_name IS NOT NULL THEN 'PK'
    WHEN fk.column_name IS NOT NULL THEN 'FK → ' || fk.foreign_table_name || '(' || fk.foreign_column_name || ')'
    ELSE ''
  END AS constraint_type
FROM information_schema.tables t
LEFT JOIN information_schema.columns c 
  ON t.table_name = c.table_name 
  AND t.table_schema = c.table_schema
LEFT JOIN (
  SELECT 
    tc.table_name,
    kcu.column_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  WHERE tc.constraint_type = 'PRIMARY KEY'
    AND tc.table_schema = 'public'
) pk ON c.table_name = pk.table_name AND c.column_name = pk.column_name
LEFT JOIN (
  SELECT 
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
) fk ON c.table_name = fk.table_name AND c.column_name = fk.column_name
WHERE t.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name, c.ordinal_position;

-- PARTE 3: Restricciones NOT NULL por tabla
-- =====================================================
SELECT 
  table_name AS tabla,
  column_name AS columna_obligatoria
FROM information_schema.columns
WHERE table_schema = 'public'
  AND is_nullable = 'NO'
  AND column_default IS NULL  -- Sin valor por defecto
ORDER BY table_name, ordinal_position;

-- PARTE 4: Foreign Keys detalladas
-- =====================================================
SELECT 
  tc.table_name AS tabla_origen,
  kcu.column_name AS columna_origen,
  ccu.table_name AS tabla_destino,
  ccu.column_name AS columna_destino,
  tc.constraint_name AS nombre_constraint
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

-- PARTE 5: Índices de cada tabla
-- =====================================================
SELECT 
  schemaname,
  tablename AS tabla,
  indexname AS indice,
  indexdef AS definicion
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- PARTE 6: Políticas RLS activas
-- =====================================================
SELECT 
  schemaname,
  tablename AS tabla,
  policyname AS politica,
  permissive,
  roles,
  cmd AS operacion,
  CASE 
    WHEN qual IS NOT NULL THEN 'USING: ' || qual
    ELSE ''
  END AS condicion_using,
  CASE 
    WHEN with_check IS NOT NULL THEN 'WITH CHECK: ' || with_check
    ELSE ''
  END AS condicion_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- PARTE 7: Tablas con RLS habilitado
-- =====================================================
SELECT 
  schemaname,
  tablename AS tabla,
  CASE 
    WHEN rowsecurity THEN '✅ HABILITADO'
    ELSE '❌ DESHABILITADO'
  END AS rls_status
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- PARTE 8: Estructura específica de tablas principales
-- =====================================================

-- BUSINESSES
SELECT 'BUSINESSES' as tabla, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'businesses' AND table_schema = 'public'
ORDER BY ordinal_position;

-- EMPLOYEES
SELECT 'EMPLOYEES' as tabla, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'employees' AND table_schema = 'public'
ORDER BY ordinal_position;

-- PRODUCTS
SELECT 'PRODUCTS' as tabla, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'products' AND table_schema = 'public'
ORDER BY ordinal_position;

-- SALES
SELECT 'SALES' as tabla, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'sales' AND table_schema = 'public'
ORDER BY ordinal_position;

-- SALE_DETAILS
SELECT 'SALE_DETAILS' as tabla, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'sale_details' AND table_schema = 'public'
ORDER BY ordinal_position;

-- PURCHASES
SELECT 'PURCHASES' as tabla, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'purchases' AND table_schema = 'public'
ORDER BY ordinal_position;

-- PURCHASE_DETAILS
SELECT 'PURCHASE_DETAILS' as tabla, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'purchase_details' AND table_schema = 'public'
ORDER BY ordinal_position;

-- SUPPLIERS
SELECT 'SUPPLIERS' as tabla, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'suppliers' AND table_schema = 'public'
ORDER BY ordinal_position;

-- INVOICES
SELECT 'INVOICES' as tabla, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'invoices' AND table_schema = 'public'
ORDER BY ordinal_position;

-- INVOICE_ITEMS
SELECT 'INVOICE_ITEMS' as tabla, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'invoice_items' AND table_schema = 'public'
ORDER BY ordinal_position;

-- TABLES (mesas)
SELECT 'TABLES' as tabla, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'tables' AND table_schema = 'public'
ORDER BY ordinal_position;

-- ORDERS
SELECT 'ORDERS' as tabla, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'orders' AND table_schema = 'public'
ORDER BY ordinal_position;

-- ORDER_ITEMS
SELECT 'ORDER_ITEMS' as tabla, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'order_items' AND table_schema = 'public'
ORDER BY ordinal_position;

-- USERS
SELECT 'USERS' as tabla, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'users' AND table_schema = 'public'
ORDER BY ordinal_position;

-- =====================================================
-- PARTE 9: Triggers activos
-- =====================================================
SELECT 
  event_object_table AS tabla,
  trigger_name AS trigger,
  event_manipulation AS evento,
  action_statement AS accion
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- =====================================================
-- PARTE 10: Funciones custom
-- =====================================================
SELECT 
  n.nspname AS schema,
  p.proname AS funcion,
  pg_get_function_arguments(p.oid) AS argumentos,
  pg_get_functiondef(p.oid) AS definicion
FROM pg_proc p
LEFT JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
ORDER BY p.proname;

-- =====================================================
-- INSTRUCCIONES DE USO
-- =====================================================
/*
Para obtener toda la información del schema:

1. Copia TODO este archivo
2. Pega en Supabase SQL Editor
3. Ejecuta sección por sección (selecciona una query y ejecuta)
   O ejecuta todo de una vez

4. Para exportar resultados:
   - Click en "Results" 
   - Click en "..." (menú)
   - "Download as CSV"

5. Envíame los resultados de estas queries principales:
   - PARTE 2 (columnas completas)
   - PARTE 3 (columnas NOT NULL)
   - PARTE 4 (Foreign Keys)
   - PARTE 7 (RLS status)
   - PARTE 8 (estructura de SALES específicamente)
*/
