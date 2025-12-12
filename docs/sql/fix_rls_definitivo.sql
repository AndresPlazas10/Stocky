-- =====================================================
-- SOLUCIÓN DEFINITIVA: RLS SIN DEPENDENCIAS CIRCULARES
-- =====================================================
-- Este script corrige TODOS los problemas de RLS
-- Ejecutar en Supabase SQL Editor
-- =====================================================

-- PASO 1: Crear función helper segura
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_user_businesses()
RETURNS TABLE(business_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Negocios donde es el creador
  RETURN QUERY
  SELECT id FROM businesses WHERE created_by = auth.uid()
  UNION
  -- Negocios donde es empleado activo
  SELECT b.id 
  FROM businesses b
  INNER JOIN employees e ON e.business_id = b.id
  WHERE e.user_id = auth.uid() AND e.is_active = true;
END;
$$;

-- PASO 2: Limpiar políticas existentes
-- =====================================================

-- Businesses
DROP POLICY IF EXISTS "businesses_select" ON businesses;
DROP POLICY IF EXISTS "businesses_insert" ON businesses;
DROP POLICY IF EXISTS "businesses_update" ON businesses;
DROP POLICY IF EXISTS "businesses_delete" ON businesses;

-- Employees
DROP POLICY IF EXISTS "employees_select" ON employees;
DROP POLICY IF EXISTS "employees_insert" ON employees;
DROP POLICY IF EXISTS "employees_update" ON employees;
DROP POLICY IF EXISTS "employees_delete" ON employees;

-- Sales
DROP POLICY IF EXISTS "sales_select" ON sales;
DROP POLICY IF EXISTS "sales_insert" ON sales;
DROP POLICY IF EXISTS "sales_update" ON sales;
DROP POLICY IF EXISTS "sales_delete" ON sales;
DROP POLICY IF EXISTS "sales_all" ON sales;

-- Sale Details
DROP POLICY IF EXISTS "sale_details_select" ON sale_details;
DROP POLICY IF EXISTS "sale_details_insert" ON sale_details;
DROP POLICY IF EXISTS "sale_details_update" ON sale_details;
DROP POLICY IF EXISTS "sale_details_delete" ON sale_details;
DROP POLICY IF EXISTS "sale_details_all" ON sale_details;

-- Products
DROP POLICY IF EXISTS "products_select" ON products;
DROP POLICY IF EXISTS "products_insert" ON products;
DROP POLICY IF EXISTS "products_update" ON products;
DROP POLICY IF EXISTS "products_delete" ON products;
DROP POLICY IF EXISTS "products_all" ON products;

-- PASO 3: Habilitar RLS
-- =====================================================

ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- PASO 4: Políticas para BUSINESSES
-- =====================================================

-- SELECT: Ver solo tus negocios
CREATE POLICY "businesses_select"
  ON businesses FOR SELECT
  TO authenticated
  USING (id IN (SELECT get_user_businesses()));

-- INSERT: Cualquier usuario puede crear negocio
CREATE POLICY "businesses_insert"
  ON businesses FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- UPDATE: Solo el creador puede actualizar
CREATE POLICY "businesses_update"
  ON businesses FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- DELETE: Solo el creador puede eliminar
CREATE POLICY "businesses_delete"
  ON businesses FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- PASO 5: Políticas para EMPLOYEES
-- =====================================================

-- SELECT: Ver empleados de tus negocios
CREATE POLICY "employees_select"
  ON employees FOR SELECT
  TO authenticated
  USING (business_id IN (SELECT get_user_businesses()));

-- INSERT: Crear empleados en tus negocios
CREATE POLICY "employees_insert"
  ON employees FOR INSERT
  TO authenticated
  WITH CHECK (business_id IN (SELECT get_user_businesses()));

-- UPDATE: Actualizar empleados de tus negocios
CREATE POLICY "employees_update"
  ON employees FOR UPDATE
  TO authenticated
  USING (business_id IN (SELECT get_user_businesses()))
  WITH CHECK (business_id IN (SELECT get_user_businesses()));

-- DELETE: Eliminar empleados de tus negocios
CREATE POLICY "employees_delete"
  ON employees FOR DELETE
  TO authenticated
  USING (business_id IN (SELECT get_user_businesses()));

-- PASO 6: Políticas para SALES
-- =====================================================

CREATE POLICY "sales_all"
  ON sales FOR ALL
  TO authenticated
  USING (business_id IN (SELECT get_user_businesses()))
  WITH CHECK (business_id IN (SELECT get_user_businesses()));

-- PASO 7: Políticas para SALE_DETAILS
-- =====================================================

CREATE POLICY "sale_details_all"
  ON sale_details FOR ALL
  TO authenticated
  USING (
    sale_id IN (
      SELECT id FROM sales
      WHERE business_id IN (SELECT get_user_businesses())
    )
  );

-- PASO 8: Políticas para PRODUCTS
-- =====================================================

CREATE POLICY "products_all"
  ON products FOR ALL
  TO authenticated
  USING (business_id IN (SELECT get_user_businesses()))
  WITH CHECK (business_id IN (SELECT get_user_businesses()));

-- PASO 9: Políticas para SUPPLIERS (si existe)
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'suppliers') THEN
    ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "suppliers_all" ON suppliers;
    
    CREATE POLICY "suppliers_all"
      ON suppliers FOR ALL
      TO authenticated
      USING (business_id IN (SELECT get_user_businesses()))
      WITH CHECK (business_id IN (SELECT get_user_businesses()));
  END IF;
END $$;

-- PASO 10: Políticas para PURCHASES (si existe)
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'purchases') THEN
    ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "purchases_all" ON purchases;
    
    CREATE POLICY "purchases_all"
      ON purchases FOR ALL
      TO authenticated
      USING (business_id IN (SELECT get_user_businesses()))
      WITH CHECK (business_id IN (SELECT get_user_businesses()));
  END IF;
END $$;

-- PASO 11: Políticas para PURCHASE_DETAILS (si existe)
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'purchase_details') THEN
    ALTER TABLE purchase_details ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "purchase_details_all" ON purchase_details;
    
    CREATE POLICY "purchase_details_all"
      ON purchase_details FOR ALL
      TO authenticated
      USING (
        purchase_id IN (
          SELECT id FROM purchases
          WHERE business_id IN (SELECT get_user_businesses())
        )
      );
  END IF;
END $$;

-- PASO 12: Políticas para INVOICES (si existe)
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'invoices') THEN
    ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "invoices_all" ON invoices;
    
    CREATE POLICY "invoices_all"
      ON invoices FOR ALL
      TO authenticated
      USING (business_id IN (SELECT get_user_businesses()))
      WITH CHECK (business_id IN (SELECT get_user_businesses()));
  END IF;
END $$;

-- PASO 13: Políticas para INVOICE_ITEMS (si existe)
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'invoice_items') THEN
    ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "invoice_items_all" ON invoice_items;
    
    CREATE POLICY "invoice_items_all"
      ON invoice_items FOR ALL
      TO authenticated
      USING (
        invoice_id IN (
          SELECT id FROM invoices
          WHERE business_id IN (SELECT get_user_businesses())
        )
      );
  END IF;
END $$;

-- =====================================================
-- VERIFICACIÓN FINAL
-- =====================================================

-- Verificar que la función existe
SELECT proname, prosecdef 
FROM pg_proc 
WHERE proname = 'get_user_businesses';

-- Verificar políticas creadas
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd as operation
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Verificar que RLS está habilitado
SELECT 
  schemaname,
  tablename,
  CASE WHEN rowsecurity THEN 'HABILITADO' ELSE 'DESHABILITADO' END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('businesses', 'employees', 'sales', 'sale_details', 'products')
ORDER BY tablename;

-- =====================================================
-- NOTAS IMPORTANTES
-- =====================================================
/*
✅ VENTAJAS DE ESTA SOLUCIÓN:

1. Función get_user_businesses() usa SECURITY DEFINER
   - Bypasea RLS durante su ejecución
   - Elimina dependencias circulares
   - Es segura porque solo usa auth.uid()

2. Políticas simples y predecibles
   - Fáciles de debuggear
   - Sin joins complejos
   - Consistentes en todas las tablas

3. Rendimiento optimizado
   - Función rápida con UNION
   - Índices en business_id y user_id

4. Mantenible y escalable
   - Agregar nuevas tablas es trivial
   - Lógica centralizada en una función

⚠️ SI ALGO FALLA:

1. Verificar que auth.uid() devuelve un valor:
   SELECT auth.uid();

2. Verificar que la función devuelve IDs:
   SELECT * FROM get_user_businesses();

3. Deshabilitar RLS temporalmente:
   ALTER TABLE nombre_tabla DISABLE ROW LEVEL SECURITY;

4. Ver errores de policies:
   -- En Supabase Dashboard → Logs → Postgres Logs
*/
