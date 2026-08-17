-- =====================================================
-- VERIFICACIÓN DEL ESTADO DE OPTIMIZACIÓN (SOLO LECTURA)
-- Fecha: 2026-08-16
-- Compatible con el SQL Editor de Supabase (sin metacomandos psql).
-- No modifica ningún dato: solo SELECT.
-- Ejecútalo ANTES y DESPUÉS de aplicar las migraciones.
-- =====================================================

SELECT '=== 1. Políticas RLS actuales en order_items / sale_details ===' AS seccion;

SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('order_items', 'sale_details')
ORDER BY tablename, policyname;

SELECT '=== 2. Verificación de política canónica (debe existir) ===' AS seccion;

SELECT tablename, policyname, 'OK (canónica presente)' AS estado
FROM pg_policies
WHERE schemaname = 'public'
  AND (tablename, policyname) IN (
    ('order_items', 'order_items_realtime_access_policy'),
    ('sale_details', 'sale_details_realtime_access_policy')
  )
ORDER BY tablename;

SELECT '=== 3. Índices relevantes (optimización de consultas) ===' AS seccion;

SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'idx_sales_business_created_at_desc',
    'idx_sales_business_user_created_at_desc',
    'idx_purchases_business_created_at_desc',
    'idx_purchases_business_supplier_created_at_desc',
    'idx_tables_business_table_number',
    'idx_orders_business_status_opened_at',
    'idx_products_business_active_name',
    'idx_products_business_code',
    'idx_sales_business_payment_created_at_desc',
    'idx_sales_business_status_created_at_desc',
    'idx_purchases_business_status_created_at_desc',
    'idx_purchases_business_user_created_at_desc_v2',
    'idx_invoices_business_status_created_at_desc',
    'idx_invoices_business_invoice_number',
    'idx_sale_details_sale_id',
    'idx_sale_details_product_id',
    'idx_purchase_details_purchase_id',
    'idx_purchase_details_product_id',
    'idx_invoice_items_invoice_id',
    'idx_products_business_supplier_active_name',
    'idx_employees_business_active_created_at_desc',
    'idx_orders_business_updated_at_desc',
    'idx_tables_business_updated_at_desc'
  )
ORDER BY indexname;

SELECT '=== 4. Estado RLS habilitado (debe seguir t=true) ===' AS seccion;

SELECT c.relname AS tabla, c.relrowsecurity AS rls_habilitado
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('order_items', 'sale_details')
ORDER BY c.relname;

SELECT '=== 5. Conteo estimado de filas (referencia de tamaño de tablas) ===' AS seccion;

SELECT relname AS tabla, n_live_tup AS filas_estimadas
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND relname IN ('orders', 'tables', 'order_items', 'sales', 'sale_details')
ORDER BY relname;
