-- 🔍 SCRIPT DE DEBUG PARA VENTAS DESDE MESAS
-- Ejecuta esto en Supabase SQL Editor para verificar las ventas

-- 1️⃣ Ver las últimas 10 ventas ordenadas por created_at
SELECT 
  id,
  business_id,
  user_id,
  seller_name,
  total,
  payment_method,
  created_at,
  created_at AT TIME ZONE 'America/Bogota' as created_at_colombia
FROM sales
ORDER BY created_at DESC
LIMIT 10;

-- 2️⃣ Ver ventas creadas en los últimos 30 minutos
SELECT 
  id,
  seller_name,
  total,
  payment_method,
  created_at,
  NOW() - created_at as tiempo_desde_creacion
FROM sales
WHERE created_at > NOW() - INTERVAL '30 minutes'
ORDER BY created_at DESC;

-- 3️⃣ Ver si hay ventas con created_at NULL
SELECT COUNT(*) as ventas_sin_fecha
FROM sales
WHERE created_at IS NULL;

-- 4️⃣ Verificar columnas de la tabla sales
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'sales'
ORDER BY ordinal_position;

-- 5️⃣ Ver sale_details de las últimas ventas
SELECT 
  s.id as sale_id,
  s.seller_name,
  s.total,
  s.created_at,
  sd.product_id,
  sd.quantity,
  sd.unit_price
FROM sales s
LEFT JOIN sale_details sd ON s.id = sd.sale_id
ORDER BY s.created_at DESC
LIMIT 20;

-- 6️⃣ Verificar si RLS está interfiriendo
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename = 'sales';

-- 7️⃣ Ver políticas RLS de sales
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'sales';
