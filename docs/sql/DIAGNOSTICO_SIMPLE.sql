-- =====================================================
-- DIAGNÓSTICO SIMPLE - Ver estructura de tablas clave
-- =====================================================
-- Ejecuta esta query para ver todas las columnas
-- de employees y sales en un solo resultado
-- =====================================================

SELECT 
  'EMPLOYEES' AS tabla,
  ordinal_position AS posicion,
  column_name AS columna,
  data_type AS tipo,
  is_nullable AS permite_null,
  column_default AS valor_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'employees'

UNION ALL

SELECT 
  '---SEPARADOR---' AS tabla,
  0 AS posicion,
  '---SEPARADOR---' AS columna,
  '---SEPARADOR---' AS tipo,
  '---SEPARADOR---' AS permite_null,
  '---SEPARADOR---' AS valor_default

UNION ALL

SELECT 
  'SALES' AS tabla,
  ordinal_position AS posicion,
  column_name AS columna,
  data_type AS tipo,
  is_nullable AS permite_null,
  column_default AS valor_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'sales'

ORDER BY tabla DESC, posicion;
