-- 🔍 SCRIPT DE DEBUG PARA FECHAS
-- Ejecuta esto en Supabase SQL Editor para diagnosticar el problema

-- 1. Ver tipo actual de columnas created_at
SELECT 
  table_name, 
  column_name, 
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND column_name = 'created_at'
ORDER BY table_name;

-- 2. Ver ejemplos de fechas en sales
SELECT 
  id,
  created_at,
  created_at::text as created_at_texto,
  pg_typeof(created_at) as tipo_dato
FROM sales 
ORDER BY created_at DESC
LIMIT 5;

-- 3. Verificar si hay fechas NULL o inválidas
SELECT 
  COUNT(*) as total_ventas,
  COUNT(created_at) as con_fecha,
  COUNT(*) - COUNT(created_at) as sin_fecha
FROM sales;

-- 4. Si hay fechas NULL, actualizarlas con NOW()
-- ⚠️ Solo ejecutar si el query anterior muestra "sin_fecha" > 0
-- UPDATE sales SET created_at = NOW() WHERE created_at IS NULL;

-- 5. Ver ejemplo de fecha formateada
SELECT 
  id,
  created_at,
  to_char(created_at, 'DD Mon YYYY, HH24:MI') as formato_legible,
  created_at AT TIME ZONE 'America/Bogota' as hora_bogota
FROM sales 
ORDER BY created_at DESC
LIMIT 3;
