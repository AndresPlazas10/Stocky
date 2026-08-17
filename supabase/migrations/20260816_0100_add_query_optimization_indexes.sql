-- =====================================================
-- ÍNDICES DE OPTIMIZACIÓN DE CONSULTAS
-- Fecha: 2026-08-16
-- Objetivo: promover a migración los índices que hasta ahora solo
-- existían como scripts out-of-band (ADD_SAFE_PERFORMANCE_INDEXES.sql,
-- ADD_FAST_READ_INDEXES_V2.sql) y agregar índices para las optimizaciones
-- recientes (recencia de cocina y fingerprint del poll de mesas).
--
-- SEGURIDAD PARA USUARIOS ACTIVOS:
--  * Todos los statements son CREATE INDEX IF NOT EXISTS: idempotentes.
--  * Los índices de las secciones A y B YA EXISTEN en producción (fueron
--    aplicados out-of-band): IF NOT EXISTS no ejecuta nada → cero locks.
--  * La sección C solo crea 2 índices nuevos sobre tablas pequeñas
--    (tables: decenas de filas; orders: miles). El build es sub-segundo y el
--    lock de escritura breve. Recomendado aplicar en horario de bajo tráfico.
--  * No hay DROP ni ALTER destructivos.
-- =====================================================

-- -----------------------------------------------------
-- SECCIÓN A: índices ya validados en producción (ADD_SAFE_PERFORMANCE_INDEXES.sql)
-- -----------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_sales_business_created_at_desc
  ON public.sales (business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_business_user_created_at_desc
  ON public.sales (business_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchases_business_created_at_desc
  ON public.purchases (business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchases_business_supplier_created_at_desc
  ON public.purchases (business_id, supplier_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tables_business_table_number
  ON public.tables (business_id, table_number);
CREATE INDEX IF NOT EXISTS idx_orders_business_status_opened_at
  ON public.orders (business_id, status, opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_business_active_name
  ON public.products (business_id, is_active, name);
CREATE INDEX IF NOT EXISTS idx_products_business_code
  ON public.products (business_id, code);

-- -----------------------------------------------------
-- SECCIÓN B: índices condicionados a la existencia de columnas
-- (ADD_FAST_READ_INDEXES_V2.sql, validados en producción)
-- -----------------------------------------------------

DO $$
BEGIN
  -- Ventas: business + payment_method + created_at
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sales'
      AND column_name IN ('business_id', 'payment_method', 'created_at')
    GROUP BY table_schema, table_name
    HAVING COUNT(DISTINCT column_name) = 3
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_sales_business_payment_created_at_desc ON public.sales (business_id, payment_method, created_at DESC)';
  END IF;

  -- Ventas: business + status + created_at
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sales'
      AND column_name IN ('business_id', 'status', 'created_at')
    GROUP BY table_schema, table_name
    HAVING COUNT(DISTINCT column_name) = 3
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_sales_business_status_created_at_desc ON public.sales (business_id, status, created_at DESC)';
  END IF;

  -- Compras: business + status + created_at
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'purchases'
      AND column_name IN ('business_id', 'status', 'created_at')
    GROUP BY table_schema, table_name
    HAVING COUNT(DISTINCT column_name) = 3
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_purchases_business_status_created_at_desc ON public.purchases (business_id, status, created_at DESC)';
  END IF;

  -- Compras: business + user + created_at (v2)
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'purchases'
      AND column_name IN ('business_id', 'user_id', 'created_at')
    GROUP BY table_schema, table_name
    HAVING COUNT(DISTINCT column_name) = 3
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_purchases_business_user_created_at_desc_v2 ON public.purchases (business_id, user_id, created_at DESC)';
  END IF;

  -- Facturas: business + status + created_at
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'invoices'
      AND column_name IN ('business_id', 'status', 'created_at')
    GROUP BY table_schema, table_name
    HAVING COUNT(DISTINCT column_name) = 3
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_invoices_business_status_created_at_desc ON public.invoices (business_id, status, created_at DESC)';
  END IF;

  -- Facturas: business + invoice_number
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'invoices'
      AND column_name IN ('business_id', 'invoice_number')
    GROUP BY table_schema, table_name
    HAVING COUNT(DISTINCT column_name) = 2
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_invoices_business_invoice_number ON public.invoices (business_id, invoice_number)';
  END IF;

  -- Detalles: FKs
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sale_details' AND column_name = 'sale_id'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_sale_details_sale_id ON public.sale_details (sale_id)';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sale_details' AND column_name = 'product_id'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_sale_details_product_id ON public.sale_details (product_id)';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'purchase_details' AND column_name = 'purchase_id'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_purchase_details_purchase_id ON public.purchase_details (purchase_id)';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'purchase_details' AND column_name = 'product_id'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_purchase_details_product_id ON public.purchase_details (product_id)';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'invoice_items' AND column_name = 'invoice_id'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON public.invoice_items (invoice_id)';
  END IF;

  -- products: business + supplier + active + name
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products'
      AND column_name IN ('business_id', 'supplier_id', 'is_active', 'name')
    GROUP BY table_schema, table_name
    HAVING COUNT(DISTINCT column_name) = 4
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_products_business_supplier_active_name ON public.products (business_id, supplier_id, is_active, name)';
  END IF;

  -- employees: business + active + created_at
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employees'
      AND column_name IN ('business_id', 'is_active', 'created_at')
    GROUP BY table_schema, table_name
    HAVING COUNT(DISTINCT column_name) = 3
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_employees_business_active_created_at_desc ON public.employees (business_id, is_active, created_at DESC)';
  END IF;
END $$;

-- -----------------------------------------------------
-- SECCIÓN C: índices NUEVOS para las optimizaciones recientes
--  * idx_orders_business_updated_at_desc: ordenamiento de la cocina por
--    recencia (updated_at/opened_at) y reconciliaciones por evento.
--  * idx_tables_business_updated_at_desc: fingerprint del poll light-first
--    de mesas (getTablesSyncFingerprint) — los triggers bump_table_sync_version
--    actualizan tables.updated_at ante cambios en orders/order_items.
-- -----------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_orders_business_updated_at_desc
  ON public.orders (business_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_tables_business_updated_at_desc
  ON public.tables (business_id, updated_at DESC);

-- =====================================================
-- Fin
-- =====================================================
