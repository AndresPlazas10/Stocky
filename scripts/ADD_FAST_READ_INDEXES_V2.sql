-- ============================================================
-- FAST READ INDEXES V2 (ADDITIVE ONLY)
-- Fecha: 2026-02-13
-- Objetivo: reducir latencia en listados/filtros frecuentes.
-- Seguridad: solo CREATE INDEX IF NOT EXISTS (sin cambios destructivos).
-- ============================================================

-- NOTA:
-- Este script valida existencia de tablas/columnas antes de crear índices.
-- Evita errores en entornos donde el esquema no es idéntico.

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

  -- Compras: business + user + created_at
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

  -- sale_details: sale_id
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sale_details' AND column_name = 'sale_id'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_sale_details_sale_id ON public.sale_details (sale_id)';
  END IF;

  -- sale_details: product_id
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sale_details' AND column_name = 'product_id'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_sale_details_product_id ON public.sale_details (product_id)';
  END IF;

  -- purchase_details: purchase_id
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'purchase_details' AND column_name = 'purchase_id'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_purchase_details_purchase_id ON public.purchase_details (purchase_id)';
  END IF;

  -- purchase_details: product_id
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'purchase_details' AND column_name = 'product_id'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_purchase_details_product_id ON public.purchase_details (product_id)';
  END IF;

  -- invoice_items: invoice_id
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

-- ANALYZE seguro (solo tablas existentes)
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'sales',
    'purchases',
    'invoices',
    'products',
    'sale_details',
    'purchase_details',
    'invoice_items',
    'employees'
  ]
  LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = t
    ) THEN
      EXECUTE format('ANALYZE public.%I', t);
    END IF;
  END LOOP;
END $$;
