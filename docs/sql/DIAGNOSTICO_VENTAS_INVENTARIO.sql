-- =====================================================
-- 🔍 SCRIPT DE DIAGNÓSTICO: VENTAS E INVENTARIO
-- =====================================================
-- Ejecutar en Supabase SQL Editor
-- Detecta inconsistencias en stock, ventas y compras
-- =====================================================

-- =====================================================
-- 1. VERIFICAR STOCK NEGATIVO (CRÍTICO)
-- =====================================================
SELECT 
  '❌ PRODUCTOS CON STOCK NEGATIVO' as diagnostico;

SELECT 
  id,
  code,
  name,
  stock,
  category,
  business_id,
  created_at
FROM products
WHERE stock < 0
ORDER BY stock ASC;

-- Si devuelve filas: PROBLEMA GRAVE
-- Stock negativo indica race conditions o ventas sin validación

-- =====================================================
-- 2. VERIFICAR VENTAS SIN DESCUENTO DE STOCK
-- =====================================================
SELECT 
  '🔍 ANÁLISIS: ¿Las ventas reducen stock?' as diagnostico;

-- Comparar stock antes/después de ventas recientes
WITH ventas_ultimas_24h AS (
  SELECT 
    sd.product_id,
    p.name as product_name,
    p.code,
    SUM(sd.quantity) as total_vendido,
    COUNT(DISTINCT s.id) as num_ventas,
    MIN(s.created_at) as primera_venta,
    MAX(s.created_at) as ultima_venta
  FROM sales s
  JOIN sale_details sd ON s.id = sd.sale_id
  JOIN products p ON sd.product_id = p.id
  WHERE s.created_at >= NOW() - INTERVAL '24 hours'
  GROUP BY sd.product_id, p.name, p.code
)
SELECT 
  v.code,
  v.product_name,
  p.stock as stock_actual,
  v.total_vendido as vendido_ultimas_24h,
  v.num_ventas,
  p.stock + v.total_vendido as stock_esperado_antes,
  v.primera_venta,
  v.ultima_venta,
  CASE 
    WHEN p.stock = (p.stock + v.total_vendido) 
    THEN '❌ VENTAS NO REDUCEN STOCK'
    ELSE '✅ Stock se redujo correctamente'
  END as estado
FROM products p
JOIN ventas_ultimas_24h v ON p.id = v.product_id
ORDER BY v.total_vendido DESC;

-- Si columna 'estado' muestra "❌ VENTAS NO REDUCEN STOCK":
--   → Las ventas NO están reduciendo el inventario
--   → Stock actual = Stock esperado antes (no cambió)

-- =====================================================
-- 3. VERIFICAR COMPRAS Y STOCK
-- =====================================================
SELECT 
  '🔍 ANÁLISIS: ¿Las compras aumentan stock?' as diagnostico;

WITH compras_ultima_semana AS (
  SELECT 
    pd.product_id,
    pr.name as product_name,
    pr.code,
    SUM(pd.quantity) as total_comprado,
    COUNT(DISTINCT p.id) as num_compras,
    MAX(p.created_at) as ultima_compra
  FROM purchases p
  JOIN purchase_details pd ON p.id = pd.purchase_id
  JOIN products pr ON pd.product_id = pr.id
  WHERE p.created_at >= NOW() - INTERVAL '7 days'
  GROUP BY pd.product_id, pr.name, pr.code
)
SELECT 
  c.code,
  c.product_name,
  pr.stock as stock_actual,
  c.total_comprado as comprado_ultima_semana,
  c.num_compras,
  c.ultima_compra,
  pr.stock - c.total_comprado as stock_antes_compras_aprox
FROM products pr
JOIN compras_ultima_semana c ON pr.id = c.product_id
ORDER BY c.ultima_compra DESC;

-- =====================================================
-- 4. DETECTAR INCONSISTENCIAS CRÍTICAS
-- =====================================================
SELECT 
  '⚠️ INCONSISTENCIAS DETECTADAS' as diagnostico;

-- Productos con ventas pero stock no disminuyó
WITH product_sales AS (
  SELECT 
    sd.product_id,
    COUNT(*) as num_ventas,
    SUM(sd.quantity) as qty_vendida
  FROM sale_details sd
  GROUP BY sd.product_id
)
SELECT 
  p.code,
  p.name,
  p.stock,
  ps.qty_vendida as total_vendido_historico,
  ps.num_ventas,
  CASE 
    WHEN p.stock >= ps.qty_vendida 
    THEN '⚠️ Stock NO se redujo con ventas'
    ELSE '✅ Consistente'
  END as estado
FROM products p
JOIN product_sales ps ON p.id = ps.product_id
WHERE p.stock >= ps.qty_vendida  -- Solo mostrar inconsistentes
ORDER BY ps.qty_vendida DESC
LIMIT 20;

-- =====================================================
-- 5. VERIFICAR FUNCIONES RPC EXISTEN
-- =====================================================
SELECT 
  '🔧 VERIFICACIÓN: Funciones RPC necesarias' as diagnostico;

SELECT 
  routine_name as funcion,
  routine_type as tipo,
  CASE 
    WHEN routine_name IN ('reduce_stock', 'increase_stock', 'generate_invoice_number') 
    THEN '✅ Necesaria'
    ELSE 'ℹ️ Opcional'
  END as estado
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_type = 'FUNCTION'
  AND routine_name LIKE '%stock%' 
   OR routine_name LIKE '%invoice%'
ORDER BY routine_name;

-- Esperado: reduce_stock, increase_stock, generate_invoice_number

-- =====================================================
-- 6. VERIFICAR TRIGGERS AUTOMÁTICOS
-- =====================================================
SELECT 
  '🔧 VERIFICACIÓN: Triggers de stock automáticos' as diagnostico;

SELECT 
  trigger_name,
  event_object_table as tabla,
  event_manipulation as evento,
  action_timing as momento,
  action_statement as accion
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table IN ('sale_details', 'purchase_details', 'invoice_items')
ORDER BY event_object_table, trigger_name;

-- Si NO hay resultados: triggers NO están configurados
-- → Stock se debe manejar manualmente (vulnerable)

-- =====================================================
-- 7. ANÁLISIS DE FACTURAS VS VENTAS
-- =====================================================
SELECT 
  '📊 ANÁLISIS: Facturas generadas desde ventas' as diagnostico;

-- Detectar si se generan facturas duplicadas
WITH facturas_por_venta AS (
  SELECT 
    s.id as sale_id,
    s.created_at as venta_fecha,
    s.total as venta_total,
    COUNT(i.id) as num_facturas,
    STRING_AGG(i.invoice_number, ', ') as facturas
  FROM sales s
  LEFT JOIN invoices i ON DATE(s.created_at) = DATE(i.issued_at) 
    AND ABS(s.total - i.total) < 0.01  -- Aproximar por total similar
  WHERE s.created_at >= NOW() - INTERVAL '30 days'
  GROUP BY s.id, s.created_at, s.total
)
SELECT 
  sale_id,
  venta_fecha,
  venta_total,
  num_facturas,
  facturas,
  CASE 
    WHEN num_facturas = 0 THEN 'Sin factura'
    WHEN num_facturas = 1 THEN '✅ OK'
    WHEN num_facturas > 1 THEN '⚠️ Múltiples facturas para 1 venta'
  END as estado
FROM facturas_por_venta
WHERE num_facturas != 1  -- Solo mostrar problemáticos
ORDER BY venta_fecha DESC
LIMIT 20;

-- =====================================================
-- 8. RESUMEN GLOBAL DE INVENTARIO
-- =====================================================
SELECT 
  '📊 RESUMEN GLOBAL DE INVENTARIO' as diagnostico;

SELECT 
  COUNT(*) as total_productos,
  SUM(stock) as stock_total,
  SUM(CASE WHEN stock < 0 THEN 1 ELSE 0 END) as productos_stock_negativo,
  SUM(CASE WHEN stock = 0 THEN 1 ELSE 0 END) as productos_agotados,
  SUM(CASE WHEN stock > 0 AND stock <= min_stock THEN 1 ELSE 0 END) as productos_stock_bajo,
  SUM(stock * purchase_price) as valor_inventario_compra,
  SUM(stock * sale_price) as valor_inventario_venta
FROM products
WHERE is_active = true;

-- =====================================================
-- 9. TOP 10 PRODUCTOS MÁS VENDIDOS (SIN REDUCIR STOCK)
-- =====================================================
SELECT 
  '📊 TOP 10 PRODUCTOS MÁS VENDIDOS' as diagnostico;

SELECT 
  p.code,
  p.name,
  p.stock as stock_actual,
  COUNT(sd.id) as num_transacciones,
  SUM(sd.quantity) as cantidad_vendida,
  SUM(sd.quantity * sd.unit_price) as ingresos_totales,
  p.stock + SUM(sd.quantity) as stock_teorico_antes_ventas,
  CASE 
    WHEN p.stock = (p.stock + SUM(sd.quantity)) 
    THEN '❌ Stock NO se redujo'
    ELSE '✅ Stock reducido'
  END as estado_stock
FROM products p
JOIN sale_details sd ON p.id = sd.product_id
GROUP BY p.id, p.code, p.name, p.stock
ORDER BY cantidad_vendida DESC
LIMIT 10;

-- =====================================================
-- 10. VERIFICAR PERMISOS RPC
-- =====================================================
SELECT 
  '🔐 VERIFICACIÓN: Permisos de funciones RPC' as diagnostico;

SELECT 
  p.proname as funcion,
  pg_get_function_identity_arguments(p.oid) as parametros,
  CASE 
    WHEN p.proacl IS NULL THEN '⚠️ Sin permisos explícitos (default)'
    ELSE '✅ Permisos configurados'
  END as estado_permisos,
  CASE 
    WHEN p.prosecdef THEN '✅ SECURITY DEFINER'
    ELSE '⚠️ SECURITY INVOKER'
  END as security_mode
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN ('reduce_stock', 'increase_stock', 'generate_invoice_number')
ORDER BY p.proname;

-- SECURITY DEFINER necesario para que usuarios autenticados ejecuten

-- =====================================================
-- 11. DETECTAR PRODUCTOS SIN MOVIMIENTO
-- =====================================================
SELECT 
  '📊 PRODUCTOS SIN VENTAS NI COMPRAS (últimos 30 días)' as diagnostico;

SELECT 
  p.code,
  p.name,
  p.stock,
  p.category,
  p.created_at,
  DATE_PART('day', NOW() - p.created_at) as dias_desde_creacion
FROM products p
WHERE p.is_active = true
  AND p.id NOT IN (
    SELECT DISTINCT product_id FROM sale_details sd
    JOIN sales s ON sd.sale_id = s.id
    WHERE s.created_at >= NOW() - INTERVAL '30 days'
  )
  AND p.id NOT IN (
    SELECT DISTINCT product_id FROM purchase_details pd
    JOIN purchases pu ON pd.purchase_id = pu.id
    WHERE pu.created_at >= NOW() - INTERVAL '30 days'
  )
ORDER BY p.created_at DESC
LIMIT 20;

-- =====================================================
-- 12. ANÁLISIS DE COHERENCIA TOTAL
-- =====================================================
SELECT 
  '📊 ANÁLISIS FINAL DE COHERENCIA' as diagnostico;

WITH analisis AS (
  SELECT 
    (SELECT COUNT(*) FROM products WHERE stock < 0) as stock_negativo,
    (SELECT COUNT(*) FROM sales WHERE created_at >= NOW() - INTERVAL '24 hours') as ventas_24h,
    (SELECT COUNT(*) FROM purchases WHERE created_at >= NOW() - INTERVAL '7 days') as compras_7d,
    (SELECT COUNT(*) FROM invoices WHERE created_at >= NOW() - INTERVAL '7 days') as facturas_7d,
    (SELECT COUNT(*) FROM information_schema.triggers 
     WHERE event_object_table IN ('sale_details', 'purchase_details')) as triggers_stock
)
SELECT 
  stock_negativo,
  ventas_24h,
  compras_7d,
  facturas_7d,
  triggers_stock,
  CASE 
    WHEN stock_negativo > 0 THEN '🔴 CRÍTICO: Stock negativo detectado'
    WHEN triggers_stock = 0 THEN '⚠️ ADVERTENCIA: Sin triggers automáticos'
    WHEN ventas_24h = 0 THEN 'ℹ️ INFO: Sin ventas recientes'
    ELSE '✅ Sistema operativo'
  END as diagnostico_general
FROM analisis;

-- =====================================================
-- INTERPRETACIÓN DE RESULTADOS
-- =====================================================

/*
✅ SISTEMA SALUDABLE:
- Stock negativo = 0
- Triggers automáticos configurados
- Funciones RPC existen con SECURITY DEFINER
- Ventas reducen stock correctamente

⚠️ SISTEMA CON PROBLEMAS:
- Stock negativo > 0 → Race conditions
- Triggers = 0 → Actualización manual (vulnerable)
- Ventas NO reducen stock → Código roto
- Compras con stock inconsistente → Race condition

🔴 SISTEMA CRÍTICO:
- Stock negativo alto
- Sin triggers ni funciones RPC
- Inconsistencias masivas entre ventas/stock
- → REQUIERE INTERVENCIÓN INMEDIATA
*/

-- =====================================================
-- SIGUIENTE PASO: Ejecutar correcciones
-- =====================================================

/*
Si detectas problemas, ejecutar en orden:

1. docs/sql/FIX_STOCK_TRIGGERS.sql (crear este archivo)
2. Auditar datos históricos
3. Corregir stock manualmente si necesario
4. Implementar código frontend con RPC
5. Testing exhaustivo

Ver: docs/ANALISIS_CRITICO_VENTAS_INVENTARIO.md
*/
