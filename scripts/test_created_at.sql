-- ============================================================
-- TEST DIRECTO: Verificar que created_at se guarda correctamente
-- ============================================================
-- Ejecutar este script en Supabase SQL Editor

-- 1. Verificar estructura de la columna
SELECT 
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'sales' AND column_name = 'created_at';

-- 2. Verificar que tabla tiene RLS
SELECT 
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename = 'sales';

-- 3. Listar políticas RLS en sales
SELECT 
  policyname,
  permissive,
  roles,
  qual
FROM pg_policies
WHERE tablename = 'sales'
LIMIT 10;

-- 4. Ver últimas 3 ventas y sus fechas
SELECT 
  id,
  created_at,
  updated_at,
  business_id,
  user_id,
  total,
  payment_method
FROM sales
ORDER BY created_at DESC
LIMIT 3;

-- 5. Buscar NULL en created_at
SELECT 
  COUNT(*) as total_sales,
  COUNT(created_at) as with_created_at,
  COUNT(*) - COUNT(created_at) as missing_created_at
FROM sales;

-- 6. Buscar valores extremos en created_at
SELECT 
  MIN(created_at) as earliest_sale,
  MAX(created_at) as latest_sale,
  NOW() as current_time
FROM sales;

-- 7. Comprobar que el DEFAULT está activo
ALTER TABLE sales
ALTER COLUMN created_at SET DEFAULT NOW();

-- 8. Verificar triggers en sales
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'sales'
LIMIT 10;

-- ============================================================
-- Si created_at es NULL, ejecutar esto:
-- ============================================================
-- UPDATE sales 
-- SET created_at = NOW() 
-- WHERE created_at IS NULL;
