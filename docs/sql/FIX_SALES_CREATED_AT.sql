-- ============================================================
-- FIX COMPLETO: Asegurar que created_at siempre tiene valor
-- ============================================================

-- PASO 1: Asegurar que el DEFAULT está configurado
ALTER TABLE public.sales
ALTER COLUMN created_at SET DEFAULT NOW();

-- PASO 2: Actualizar todos los NULL a NOW() (o fecha estimada)
UPDATE public.sales 
SET created_at = COALESCE(created_at, NOW() - INTERVAL '1 day')
WHERE created_at IS NULL;

-- PASO 3: Verificar que se actualizaron
SELECT 
  COUNT(*) as total_sales,
  COUNT(created_at) as with_created_at,
  COUNT(*) FILTER (WHERE created_at IS NULL) as null_created_at
FROM public.sales;

-- PASO 4: Ver ejemplos de ventas actualizadas
SELECT 
  id,
  business_id,
  total,
  created_at,
  (NOW() - created_at) as "time_since_creation"
FROM public.sales
ORDER BY created_at DESC
LIMIT 5;

-- PASO 5: Agregar constraint para evitar NULL en el futuro
ALTER TABLE public.sales
ALTER COLUMN created_at SET NOT NULL;

-- ============================================================
-- VERIFICACIÓN FINAL
-- ============================================================
-- Ejecutar esta query en el cliente para comprobar:
-- SELECT id, created_at FROM sales WHERE business_id = '<your-business-id>' LIMIT 10;
