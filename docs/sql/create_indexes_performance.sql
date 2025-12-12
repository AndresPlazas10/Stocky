-- =====================================================
-- ÍNDICES PARA OPTIMIZACIÓN DE PERFORMANCE
-- =====================================================
-- Ejecutar en Supabase SQL Editor después de correcciones críticas
-- =====================================================

-- ANTES DE CREAR ÍNDICES: Analizar tamaño de tablas
-- =====================================================
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS indexes_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- =====================================================
-- ÍNDICES PARA TABLA SALES
-- =====================================================

-- Queries comunes:
-- 1. SELECT * FROM sales WHERE business_id = ? ORDER BY created_at DESC
-- 2. SELECT * FROM sales WHERE user_id = ?
-- 3. SELECT * FROM sales WHERE business_id = ? AND created_at BETWEEN ? AND ?

-- Índice compuesto para paginación de ventas
CREATE INDEX IF NOT EXISTS idx_sales_business_created 
  ON sales(business_id, created_at DESC);

COMMENT ON INDEX idx_sales_business_created IS 'Optimiza listado de ventas por negocio ordenado por fecha';

-- Índice para filtrar por vendedor
CREATE INDEX IF NOT EXISTS idx_sales_user 
  ON sales(user_id) 
  WHERE user_id IS NOT NULL;

COMMENT ON INDEX idx_sales_user IS 'Optimiza búsqueda de ventas por vendedor';

-- Índice para búsqueda por método de pago
CREATE INDEX IF NOT EXISTS idx_sales_payment_method 
  ON sales(business_id, payment_method) 
  WHERE payment_method IS NOT NULL;

COMMENT ON INDEX idx_sales_payment_method IS 'Optimiza reportes por método de pago';

-- =====================================================
-- ÍNDICES PARA TABLA PRODUCTS
-- =====================================================

-- Queries comunes:
-- 1. SELECT * FROM products WHERE business_id = ? AND is_active = true
-- 2. SELECT * FROM products WHERE code = ?
-- 3. SELECT * FROM products WHERE business_id = ? AND name ILIKE ?

-- Índice parcial para productos activos (más usado)
CREATE INDEX IF NOT EXISTS idx_products_business_active 
  ON products(business_id, is_active) 
  WHERE is_active = true;

COMMENT ON INDEX idx_products_business_active IS 'Optimiza listado de productos activos';

-- Índice único para código de producto
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_code_unique 
  ON products(business_id, code) 
  WHERE code IS NOT NULL;

COMMENT ON INDEX idx_products_code_unique IS 'Evita códigos duplicados por negocio';

-- Índice para búsqueda por nombre (trigram para ILIKE)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_products_name_trgm 
  ON products USING gin(name gin_trgm_ops);

COMMENT ON INDEX idx_products_name_trgm IS 'Optimiza búsqueda ILIKE por nombre';

-- Índice para low stock
CREATE INDEX IF NOT EXISTS idx_products_low_stock 
  ON products(business_id, current_stock) 
  WHERE is_active = true AND current_stock <= 10;

COMMENT ON INDEX idx_products_low_stock IS 'Optimiza alertas de bajo stock';

-- =====================================================
-- ÍNDICES PARA TABLA EMPLOYEES
-- =====================================================

-- Queries comunes:
-- 1. SELECT * FROM employees WHERE business_id = ? AND is_active = true
-- 2. SELECT * FROM employees WHERE user_id = ?

-- Índice parcial para empleados activos
CREATE INDEX IF NOT EXISTS idx_employees_business_active 
  ON employees(business_id, is_active) 
  WHERE is_active = true;

COMMENT ON INDEX idx_employees_business_active IS 'Optimiza listado de empleados activos';

-- Índice único para user_id (un usuario solo puede ser empleado una vez por negocio)
CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_user_business 
  ON employees(user_id, business_id);

COMMENT ON INDEX idx_employees_user_business IS 'Evita duplicados de empleado por negocio';

-- =====================================================
-- ÍNDICES PARA TABLA SALE_DETAILS
-- =====================================================

-- Queries comunes:
-- 1. SELECT * FROM sale_details WHERE sale_id = ?
-- 2. SELECT * FROM sale_details WHERE product_id = ?

-- Índice para cargar detalles de una venta
CREATE INDEX IF NOT EXISTS idx_sale_details_sale 
  ON sale_details(sale_id);

COMMENT ON INDEX idx_sale_details_sale IS 'Optimiza carga de items de una venta';

-- Índice para rastrear ventas de un producto
CREATE INDEX IF NOT EXISTS idx_sale_details_product 
  ON sale_details(product_id);

COMMENT ON INDEX idx_sale_details_product IS 'Optimiza historial de ventas por producto';

-- Índice compuesto para análisis
CREATE INDEX IF NOT EXISTS idx_sale_details_sale_product 
  ON sale_details(sale_id, product_id);

COMMENT ON INDEX idx_sale_details_sale_product IS 'Optimiza joins entre sales y products';

-- =====================================================
-- ÍNDICES PARA TABLA PURCHASES
-- =====================================================

-- Queries comunes:
-- 1. SELECT * FROM purchases WHERE business_id = ? ORDER BY created_at DESC
-- 2. SELECT * FROM purchases WHERE supplier_id = ?

-- Índice para listado de compras
CREATE INDEX IF NOT EXISTS idx_purchases_business_created 
  ON purchases(business_id, created_at DESC);

COMMENT ON INDEX idx_purchases_business_created IS 'Optimiza listado de compras por fecha';

-- Índice para filtrar por proveedor
CREATE INDEX IF NOT EXISTS idx_purchases_supplier 
  ON purchases(supplier_id) 
  WHERE supplier_id IS NOT NULL;

COMMENT ON INDEX idx_purchases_supplier IS 'Optimiza búsqueda por proveedor';

-- =====================================================
-- ÍNDICES PARA TABLA PURCHASE_DETAILS
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_purchase_details_purchase 
  ON purchase_details(purchase_id);

COMMENT ON INDEX idx_purchase_details_purchase IS 'Optimiza carga de items de una compra';

CREATE INDEX IF NOT EXISTS idx_purchase_details_product 
  ON purchase_details(product_id);

COMMENT ON INDEX idx_purchase_details_product IS 'Optimiza historial de compras por producto';

-- =====================================================
-- ÍNDICES PARA TABLA SUPPLIERS
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_suppliers_business_active 
  ON suppliers(business_id, is_active) 
  WHERE is_active = true;

COMMENT ON INDEX idx_suppliers_business_active IS 'Optimiza listado de proveedores activos';

-- =====================================================
-- ÍNDICES PARA TABLA INVOICES
-- =====================================================

-- Queries comunes:
-- 1. SELECT * FROM invoices WHERE business_id = ? ORDER BY created_at DESC
-- 2. SELECT * FROM invoices WHERE invoice_number = ?

CREATE INDEX IF NOT EXISTS idx_invoices_business_created 
  ON invoices(business_id, created_at DESC);

COMMENT ON INDEX idx_invoices_business_created IS 'Optimiza listado de facturas por fecha';

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_number_business 
  ON invoices(business_id, invoice_number);

COMMENT ON INDEX idx_invoices_number_business IS 'Evita números de factura duplicados';

-- =====================================================
-- ÍNDICES PARA TABLA MESAS (si existe)
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_mesas_business_status 
  ON mesas(business_id, status);

COMMENT ON INDEX idx_mesas_business_status IS 'Optimiza filtrado de mesas por estado';

-- =====================================================
-- VERIFICACIÓN DE ÍNDICES CREADOS
-- =====================================================

SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'sales', 'products', 'employees', 'sale_details',
    'purchases', 'purchase_details', 'suppliers', 'invoices', 'mesas'
  )
ORDER BY tablename, indexname;

-- =====================================================
-- ANALIZAR IMPACTO DE ÍNDICES
-- =====================================================

-- Ver tamaño de índices creados
SELECT 
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC;

-- =====================================================
-- VACUUM ANALYZE PARA ACTUALIZAR ESTADÍSTICAS
-- =====================================================

VACUUM ANALYZE sales;
VACUUM ANALYZE products;
VACUUM ANALYZE employees;
VACUUM ANALYZE sale_details;
VACUUM ANALYZE purchases;
VACUUM ANALYZE purchase_details;
VACUUM ANALYZE suppliers;
VACUUM ANALYZE invoices;
VACUUM ANALYZE mesas;

-- =====================================================
-- QUERY PLAN TESTING
-- =====================================================

-- Test 1: Verificar que usa índice en sales
EXPLAIN ANALYZE
SELECT * FROM sales 
WHERE business_id = '3f2b775e-a4dd-432a-9913-b73d50238975'
ORDER BY created_at DESC 
LIMIT 50;
-- Debe mostrar: Index Scan using idx_sales_business_created

-- Test 2: Verificar que usa índice en products
EXPLAIN ANALYZE
SELECT * FROM products 
WHERE business_id = '3f2b775e-a4dd-432a-9913-b73d50238975'
  AND is_active = true;
-- Debe mostrar: Bitmap Index Scan on idx_products_business_active

-- Test 3: Verificar búsqueda por nombre
EXPLAIN ANALYZE
SELECT * FROM products 
WHERE name ILIKE '%producto%';
-- Debe mostrar: Bitmap Index Scan on idx_products_name_trgm

-- =====================================================
-- MONITOREO DE USO DE ÍNDICES
-- =====================================================

-- Ver índices no usados (candidatos a eliminar)
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;

-- Ver índices más usados
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC
LIMIT 20;

-- =====================================================
-- RESUMEN
-- =====================================================

/*
ÍNDICES CREADOS:

SALES (4 índices):
- idx_sales_business_created: Para listado paginado
- idx_sales_user: Para filtrar por vendedor
- idx_sales_payment_method: Para reportes

PRODUCTS (4 índices):
- idx_products_business_active: Para productos activos
- idx_products_code_unique: Para evitar duplicados
- idx_products_name_trgm: Para búsqueda ILIKE
- idx_products_low_stock: Para alertas

EMPLOYEES (2 índices):
- idx_employees_business_active: Para empleados activos
- idx_employees_user_business: Para evitar duplicados

SALE_DETAILS (3 índices):
- idx_sale_details_sale: Para cargar items
- idx_sale_details_product: Para historial
- idx_sale_details_sale_product: Para joins

PURCHASES (2 índices):
- idx_purchases_business_created: Para listado
- idx_purchases_supplier: Para filtrar

PURCHASE_DETAILS (2 índices):
- idx_purchase_details_purchase: Para cargar items
- idx_purchase_details_product: Para historial

SUPPLIERS (1 índice):
- idx_suppliers_business_active: Para proveedores activos

INVOICES (2 índices):
- idx_invoices_business_created: Para listado
- idx_invoices_number_business: Para evitar duplicados

MESAS (1 índice):
- idx_mesas_business_status: Para filtrar por estado

TOTAL: ~23 índices

MEJORA ESPERADA:
- Queries de listado: 70-90% más rápidas
- Búsquedas: 80-95% más rápidas
- Joins: 60-80% más rápidos
- Espacio usado: ~10-20MB adicional

MANTENIMIENTO:
- Ejecutar VACUUM ANALYZE semanalmente
- Monitorear índices no usados
- Revisar query plans después de cambios
*/
