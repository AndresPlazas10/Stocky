-- ============================================================
-- SAFE PERFORMANCE INDEXES (ADDITIVE ONLY)
-- No cambia lógica de negocio ni estructura de tablas.
-- ============================================================

-- Ventas: listados por negocio y tiempo, y filtros por usuario
CREATE INDEX IF NOT EXISTS idx_sales_business_created_at_desc
  ON public.sales (business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sales_business_user_created_at_desc
  ON public.sales (business_id, user_id, created_at DESC);

-- Compras: listados por negocio/tiempo y proveedor
CREATE INDEX IF NOT EXISTS idx_purchases_business_created_at_desc
  ON public.purchases (business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_purchases_business_supplier_created_at_desc
  ON public.purchases (business_id, supplier_id, created_at DESC);

-- Mesas/órdenes: carga rápida de estado por negocio
CREATE INDEX IF NOT EXISTS idx_tables_business_table_number
  ON public.tables (business_id, table_number);

CREATE INDEX IF NOT EXISTS idx_orders_business_status_opened_at
  ON public.orders (business_id, status, opened_at DESC);

-- Productos: picker y filtros activos por negocio
CREATE INDEX IF NOT EXISTS idx_products_business_active_name
  ON public.products (business_id, is_active, name);

CREATE INDEX IF NOT EXISTS idx_products_business_code
  ON public.products (business_id, code);

