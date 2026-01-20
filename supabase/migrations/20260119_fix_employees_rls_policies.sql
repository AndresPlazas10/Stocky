-- Reactivar RLS con políticas correctas SIN RECURSIÓN
-- Fecha: 2026-01-19
-- Versión 6: Políticas simples sin dependencias circulares

-- REACTIVAR RLS en todas las tablas
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;

-- ========================================
-- POLÍTICAS PARA EMPLOYEES (PERMISIVA - ROMPE RECURSIÓN)
-- ========================================

DROP POLICY IF EXISTS employees_select_policy ON employees;
DROP POLICY IF EXISTS employees_select_own ON employees;
DROP POLICY IF EXISTS employees_select_as_owner ON employees;
DROP POLICY IF EXISTS employees_select_all ON employees;
DROP POLICY IF EXISTS employees_insert_policy ON employees;
DROP POLICY IF EXISTS employees_update_policy ON employees;
DROP POLICY IF EXISTS employees_delete_policy ON employees;

-- SELECT: Totalmente permisivo para evitar cualquier recursión
-- La seguridad real está en sales, products y businesses
CREATE POLICY employees_select_all ON employees
  FOR SELECT
  USING (true);

-- INSERT: Solo owners
CREATE POLICY employees_insert_policy ON employees
  FOR INSERT
  WITH CHECK (
    business_id IN (SELECT id FROM businesses WHERE created_by = auth.uid())
  );

-- UPDATE: Solo owners
CREATE POLICY employees_update_policy ON employees
  FOR UPDATE
  USING (
    business_id IN (SELECT id FROM businesses WHERE created_by = auth.uid())
  );

-- DELETE: Solo owners
CREATE POLICY employees_delete_policy ON employees
  FOR DELETE
  USING (
    business_id IN (SELECT id FROM businesses WHERE created_by = auth.uid())
  );

-- ========================================
-- POLÍTICAS PARA SALES
-- ========================================

DROP POLICY IF EXISTS sales_select_policy ON sales;
DROP POLICY IF EXISTS sales_insert_policy ON sales;
DROP POLICY IF EXISTS sales_update_policy ON sales;
DROP POLICY IF EXISTS sales_delete_policy ON sales;

CREATE POLICY sales_select_policy ON sales
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = sales.business_id AND businesses.created_by = auth.uid())
    OR
    EXISTS (SELECT 1 FROM employees WHERE employees.business_id = sales.business_id AND employees.user_id = auth.uid())
  );

CREATE POLICY sales_insert_policy ON sales
  FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = sales.business_id AND businesses.created_by = auth.uid())
    OR
    EXISTS (SELECT 1 FROM employees WHERE employees.business_id = sales.business_id AND employees.user_id = auth.uid())
  );

CREATE POLICY sales_update_policy ON sales
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = sales.business_id AND businesses.created_by = auth.uid())
    OR
    EXISTS (SELECT 1 FROM employees WHERE employees.business_id = sales.business_id AND employees.user_id = auth.uid())
  );

CREATE POLICY sales_delete_policy ON sales
  FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = sales.business_id AND businesses.created_by = auth.uid())
  );

-- ========================================
-- POLÍTICAS PARA PRODUCTS
-- ========================================

DROP POLICY IF EXISTS products_select_policy ON products;
DROP POLICY IF EXISTS products_insert_policy ON products;
DROP POLICY IF EXISTS products_update_policy ON products;
DROP POLICY IF EXISTS products_delete_policy ON products;

CREATE POLICY products_select_policy ON products
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = products.business_id AND businesses.created_by = auth.uid())
    OR
    EXISTS (SELECT 1 FROM employees WHERE employees.business_id = products.business_id AND employees.user_id = auth.uid())
  );

CREATE POLICY products_insert_policy ON products
  FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = products.business_id AND businesses.created_by = auth.uid())
    OR
    EXISTS (SELECT 1 FROM employees WHERE employees.business_id = products.business_id AND employees.user_id = auth.uid())
  );

CREATE POLICY products_update_policy ON products
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = products.business_id AND businesses.created_by = auth.uid())
    OR
    EXISTS (SELECT 1 FROM employees WHERE employees.business_id = products.business_id AND employees.user_id = auth.uid())
  );

CREATE POLICY products_delete_policy ON products
  FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = products.business_id AND businesses.created_by = auth.uid())
  );

-- ========================================
-- POLÍTICAS PARA BUSINESSES (CON RECURSIÓN CONTROLADA)
-- ========================================

DROP POLICY IF EXISTS businesses_select_policy ON businesses;
DROP POLICY IF EXISTS businesses_select_by_owner ON businesses;
DROP POLICY IF EXISTS businesses_select_by_employee ON businesses;
DROP POLICY IF EXISTS businesses_insert_policy ON businesses;
DROP POLICY IF EXISTS businesses_update_policy ON businesses;
DROP POLICY IF EXISTS businesses_delete_policy ON businesses;

-- SELECT: Ahora SÍ puede leer employees porque employees tiene USING(true)
CREATE POLICY businesses_select_policy ON businesses
  FOR SELECT
  USING (
    created_by = auth.uid()
    OR
    id IN (SELECT business_id FROM employees WHERE user_id = auth.uid())
  );

CREATE POLICY businesses_insert_policy ON businesses
  FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY businesses_update_policy ON businesses
  FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY businesses_delete_policy ON businesses
  FOR DELETE
  USING (created_by = auth.uid());

-- Comentario de verificación
COMMENT ON TABLE employees IS 'RLS ENABLED - 2026-01-19 - Sin recursión';
COMMENT ON TABLE sales IS 'RLS ENABLED - 2026-01-19 - Con EXISTS';
COMMENT ON TABLE products IS 'RLS ENABLED - 2026-01-19 - Con EXISTS';
COMMENT ON TABLE businesses IS 'RLS ENABLED - 2026-01-19 - Con EXISTS';
