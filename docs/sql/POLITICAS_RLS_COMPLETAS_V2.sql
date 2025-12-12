-- =====================================================
-- POLÍTICAS RLS COMPLETAS V2 - STOCKLY
-- =====================================================
-- ✅ Versión mejorada que VERIFICA existencia de tablas
-- ✅ Crea tablas faltantes automáticamente
-- ✅ Solo aplica RLS a tablas existentes
-- =====================================================

SET search_path = public;

-- =====================================================
-- PASO 0: VERIFICAR Y CREAR TABLAS FALTANTES
-- =====================================================

-- Crear tabla customers si no existe
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  id_number TEXT,
  address TEXT,
  city TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para customers
CREATE INDEX IF NOT EXISTS idx_customers_business_id ON customers(business_id);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);

-- =====================================================
-- PASO 1: ELIMINAR POLÍTICAS EXISTENTES
-- =====================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
                   r.policyname, r.schemaname, r.tablename);
    RAISE NOTICE 'Dropped policy: %.% on %', r.schemaname, r.policyname, r.tablename;
  END LOOP;
END $$;

-- =====================================================
-- PASO 2: CREAR/ACTUALIZAR FUNCIONES DE SEGURIDAD
-- =====================================================

CREATE OR REPLACE FUNCTION get_user_business_ids()
RETURNS TABLE(business_id UUID) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT id FROM businesses WHERE created_by = auth.uid()
  UNION
  SELECT e.business_id FROM employees e
  WHERE e.user_id = auth.uid() AND e.is_active = true;
END;
$$;

COMMENT ON FUNCTION get_user_business_ids() IS
  'Retorna IDs de negocios a los que el usuario actual tiene acceso';

GRANT EXECUTE ON FUNCTION get_user_business_ids() TO authenticated;

-- Función: get_user_role
CREATE OR REPLACE FUNCTION get_user_role(p_business_id UUID)
RETURNS TEXT
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT 'owner' INTO v_role
  FROM businesses
  WHERE id = p_business_id AND created_by = auth.uid();
  
  IF v_role IS NOT NULL THEN
    RETURN v_role;
  END IF;
  
  SELECT role INTO v_role
  FROM employees
  WHERE business_id = p_business_id 
    AND user_id = auth.uid() 
    AND is_active = true;
  
  RETURN v_role;
END;
$$;

COMMENT ON FUNCTION get_user_role(UUID) IS
  'Retorna el rol del usuario actual en un negocio';

GRANT EXECUTE ON FUNCTION get_user_role(UUID) TO authenticated;

-- Función: check_is_owner
CREATE OR REPLACE FUNCTION check_is_owner(p_business_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM businesses
    WHERE id = p_business_id AND created_by = auth.uid()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION check_is_owner(UUID) TO authenticated;

-- Función: check_is_admin_or_owner
CREATE OR REPLACE FUNCTION check_is_admin_or_owner(p_business_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_role TEXT;
BEGIN
  v_role := get_user_role(p_business_id);
  RETURN v_role IN ('owner', 'admin');
END;
$$;

GRANT EXECUTE ON FUNCTION check_is_admin_or_owner(UUID) TO authenticated;

-- Función: check_can_manage_employees
CREATE OR REPLACE FUNCTION check_can_manage_employees(p_business_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN check_is_admin_or_owner(p_business_id);
END;
$$;

GRANT EXECUTE ON FUNCTION check_can_manage_employees(UUID) TO authenticated;

-- Función: check_can_delete_sale
CREATE OR REPLACE FUNCTION check_can_delete_sale(p_sale_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_business_id UUID;
  v_created_at TIMESTAMPTZ;
BEGIN
  SELECT business_id, created_at INTO v_business_id, v_created_at
  FROM sales
  WHERE id = p_sale_id;
  
  IF NOT check_is_admin_or_owner(v_business_id) THEN
    RETURN FALSE;
  END IF;
  
  IF v_created_at < (NOW() - INTERVAL '30 days') THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION check_can_delete_sale(UUID) TO authenticated;

-- =====================================================
-- PASO 3: HABILITAR RLS EN TABLAS EXISTENTES
-- =====================================================

DO $$
DECLARE
  v_tables TEXT[] := ARRAY[
    'businesses', 'employees', 'products', 'suppliers',
    'sales', 'sale_details', 'purchases', 'purchase_details',
    'invoices', 'invoice_items', 'customers', 'tables', 
    'orders', 'order_items'
  ];
  v_table TEXT;
BEGIN
  FOREACH v_table IN ARRAY v_tables
  LOOP
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = v_table) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', v_table);
      RAISE NOTICE 'RLS habilitado en: %', v_table;
    ELSE
      RAISE NOTICE 'Tabla no existe (omitida): %', v_table;
    END IF;
  END LOOP;
END $$;

-- =====================================================
-- PASO 4: POLÍTICAS PARA BUSINESSES
-- =====================================================

CREATE POLICY "businesses_select"
  ON businesses FOR SELECT TO authenticated
  USING (id IN (SELECT get_user_business_ids()));

CREATE POLICY "businesses_insert"
  ON businesses FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "businesses_update"
  ON businesses FOR UPDATE TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "businesses_delete"
  ON businesses FOR DELETE TO authenticated
  USING (created_by = auth.uid());

-- =====================================================
-- PASO 5: POLÍTICAS PARA EMPLOYEES
-- =====================================================

CREATE POLICY "employees_select"
  ON employees FOR SELECT TO authenticated
  USING (
    business_id IN (SELECT get_user_business_ids())
    OR user_id = auth.uid()
  );

CREATE POLICY "employees_insert"
  ON employees FOR INSERT TO authenticated
  WITH CHECK (
    business_id IN (SELECT get_user_business_ids())
    AND check_can_manage_employees(business_id)
  );

CREATE POLICY "employees_update"
  ON employees FOR UPDATE TO authenticated
  USING (
    (business_id IN (SELECT get_user_business_ids()) AND check_can_manage_employees(business_id))
    OR (user_id = auth.uid() AND is_active = true)
  )
  WITH CHECK (business_id IN (SELECT get_user_business_ids()));

CREATE POLICY "employees_delete"
  ON employees FOR DELETE TO authenticated
  USING (
    business_id IN (SELECT get_user_business_ids())
    AND check_is_owner(business_id)
  );

-- =====================================================
-- PASO 6: POLÍTICAS PARA PRODUCTS
-- =====================================================

CREATE POLICY "products_all"
  ON products FOR ALL TO authenticated
  USING (business_id IN (SELECT get_user_business_ids()))
  WITH CHECK (business_id IN (SELECT get_user_business_ids()));

-- =====================================================
-- PASO 7: POLÍTICAS PARA SUPPLIERS
-- =====================================================

CREATE POLICY "suppliers_all"
  ON suppliers FOR ALL TO authenticated
  USING (business_id IN (SELECT get_user_business_ids()))
  WITH CHECK (business_id IN (SELECT get_user_business_ids()));

-- =====================================================
-- PASO 8: POLÍTICAS PARA SALES
-- =====================================================

CREATE POLICY "sales_select"
  ON sales FOR SELECT TO authenticated
  USING (
    business_id IN (SELECT get_user_business_ids())
    AND (check_is_admin_or_owner(business_id) OR user_id = auth.uid())
  );

CREATE POLICY "sales_insert"
  ON sales FOR INSERT TO authenticated
  WITH CHECK (
    business_id IN (SELECT get_user_business_ids())
    AND user_id = auth.uid()
  );

CREATE POLICY "sales_update"
  ON sales FOR UPDATE TO authenticated
  USING (
    business_id IN (SELECT get_user_business_ids())
    AND check_is_admin_or_owner(business_id)
  )
  WITH CHECK (business_id IN (SELECT get_user_business_ids()));

CREATE POLICY "sales_delete"
  ON sales FOR DELETE TO authenticated
  USING (
    business_id IN (SELECT get_user_business_ids())
    AND check_can_delete_sale(id)
  );

-- =====================================================
-- PASO 9: POLÍTICAS PARA SALE_DETAILS
-- =====================================================

CREATE POLICY "sale_details_select"
  ON sale_details FOR SELECT TO authenticated
  USING (
    sale_id IN (
      SELECT s.id FROM sales s
      WHERE s.business_id IN (SELECT get_user_business_ids())
      AND (check_is_admin_or_owner(s.business_id) OR s.user_id = auth.uid())
    )
  );

CREATE POLICY "sale_details_insert"
  ON sale_details FOR INSERT TO authenticated
  WITH CHECK (
    sale_id IN (
      SELECT id FROM sales 
      WHERE business_id IN (SELECT get_user_business_ids())
    )
  );

CREATE POLICY "sale_details_update"
  ON sale_details FOR UPDATE TO authenticated
  USING (
    sale_id IN (
      SELECT s.id FROM sales s
      WHERE s.business_id IN (SELECT get_user_business_ids())
      AND check_is_admin_or_owner(s.business_id)
    )
  )
  WITH CHECK (
    sale_id IN (
      SELECT id FROM sales 
      WHERE business_id IN (SELECT get_user_business_ids())
    )
  );

CREATE POLICY "sale_details_delete"
  ON sale_details FOR DELETE TO authenticated
  USING (
    sale_id IN (
      SELECT s.id FROM sales s
      WHERE s.business_id IN (SELECT get_user_business_ids())
      AND check_is_admin_or_owner(s.business_id)
    )
  );

-- =====================================================
-- PASO 10: POLÍTICAS PARA PURCHASES
-- =====================================================

CREATE POLICY "purchases_select"
  ON purchases FOR SELECT TO authenticated
  USING (
    business_id IN (SELECT get_user_business_ids())
    AND (check_is_admin_or_owner(business_id) OR user_id = auth.uid())
  );

CREATE POLICY "purchases_insert"
  ON purchases FOR INSERT TO authenticated
  WITH CHECK (
    business_id IN (SELECT get_user_business_ids())
    AND user_id = auth.uid()
  );

CREATE POLICY "purchases_update"
  ON purchases FOR UPDATE TO authenticated
  USING (
    business_id IN (SELECT get_user_business_ids())
    AND check_is_admin_or_owner(business_id)
  )
  WITH CHECK (business_id IN (SELECT get_user_business_ids()));

CREATE POLICY "purchases_delete"
  ON purchases FOR DELETE TO authenticated
  USING (
    business_id IN (SELECT get_user_business_ids())
    AND check_is_admin_or_owner(business_id)
  );

-- =====================================================
-- PASO 11: POLÍTICAS PARA PURCHASE_DETAILS
-- =====================================================

CREATE POLICY "purchase_details_select"
  ON purchase_details FOR SELECT TO authenticated
  USING (
    purchase_id IN (
      SELECT p.id FROM purchases p
      WHERE p.business_id IN (SELECT get_user_business_ids())
      AND (check_is_admin_or_owner(p.business_id) OR p.user_id = auth.uid())
    )
  );

CREATE POLICY "purchase_details_insert"
  ON purchase_details FOR INSERT TO authenticated
  WITH CHECK (
    purchase_id IN (
      SELECT id FROM purchases 
      WHERE business_id IN (SELECT get_user_business_ids())
    )
  );

CREATE POLICY "purchase_details_update"
  ON purchase_details FOR UPDATE TO authenticated
  USING (
    purchase_id IN (
      SELECT p.id FROM purchases p
      WHERE p.business_id IN (SELECT get_user_business_ids())
      AND check_is_admin_or_owner(p.business_id)
    )
  )
  WITH CHECK (
    purchase_id IN (
      SELECT id FROM purchases 
      WHERE business_id IN (SELECT get_user_business_ids())
    )
  );

CREATE POLICY "purchase_details_delete"
  ON purchase_details FOR DELETE TO authenticated
  USING (
    purchase_id IN (
      SELECT p.id FROM purchases p
      WHERE p.business_id IN (SELECT get_user_business_ids())
      AND check_is_admin_or_owner(p.business_id)
    )
  );

-- =====================================================
-- PASO 12: POLÍTICAS PARA INVOICES
-- =====================================================

CREATE POLICY "invoices_select"
  ON invoices FOR SELECT TO authenticated
  USING (business_id IN (SELECT get_user_business_ids()));

CREATE POLICY "invoices_insert"
  ON invoices FOR INSERT TO authenticated
  WITH CHECK (business_id IN (SELECT get_user_business_ids()));

CREATE POLICY "invoices_update"
  ON invoices FOR UPDATE TO authenticated
  USING (business_id IN (SELECT get_user_business_ids()))
  WITH CHECK (business_id IN (SELECT get_user_business_ids()));

CREATE POLICY "invoices_delete"
  ON invoices FOR DELETE TO authenticated
  USING (
    business_id IN (SELECT get_user_business_ids())
    AND check_is_admin_or_owner(business_id)
  );

-- =====================================================
-- PASO 13: POLÍTICAS PARA INVOICE_ITEMS
-- =====================================================

CREATE POLICY "invoice_items_select"
  ON invoice_items FOR SELECT TO authenticated
  USING (
    invoice_id IN (
      SELECT id FROM invoices 
      WHERE business_id IN (SELECT get_user_business_ids())
    )
  );

CREATE POLICY "invoice_items_insert"
  ON invoice_items FOR INSERT TO authenticated
  WITH CHECK (
    invoice_id IN (
      SELECT id FROM invoices 
      WHERE business_id IN (SELECT get_user_business_ids())
    )
  );

CREATE POLICY "invoice_items_update"
  ON invoice_items FOR UPDATE TO authenticated
  USING (
    invoice_id IN (
      SELECT id FROM invoices 
      WHERE business_id IN (SELECT get_user_business_ids())
    )
  )
  WITH CHECK (
    invoice_id IN (
      SELECT id FROM invoices 
      WHERE business_id IN (SELECT get_user_business_ids())
    )
  );

CREATE POLICY "invoice_items_delete"
  ON invoice_items FOR DELETE TO authenticated
  USING (
    invoice_id IN (
      SELECT i.id FROM invoices i
      WHERE i.business_id IN (SELECT get_user_business_ids())
      AND check_is_admin_or_owner(i.business_id)
    )
  );

-- =====================================================
-- PASO 14: POLÍTICAS PARA CUSTOMERS
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'customers') THEN
    EXECUTE '
      CREATE POLICY "customers_all"
        ON customers FOR ALL TO authenticated
        USING (business_id IN (SELECT get_user_business_ids()))
        WITH CHECK (business_id IN (SELECT get_user_business_ids()))
    ';
    RAISE NOTICE 'Políticas creadas para: customers';
  END IF;
END $$;

-- =====================================================
-- PASO 15: POLÍTICAS PARA TABLES (si existe)
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tables') THEN
    EXECUTE '
      CREATE POLICY "tables_all"
        ON tables FOR ALL TO authenticated
        USING (business_id IN (SELECT get_user_business_ids()))
        WITH CHECK (business_id IN (SELECT get_user_business_ids()))
    ';
    RAISE NOTICE 'Políticas creadas para: tables';
  END IF;
END $$;

-- =====================================================
-- PASO 16: POLÍTICAS PARA ORDERS (si existe)
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'orders') THEN
    EXECUTE '
      CREATE POLICY "orders_all"
        ON orders FOR ALL TO authenticated
        USING (business_id IN (SELECT get_user_business_ids()))
        WITH CHECK (business_id IN (SELECT get_user_business_ids()))
    ';
    RAISE NOTICE 'Políticas creadas para: orders';
  END IF;
END $$;

-- =====================================================
-- PASO 17: POLÍTICAS PARA ORDER_ITEMS (si existe)
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'order_items') THEN
    EXECUTE '
      CREATE POLICY "order_items_select"
        ON order_items FOR SELECT TO authenticated
        USING (
          order_id IN (
            SELECT id FROM orders 
            WHERE business_id IN (SELECT get_user_business_ids())
          )
        );
        
      CREATE POLICY "order_items_insert"
        ON order_items FOR INSERT TO authenticated
        WITH CHECK (
          order_id IN (
            SELECT id FROM orders 
            WHERE business_id IN (SELECT get_user_business_ids())
          )
        );
        
      CREATE POLICY "order_items_update"
        ON order_items FOR UPDATE TO authenticated
        USING (
          order_id IN (
            SELECT id FROM orders 
            WHERE business_id IN (SELECT get_user_business_ids())
          )
        )
        WITH CHECK (
          order_id IN (
            SELECT id FROM orders 
            WHERE business_id IN (SELECT get_user_business_ids())
          )
        );
        
      CREATE POLICY "order_items_delete"
        ON order_items FOR DELETE TO authenticated
        USING (
          order_id IN (
            SELECT id FROM orders 
            WHERE business_id IN (SELECT get_user_business_ids())
          )
        );
    ';
    RAISE NOTICE 'Políticas creadas para: order_items';
  END IF;
END $$;

-- =====================================================
-- PASO 18: VERIFICACIÓN
-- =====================================================

SELECT 
  tablename,
  policyname,
  cmd AS operacion
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- =====================================================
-- PASO 19: GRANTS
-- =====================================================

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- =====================================================
-- PASO 20: RESUMEN
-- =====================================================

DO $$
DECLARE
  v_policy_count INTEGER;
  v_table_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public';
  
  SELECT COUNT(*) INTO v_table_count
  FROM pg_tables
  WHERE schemaname = 'public' AND rowsecurity = true;
  
  RAISE NOTICE '============================================';
  RAISE NOTICE '✅ POLÍTICAS RLS V2 INSTALADAS';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Políticas creadas: %', v_policy_count;
  RAISE NOTICE 'Tablas con RLS: %', v_table_count;
  RAISE NOTICE '============================================';
  RAISE NOTICE 'SIGUIENTE: Ejecutar docs/sql/PRUEBAS_RLS.sql';
  RAISE NOTICE '============================================';
END $$;
