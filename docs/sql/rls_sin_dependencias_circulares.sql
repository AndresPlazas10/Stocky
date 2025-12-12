-- =====================================================
-- POLÍTICAS RLS SIN DEPENDENCIAS CIRCULARES
-- =====================================================
-- Este script crea políticas RLS seguras que NO generan
-- problemas de recursión o dependencias circulares
-- =====================================================

-- PASO 1: CREAR FUNCIÓN HELPER (sin dependencias RLS)
-- =====================================================
-- Esta función BYPASS RLS usando SECURITY DEFINER
-- Devuelve los IDs de negocios a los que el usuario tiene acceso

CREATE OR REPLACE FUNCTION get_user_business_ids()
RETURNS TABLE(business_id UUID) 
SECURITY DEFINER -- IMPORTANTE: Esto bypasea RLS
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Devolver negocios creados por el usuario
  RETURN QUERY
  SELECT id FROM businesses WHERE created_by = auth.uid()
  UNION
  -- Devolver negocios donde el usuario es empleado
  SELECT b.id FROM businesses b
  INNER JOIN employees e ON e.business_id = b.id
  WHERE e.user_id = auth.uid() AND e.is_active = true;
END;
$$;

-- PASO 2: LIMPIAR POLÍTICAS EXISTENTES
-- =====================================================

-- Eliminar políticas antiguas de businesses
DROP POLICY IF EXISTS "businesses_select_policy" ON businesses;
DROP POLICY IF EXISTS "businesses_insert_policy" ON businesses;
DROP POLICY IF EXISTS "businesses_update_policy" ON businesses;
DROP POLICY IF EXISTS "businesses_delete_policy" ON businesses;
DROP POLICY IF EXISTS "Allow business owners full access" ON businesses;
DROP POLICY IF EXISTS "Allow authenticated users to create businesses" ON businesses;

-- Eliminar políticas antiguas de employees
DROP POLICY IF EXISTS "employees_select_policy" ON employees;
DROP POLICY IF EXISTS "employees_insert_policy" ON employees;
DROP POLICY IF EXISTS "employees_update_policy" ON employees;
DROP POLICY IF EXISTS "employees_delete_policy" ON employees;
DROP POLICY IF EXISTS "Allow business owners to manage employees" ON employees;
DROP POLICY IF EXISTS "Allow employees to view themselves" ON employees;

-- PASO 3: HABILITAR RLS EN TABLAS CRÍTICAS
-- =====================================================

ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- PASO 4: POLÍTICAS PARA BUSINESSES
-- =====================================================

-- SELECT: Ver solo tus negocios (usa la función helper)
CREATE POLICY "businesses_select"
  ON businesses
  FOR SELECT
  TO authenticated
  USING (id IN (SELECT get_user_business_ids()));

-- INSERT: Cualquier usuario autenticado puede crear un negocio
CREATE POLICY "businesses_insert"
  ON businesses
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- UPDATE: Solo el creador puede actualizar
CREATE POLICY "businesses_update"
  ON businesses
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- DELETE: Solo el creador puede eliminar
CREATE POLICY "businesses_delete"
  ON businesses
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- PASO 5: POLÍTICAS PARA EMPLOYEES
-- =====================================================

-- SELECT: Ver empleados de tus negocios
CREATE POLICY "employees_select"
  ON employees
  FOR SELECT
  TO authenticated
  USING (business_id IN (SELECT get_user_business_ids()));

-- INSERT: Permitir insertar si el business_id está en la lista
-- IMPORTANTE: Esta política NO consulta businesses directamente,
-- usa la función helper que bypasea RLS
CREATE POLICY "employees_insert"
  ON employees
  FOR INSERT
  TO authenticated
  WITH CHECK (business_id IN (SELECT get_user_business_ids()));

-- UPDATE: Actualizar empleados de tus negocios
CREATE POLICY "employees_update"
  ON employees
  FOR UPDATE
  TO authenticated
  USING (business_id IN (SELECT get_user_business_ids()))
  WITH CHECK (business_id IN (SELECT get_user_business_ids()));

-- DELETE: Eliminar empleados de tus negocios
CREATE POLICY "employees_delete"
  ON employees
  FOR DELETE
  TO authenticated
  USING (business_id IN (SELECT get_user_business_ids()));

-- PASO 6: POLÍTICAS PARA OTRAS TABLAS (productos, ventas, etc.)
-- =====================================================

-- PRODUCTS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "products_policy" ON products;
DROP POLICY IF EXISTS "products_select" ON products;
DROP POLICY IF EXISTS "products_insert" ON products;
DROP POLICY IF EXISTS "products_update" ON products;
DROP POLICY IF EXISTS "products_delete" ON products;

CREATE POLICY "products_all"
  ON products
  FOR ALL
  TO authenticated
  USING (business_id IN (SELECT get_user_business_ids()))
  WITH CHECK (business_id IN (SELECT get_user_business_ids()));

-- SALES
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sales_policy" ON sales;
DROP POLICY IF EXISTS "sales_select" ON sales;
DROP POLICY IF EXISTS "sales_insert" ON sales;
DROP POLICY IF EXISTS "sales_update" ON sales;
DROP POLICY IF EXISTS "sales_delete" ON sales;

CREATE POLICY "sales_all"
  ON sales
  FOR ALL
  TO authenticated
  USING (business_id IN (SELECT get_user_business_ids()))
  WITH CHECK (business_id IN (SELECT get_user_business_ids()));

-- SALE_DETAILS
ALTER TABLE sale_details ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sale_details_policy" ON sale_details;
DROP POLICY IF EXISTS "sale_details_select" ON sale_details;
DROP POLICY IF EXISTS "sale_details_insert" ON sale_details;
DROP POLICY IF EXISTS "sale_details_update" ON sale_details;
DROP POLICY IF EXISTS "sale_details_delete" ON sale_details;

CREATE POLICY "sale_details_all"
  ON sale_details
  FOR ALL
  TO authenticated
  USING (
    sale_id IN (
      SELECT id FROM sales 
      WHERE business_id IN (SELECT get_user_business_ids())
    )
  );

-- SUPPLIERS
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "suppliers_policy" ON suppliers;
DROP POLICY IF EXISTS "suppliers_select" ON suppliers;
DROP POLICY IF EXISTS "suppliers_insert" ON suppliers;
DROP POLICY IF EXISTS "suppliers_update" ON suppliers;
DROP POLICY IF EXISTS "suppliers_delete" ON suppliers;

CREATE POLICY "suppliers_all"
  ON suppliers
  FOR ALL
  TO authenticated
  USING (business_id IN (SELECT get_user_business_ids()))
  WITH CHECK (business_id IN (SELECT get_user_business_ids()));

-- PURCHASES
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "purchases_policy" ON purchases;
DROP POLICY IF EXISTS "purchases_select" ON purchases;
DROP POLICY IF EXISTS "purchases_insert" ON purchases;
DROP POLICY IF EXISTS "purchases_update" ON purchases;
DROP POLICY IF EXISTS "purchases_delete" ON purchases;

CREATE POLICY "purchases_all"
  ON purchases
  FOR ALL
  TO authenticated
  USING (business_id IN (SELECT get_user_business_ids()))
  WITH CHECK (business_id IN (SELECT get_user_business_ids()));

-- PURCHASE_DETAILS
ALTER TABLE purchase_details ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "purchase_details_policy" ON purchase_details;
DROP POLICY IF EXISTS "purchase_details_select" ON purchase_details;
DROP POLICY IF EXISTS "purchase_details_insert" ON purchase_details;
DROP POLICY IF EXISTS "purchase_details_update" ON purchase_details;
DROP POLICY IF EXISTS "purchase_details_delete" ON purchase_details;

CREATE POLICY "purchase_details_all"
  ON purchase_details
  FOR ALL
  TO authenticated
  USING (
    purchase_id IN (
      SELECT id FROM purchases 
      WHERE business_id IN (SELECT get_user_business_ids())
    )
  );

-- INVOICES
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoices_policy" ON invoices;
DROP POLICY IF EXISTS "invoices_select" ON invoices;
DROP POLICY IF EXISTS "invoices_insert" ON invoices;
DROP POLICY IF EXISTS "invoices_update" ON invoices;
DROP POLICY IF EXISTS "invoices_delete" ON invoices;

CREATE POLICY "invoices_all"
  ON invoices
  FOR ALL
  TO authenticated
  USING (business_id IN (SELECT get_user_business_ids()))
  WITH CHECK (business_id IN (SELECT get_user_business_ids()));

-- INVOICE_ITEMS
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoice_items_policy" ON invoice_items;
DROP POLICY IF EXISTS "invoice_items_select" ON invoice_items;
DROP POLICY IF EXISTS "invoice_items_insert" ON invoice_items;
DROP POLICY IF EXISTS "invoice_items_update" ON invoice_items;
DROP POLICY IF EXISTS "invoice_items_delete" ON invoice_items;

CREATE POLICY "invoice_items_all"
  ON invoice_items
  FOR ALL
  TO authenticated
  USING (
    invoice_id IN (
      SELECT id FROM invoices 
      WHERE business_id IN (SELECT get_user_business_ids())
    )
  );

-- CUSTOMERS (si existe)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'customers') THEN
    ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "customers_policy" ON customers;
    DROP POLICY IF EXISTS "customers_business_isolation" ON customers;
    DROP POLICY IF EXISTS "customers_select" ON customers;
    DROP POLICY IF EXISTS "customers_insert" ON customers;
    DROP POLICY IF EXISTS "customers_update" ON customers;
    DROP POLICY IF EXISTS "customers_delete" ON customers;
    
    CREATE POLICY "customers_all"
      ON customers
      FOR ALL
      TO authenticated
      USING (business_id IN (SELECT get_user_business_ids()))
      WITH CHECK (business_id IN (SELECT get_user_business_ids()));
  END IF;
END $$;

-- MESAS / TABLES (si existe)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'tables') THEN
    ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "tables_policy" ON tables;
    DROP POLICY IF EXISTS "tables_select" ON tables;
    DROP POLICY IF EXISTS "tables_insert" ON tables;
    DROP POLICY IF EXISTS "tables_update" ON tables;
    DROP POLICY IF EXISTS "tables_delete" ON tables;
    
    CREATE POLICY "tables_all"
      ON tables
      FOR ALL
      TO authenticated
      USING (business_id IN (SELECT get_user_business_ids()))
      WITH CHECK (business_id IN (SELECT get_user_business_ids()));
  END IF;
END $$;

-- ORDERS (si existe)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'orders') THEN
    ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "orders_policy" ON orders;
    DROP POLICY IF EXISTS "orders_select" ON orders;
    DROP POLICY IF EXISTS "orders_insert" ON orders;
    DROP POLICY IF EXISTS "orders_update" ON orders;
    DROP POLICY IF EXISTS "orders_delete" ON orders;
    
    CREATE POLICY "orders_all"
      ON orders
      FOR ALL
      TO authenticated
      USING (business_id IN (SELECT get_user_business_ids()))
      WITH CHECK (business_id IN (SELECT get_user_business_ids()));
  END IF;
END $$;

-- ORDER_ITEMS (si existe)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'order_items') THEN
    ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "order_items_policy" ON order_items;
    DROP POLICY IF EXISTS "order_items_select" ON order_items;
    DROP POLICY IF EXISTS "order_items_insert" ON order_items;
    DROP POLICY IF EXISTS "order_items_update" ON order_items;
    DROP POLICY IF EXISTS "order_items_delete" ON order_items;
    
    CREATE POLICY "order_items_all"
      ON order_items
      FOR ALL
      TO authenticated
      USING (
        order_id IN (
          SELECT id FROM orders 
          WHERE business_id IN (SELECT get_user_business_ids())
        )
      );
  END IF;
END $$;

-- =====================================================
-- VERIFICACIÓN FINAL
-- =====================================================

-- Listar todas las políticas creadas
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Verificar que get_user_business_ids funciona
SELECT * FROM get_user_business_ids();

-- =====================================================
-- NOTAS IMPORTANTES
-- =====================================================
/*
1. La función get_user_business_ids() usa SECURITY DEFINER
   - Esto significa que se ejecuta con permisos del creador (superuser)
   - BYPASEA RLS, evitando dependencias circulares
   - Es segura porque solo devuelve IDs basados en auth.uid()

2. Las políticas INSERT de employees NO consultan businesses directamente
   - Usan get_user_business_ids() que bypasea RLS
   - Elimina el problema de "403 Forbidden"

3. Todas las tablas relacionadas usan la misma función helper
   - Consistencia en la lógica de seguridad
   - Fácil de mantener y debuggear

4. Si necesitas deshabilitar RLS temporalmente:
   ALTER TABLE nombre_tabla DISABLE ROW LEVEL SECURITY;

5. Si necesitas ver qué políticas tiene una tabla:
   SELECT * FROM pg_policies WHERE tablename = 'nombre_tabla';
*/
