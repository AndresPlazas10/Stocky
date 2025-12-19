-- =====================================================
-- 🚀 OPTIMIZACIÓN: ÍNDICES PARA MEJORAR RENDIMIENTO
-- =====================================================
-- Ejecutar en Supabase SQL Editor
-- Crea índices para acelerar queries más comunes
-- =====================================================

-- =====================================================
-- VERIFICAR ÍNDICES EXISTENTES
-- =====================================================

SELECT 
  '📊 ÍNDICES ACTUALES EN TABLAS PRINCIPALES' as info;

SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('sales', 'products', 'purchases', 'invoices', 'employees', 'suppliers', 'tables', 'orders')
ORDER BY tablename, indexname;

-- =====================================================
-- 1. ÍNDICES PARA SALES (VENTAS)
-- =====================================================

-- Índice compuesto: business_id + created_at (descendente)
-- Usado en: SELECT * FROM sales WHERE business_id = ? ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_sales_business_created 
ON sales (business_id, created_at DESC);

-- Índice para buscar por user_id (vendedor)
CREATE INDEX IF NOT EXISTS idx_sales_user 
ON sales (user_id) 
WHERE user_id IS NOT NULL;

-- Índice para filtrar por método de pago
CREATE INDEX IF NOT EXISTS idx_sales_payment_method 
ON sales (payment_method);

COMMENT ON INDEX idx_sales_business_created IS 
  'Optimiza queries de ventas por negocio ordenadas por fecha';

-- =====================================================
-- 2. ÍNDICES PARA PRODUCTS (INVENTARIO)
-- =====================================================

-- Índice compuesto: business_id + is_active + stock
-- Usado en: SELECT * FROM products WHERE business_id = ? AND is_active = true AND stock > 0
CREATE INDEX IF NOT EXISTS idx_products_business_active_stock 
ON products (business_id, is_active, stock) 
WHERE is_active = true AND stock > 0;

-- Índice para búsqueda por código
CREATE INDEX IF NOT EXISTS idx_products_code 
ON products (code);

-- Índice para búsqueda por nombre (case-insensitive)
CREATE INDEX IF NOT EXISTS idx_products_name_lower 
ON products (LOWER(name));

-- Índice para productos con stock bajo
CREATE INDEX IF NOT EXISTS idx_products_low_stock 
ON products (business_id, stock, min_stock) 
WHERE stock <= min_stock AND is_active = true;

-- Índice para búsqueda por categoría
CREATE INDEX IF NOT EXISTS idx_products_category 
ON products (category) 
WHERE category IS NOT NULL;

COMMENT ON INDEX idx_products_business_active_stock IS 
  'Optimiza queries de productos activos con stock disponible';

-- =====================================================
-- 3. ÍNDICES PARA PURCHASES (COMPRAS)
-- =====================================================

-- Índice compuesto: business_id + created_at (descendente)
CREATE INDEX IF NOT EXISTS idx_purchases_business_created 
ON purchases (business_id, created_at DESC);

-- Índice para filtrar por proveedor
CREATE INDEX IF NOT EXISTS idx_purchases_supplier 
ON purchases (supplier_id) 
WHERE supplier_id IS NOT NULL;

-- Índice para filtrar por usuario responsable
CREATE INDEX IF NOT EXISTS idx_purchases_user 
ON purchases (user_id) 
WHERE user_id IS NOT NULL;

COMMENT ON INDEX idx_purchases_business_created IS 
  'Optimiza queries de compras por negocio ordenadas por fecha';

-- =====================================================
-- 4. ÍNDICES PARA INVOICES (FACTURAS)
-- =====================================================

-- Índice compuesto: business_id + created_at (descendente)
CREATE INDEX IF NOT EXISTS idx_invoices_business_created 
ON invoices (business_id, created_at DESC);

-- Índice para búsqueda por número de factura
CREATE INDEX IF NOT EXISTS idx_invoices_number 
ON invoices (invoice_number);

-- Índice para filtrar por estado
CREATE INDEX IF NOT EXISTS idx_invoices_status 
ON invoices (status);

-- Índice para búsqueda por email de cliente
CREATE INDEX IF NOT EXISTS idx_invoices_customer_email 
ON invoices (customer_email) 
WHERE customer_email IS NOT NULL;

COMMENT ON INDEX idx_invoices_business_created IS 
  'Optimiza queries de facturas por negocio ordenadas por fecha';

-- =====================================================
-- 5. ÍNDICES PARA EMPLOYEES (EMPLEADOS)
-- =====================================================

-- Índice compuesto: user_id + is_active
-- Usado en: SELECT * FROM employees WHERE user_id = ? AND is_active = true
CREATE INDEX IF NOT EXISTS idx_employees_user_active 
ON employees (user_id, is_active) 
WHERE is_active = true;

-- Índice para buscar por negocio
CREATE INDEX IF NOT EXISTS idx_employees_business 
ON employees (business_id, is_active);

-- Índice para buscar por rol
CREATE INDEX IF NOT EXISTS idx_employees_role 
ON employees (role) 
WHERE role IS NOT NULL;

COMMENT ON INDEX idx_employees_user_active IS 
  'Optimiza queries de empleados activos por user_id';

-- =====================================================
-- 6. ÍNDICES PARA SUPPLIERS (PROVEEDORES)
-- =====================================================

-- Índice para buscar por negocio
CREATE INDEX IF NOT EXISTS idx_suppliers_business 
ON suppliers (business_id);

-- Índice para búsqueda por nombre (case-insensitive)
CREATE INDEX IF NOT EXISTS idx_suppliers_name_lower 
ON suppliers (LOWER(business_name));

-- Índice para búsqueda por email
CREATE INDEX IF NOT EXISTS idx_suppliers_email 
ON suppliers (email) 
WHERE email IS NOT NULL;

COMMENT ON INDEX idx_suppliers_business IS 
  'Optimiza queries de proveedores por negocio';

-- =====================================================
-- 7. ÍNDICES PARA SALE_DETAILS
-- =====================================================

-- Índice para buscar detalles por venta
CREATE INDEX IF NOT EXISTS idx_sale_details_sale 
ON sale_details (sale_id);

-- Índice para buscar ventas por producto
CREATE INDEX IF NOT EXISTS idx_sale_details_product 
ON sale_details (product_id);

COMMENT ON INDEX idx_sale_details_sale IS 
  'Optimiza queries de detalles de venta';

-- =====================================================
-- 8. ÍNDICES PARA PURCHASE_DETAILS
-- =====================================================

-- Índice para buscar detalles por compra
CREATE INDEX IF NOT EXISTS idx_purchase_details_purchase 
ON purchase_details (purchase_id);

-- Índice para buscar compras por producto
CREATE INDEX IF NOT EXISTS idx_purchase_details_product 
ON purchase_details (product_id);

COMMENT ON INDEX idx_purchase_details_purchase IS 
  'Optimiza queries de detalles de compra';

-- =====================================================
-- 9. ÍNDICES PARA TABLES (MESAS)
-- =====================================================

-- Índice para buscar mesas por negocio y estado
CREATE INDEX IF NOT EXISTS idx_tables_business_status 
ON tables (business_id, status);

-- Índice para buscar por orden actual
CREATE INDEX IF NOT EXISTS idx_tables_current_order 
ON tables (current_order_id) 
WHERE current_order_id IS NOT NULL;

COMMENT ON INDEX idx_tables_business_status IS 
  'Optimiza queries de mesas por negocio y estado';

-- =====================================================
-- 10. ÍNDICES PARA ORDERS (ÓRDENES)
-- =====================================================

-- Índice para buscar órdenes por mesa
CREATE INDEX IF NOT EXISTS idx_orders_table 
ON orders (table_id);

-- Índice para buscar órdenes por negocio y estado
CREATE INDEX IF NOT EXISTS idx_orders_business_status 
ON orders (business_id, status);

-- Índice para buscar órdenes por fecha
CREATE INDEX IF NOT EXISTS idx_orders_opened_at 
ON orders (opened_at DESC);

COMMENT ON INDEX idx_orders_business_status IS 
  'Optimiza queries de órdenes por negocio y estado';

-- =====================================================
-- 11. ÍNDICES PARA INVOICE_ITEMS
-- =====================================================

-- Índice para buscar items por factura
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice 
ON invoice_items (invoice_id);

-- Índice para buscar facturas por producto
CREATE INDEX IF NOT EXISTS idx_invoice_items_product 
ON invoice_items (product_id) 
WHERE product_id IS NOT NULL;

COMMENT ON INDEX idx_invoice_items_invoice IS 
  'Optimiza queries de items de factura';

-- =====================================================
-- VERIFICAR NUEVOS ÍNDICES CREADOS
-- =====================================================

SELECT 
  '✅ ÍNDICES CREADOS EXITOSAMENTE' as resultado;

SELECT 
  i.tablename as tabla,
  i.indexname as indice,
  pg_size_pretty(pg_relation_size((i.schemaname || '.' || i.indexname)::regclass)) as tamaño
FROM pg_indexes i
WHERE i.schemaname = 'public'
  AND i.indexname LIKE 'idx_%'
  AND i.tablename IN ('sales', 'products', 'purchases', 'invoices', 'employees', 'suppliers', 
                    'sale_details', 'purchase_details', 'tables', 'orders', 'invoice_items')
ORDER BY i.tablename, i.indexname;

-- =====================================================
-- ANÁLISIS DE USO DE ÍNDICES
-- =====================================================

-- Ver estadísticas de uso de índices (después de usar la app)
SELECT 
  s.schemaname,
  s.relname as tabla,
  s.indexrelname as indice,
  s.idx_scan as num_escaneos,
  s.idx_tup_read as tuplas_leidas,
  s.idx_tup_fetch as tuplas_obtenidas,
  pg_size_pretty(pg_relation_size(s.indexrelid)) as tamaño
FROM pg_stat_user_indexes s
WHERE s.schemaname = 'public'
  AND s.indexrelname LIKE 'idx_%'
ORDER BY s.idx_scan DESC
LIMIT 20;

-- =====================================================
-- MANTENIMIENTO DE ÍNDICES
-- =====================================================

-- Reindexar si los índices están fragmentados (ejecutar mensualmente)
-- REINDEX TABLE sales;
-- REINDEX TABLE products;
-- REINDEX TABLE purchases;

-- Analizar tablas para actualizar estadísticas (ejecutar semanalmente)
ANALYZE sales;
ANALYZE products;
ANALYZE purchases;
ANALYZE invoices;
ANALYZE employees;

-- =====================================================
-- VERIFICACIÓN DE IMPACTO
-- =====================================================

-- ANTES de crear índices, ejecutar:
-- EXPLAIN ANALYZE SELECT * FROM sales WHERE business_id = 'xxx' ORDER BY created_at DESC LIMIT 50;

-- DESPUÉS de crear índices, ejecutar de nuevo:
-- EXPLAIN ANALYZE SELECT * FROM sales WHERE business_id = 'xxx' ORDER BY created_at DESC LIMIT 50;

-- Comparar:
-- - Execution Time: debe ser menor
-- - Planning Time: puede ser ligeramente mayor (normal)
-- - "Index Scan" en lugar de "Seq Scan": ✅ bueno

-- =====================================================
-- NOTAS IMPORTANTES
-- =====================================================

/*
✅ VENTAJAS DE ÍNDICES:
1. Queries 5-10x más rápidas en tablas grandes
2. Mejora escalabilidad (funciona con millones de registros)
3. Reduce carga del servidor

⚠️ CONSIDERACIONES:
1. Los índices ocupan espacio en disco
2. INSERT/UPDATE/DELETE ligeramente más lentos (actualizar índices)
3. Índices poco usados deberían eliminarse
4. Ejecutar ANALYZE después de crear índices

🔧 PRÓXIMOS PASOS:
1. Ejecutar este script en Supabase SQL Editor
2. Verificar que los índices se crearon correctamente
3. Probar la aplicación y medir tiempos de carga
4. Revisar estadísticas de uso de índices después de 1 semana
5. Eliminar índices no utilizados

📊 IMPACTO ESPERADO:
- Ventas: 3s → 0.5s (6x más rápido)
- Productos: 2s → 0.3s (6.6x más rápido)
- Compras: 4s → 0.7s (5.7x más rápido)
- Facturas: 3s → 0.6s (5x más rápido)

📖 DOCUMENTACIÓN:
- Ver: docs/GUIA_OPTIMIZACION_RENDIMIENTO.md
- PostgreSQL Indexes: https://www.postgresql.org/docs/current/indexes.html
- Supabase Performance: https://supabase.com/docs/guides/database/performance
*/
