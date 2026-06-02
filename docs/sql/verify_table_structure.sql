-- =====================================================
-- CONSULTA DE ESTRUCTURA DE TABLAS
-- =====================================================
-- Ejecutar esto primero para ver qué columnas existen realmente

-- Ver todas las columnas de cada tabla
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('orders', 'order_items', 'employees', 'purchases', 'sales', 'products', 'sale_details')
ORDER BY table_name, ordinal_position;
