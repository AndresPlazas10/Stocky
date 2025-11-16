-- ============================================
-- 🔐 POLÍTICAS RLS PARA STOCKLY
-- ============================================
-- Ejecutar en Supabase SQL Editor
-- Dashboard → SQL Editor → New Query → Pegar y ejecutar

-- ============================================
-- TABLA: products
-- ============================================

-- Habilitar RLS en products (si no está habilitado)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Política: SELECT (leer productos)
-- Permitir a usuarios autenticados leer todos los productos de su negocio
DROP POLICY IF EXISTS "Users can view products from their business" ON products;
CREATE POLICY "Users can view products from their business"
ON products FOR SELECT
TO authenticated
USING (
  business_id IN (
    SELECT id FROM businesses WHERE email = auth.email()
  )
  OR
  business_id IN (
    SELECT business_id FROM employee_invitations 
    WHERE email = auth.email() AND is_approved = true
  )
);

-- Política: INSERT (crear productos)
-- Permitir a usuarios autenticados crear productos en su negocio
DROP POLICY IF EXISTS "Users can insert products in their business" ON products;
CREATE POLICY "Users can insert products in their business"
ON products FOR INSERT
TO authenticated
WITH CHECK (
  business_id IN (
    SELECT id FROM businesses WHERE email = auth.email()
  )
  OR
  business_id IN (
    SELECT business_id FROM employee_invitations 
    WHERE email = auth.email() AND is_approved = true
  )
);

-- Política: UPDATE (actualizar productos)
-- Permitir a usuarios autenticados actualizar productos de su negocio
DROP POLICY IF EXISTS "Users can update products in their business" ON products;
CREATE POLICY "Users can update products in their business"
ON products FOR UPDATE
TO authenticated
USING (
  business_id IN (
    SELECT id FROM businesses WHERE email = auth.email()
  )
  OR
  business_id IN (
    SELECT business_id FROM employee_invitations 
    WHERE email = auth.email() AND is_approved = true
  )
)
WITH CHECK (
  business_id IN (
    SELECT id FROM businesses WHERE email = auth.email()
  )
  OR
  business_id IN (
    SELECT business_id FROM employee_invitations 
    WHERE email = auth.email() AND is_approved = true
  )
);

-- Política: DELETE (eliminar productos)
-- Permitir a usuarios autenticados eliminar productos de su negocio
DROP POLICY IF EXISTS "Users can delete products from their business" ON products;
CREATE POLICY "Users can delete products from their business"
ON products FOR DELETE
TO authenticated
USING (
  business_id IN (
    SELECT id FROM businesses WHERE email = auth.email()
  )
  OR
  business_id IN (
    SELECT business_id FROM employee_invitations 
    WHERE email = auth.email() AND is_approved = true
  )
);

-- ============================================
-- TABLA: sales (por si acaso)
-- ============================================

ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view sales from their business" ON sales;
CREATE POLICY "Users can view sales from their business"
ON sales FOR SELECT
TO authenticated
USING (
  business_id IN (
    SELECT id FROM businesses WHERE email = auth.email()
  )
  OR
  business_id IN (
    SELECT business_id FROM employee_invitations 
    WHERE email = auth.email() AND is_approved = true
  )
);

DROP POLICY IF EXISTS "Users can insert sales in their business" ON sales;
CREATE POLICY "Users can insert sales in their business"
ON sales FOR INSERT
TO authenticated
WITH CHECK (
  business_id IN (
    SELECT id FROM businesses WHERE email = auth.email()
  )
  OR
  business_id IN (
    SELECT business_id FROM employee_invitations 
    WHERE email = auth.email() AND is_approved = true
  )
);

DROP POLICY IF EXISTS "Users can update sales in their business" ON sales;
CREATE POLICY "Users can update sales in their business"
ON sales FOR UPDATE
TO authenticated
USING (
  business_id IN (
    SELECT id FROM businesses WHERE email = auth.email()
  )
  OR
  business_id IN (
    SELECT business_id FROM employee_invitations 
    WHERE email = auth.email() AND is_approved = true
  )
);

DROP POLICY IF EXISTS "Users can delete sales from their business" ON sales;
CREATE POLICY "Users can delete sales from their business"
ON sales FOR DELETE
TO authenticated
USING (
  business_id IN (
    SELECT id FROM businesses WHERE email = auth.email()
  )
  OR
  business_id IN (
    SELECT business_id FROM employee_invitations 
    WHERE email = auth.email() AND is_approved = true
  )
);

-- ============================================
-- TABLA: customers
-- ============================================

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view customers from their business" ON customers;
CREATE POLICY "Users can view customers from their business"
ON customers FOR SELECT
TO authenticated
USING (
  business_id IN (
    SELECT id FROM businesses WHERE email = auth.email()
  )
  OR
  business_id IN (
    SELECT business_id FROM employee_invitations 
    WHERE email = auth.email() AND is_approved = true
  )
);

DROP POLICY IF EXISTS "Users can insert customers in their business" ON customers;
CREATE POLICY "Users can insert customers in their business"
ON customers FOR INSERT
TO authenticated
WITH CHECK (
  business_id IN (
    SELECT id FROM businesses WHERE email = auth.email()
  )
  OR
  business_id IN (
    SELECT business_id FROM employee_invitations 
    WHERE email = auth.email() AND is_approved = true
  )
);

DROP POLICY IF EXISTS "Users can update customers in their business" ON customers;
CREATE POLICY "Users can update customers in their business"
ON customers FOR UPDATE
TO authenticated
USING (
  business_id IN (
    SELECT id FROM businesses WHERE email = auth.email()
  )
  OR
  business_id IN (
    SELECT business_id FROM employee_invitations 
    WHERE email = auth.email() AND is_approved = true
  )
);

DROP POLICY IF EXISTS "Users can delete customers from their business" ON customers;
CREATE POLICY "Users can delete customers from their business"
ON customers FOR DELETE
TO authenticated
USING (
  business_id IN (
    SELECT id FROM businesses WHERE email = auth.email()
  )
  OR
  business_id IN (
    SELECT business_id FROM employee_invitations 
    WHERE email = auth.email() AND is_approved = true
  )
);

-- ============================================
-- TABLA: suppliers (proveedores)
-- ============================================

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view suppliers from their business" ON suppliers;
CREATE POLICY "Users can view suppliers from their business"
ON suppliers FOR SELECT
TO authenticated
USING (
  business_id IN (
    SELECT id FROM businesses WHERE email = auth.email()
  )
  OR
  business_id IN (
    SELECT business_id FROM employee_invitations 
    WHERE email = auth.email() AND is_approved = true
  )
);

DROP POLICY IF EXISTS "Users can insert suppliers in their business" ON suppliers;
CREATE POLICY "Users can insert suppliers in their business"
ON suppliers FOR INSERT
TO authenticated
WITH CHECK (
  business_id IN (
    SELECT id FROM businesses WHERE email = auth.email()
  )
  OR
  business_id IN (
    SELECT business_id FROM employee_invitations 
    WHERE email = auth.email() AND is_approved = true
  )
);

DROP POLICY IF EXISTS "Users can update suppliers in their business" ON suppliers;
CREATE POLICY "Users can update suppliers in their business"
ON suppliers FOR UPDATE
TO authenticated
USING (
  business_id IN (
    SELECT id FROM businesses WHERE email = auth.email()
  )
  OR
  business_id IN (
    SELECT business_id FROM employee_invitations 
    WHERE email = auth.email() AND is_approved = true
  )
);

DROP POLICY IF EXISTS "Users can delete suppliers from their business" ON suppliers;
CREATE POLICY "Users can delete suppliers from their business"
ON suppliers FOR DELETE
TO authenticated
USING (
  business_id IN (
    SELECT id FROM businesses WHERE email = auth.email()
  )
  OR
  business_id IN (
    SELECT business_id FROM employee_invitations 
    WHERE email = auth.email() AND is_approved = true
  )
);

-- ============================================
-- TABLA: invoices (facturas)
-- ============================================

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view invoices from their business" ON invoices;
CREATE POLICY "Users can view invoices from their business"
ON invoices FOR SELECT
TO authenticated
USING (
  business_id IN (
    SELECT id FROM businesses WHERE email = auth.email()
  )
  OR
  business_id IN (
    SELECT business_id FROM employee_invitations 
    WHERE email = auth.email() AND is_approved = true
  )
);

DROP POLICY IF EXISTS "Users can insert invoices in their business" ON invoices;
CREATE POLICY "Users can insert invoices in their business"
ON invoices FOR INSERT
TO authenticated
WITH CHECK (
  business_id IN (
    SELECT id FROM businesses WHERE email = auth.email()
  )
  OR
  business_id IN (
    SELECT business_id FROM employee_invitations 
    WHERE email = auth.email() AND is_approved = true
  )
);

DROP POLICY IF EXISTS "Users can update invoices in their business" ON invoices;
CREATE POLICY "Users can update invoices in their business"
ON invoices FOR UPDATE
TO authenticated
USING (
  business_id IN (
    SELECT id FROM businesses WHERE email = auth.email()
  )
  OR
  business_id IN (
    SELECT business_id FROM employee_invitations 
    WHERE email = auth.email() AND is_approved = true
  )
);

DROP POLICY IF EXISTS "Users can delete invoices from their business" ON invoices;
CREATE POLICY "Users can delete invoices from their business"
ON invoices FOR DELETE
TO authenticated
USING (
  business_id IN (
    SELECT id FROM businesses WHERE email = auth.email()
  )
  OR
  business_id IN (
    SELECT business_id FROM employee_invitations 
    WHERE email = auth.email() AND is_approved = true
  )
);

-- ============================================
-- TABLA: employees
-- ============================================

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view employees from their business" ON employees;
CREATE POLICY "Users can view employees from their business"
ON employees FOR SELECT
TO authenticated
USING (
  business_id IN (
    SELECT id FROM businesses WHERE email = auth.email()
  )
  OR
  business_id IN (
    SELECT business_id FROM employee_invitations 
    WHERE email = auth.email() AND is_approved = true
  )
  OR
  user_id = auth.uid()
);

DROP POLICY IF EXISTS "Users can insert employees in their business" ON employees;
CREATE POLICY "Users can insert employees in their business"
ON employees FOR INSERT
TO authenticated
WITH CHECK (
  business_id IN (
    SELECT id FROM businesses WHERE email = auth.email()
  )
  OR
  user_id = auth.uid()
);

DROP POLICY IF EXISTS "Users can update employees in their business" ON employees;
CREATE POLICY "Users can update employees in their business"
ON employees FOR UPDATE
TO authenticated
USING (
  business_id IN (
    SELECT id FROM businesses WHERE email = auth.email()
  )
  OR
  user_id = auth.uid()
);

DROP POLICY IF EXISTS "Users can delete employees from their business" ON employees;
CREATE POLICY "Users can delete employees from their business"
ON employees FOR DELETE
TO authenticated
USING (
  business_id IN (
    SELECT id FROM businesses WHERE email = auth.email()
  )
);

-- ============================================
-- TABLA: employee_invitations
-- ============================================

ALTER TABLE employee_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view employee invitations" ON employee_invitations;
CREATE POLICY "Users can view employee invitations"
ON employee_invitations FOR SELECT
TO authenticated
USING (
  business_id IN (
    SELECT id FROM businesses WHERE email = auth.email()
  )
  OR
  email = auth.email()
);

DROP POLICY IF EXISTS "Users can insert employee invitations" ON employee_invitations;
CREATE POLICY "Users can insert employee invitations"
ON employee_invitations FOR INSERT
TO authenticated
WITH CHECK (
  business_id IN (
    SELECT id FROM businesses WHERE email = auth.email()
  )
);

DROP POLICY IF EXISTS "Users can update employee invitations" ON employee_invitations;
CREATE POLICY "Users can update employee invitations"
ON employee_invitations FOR UPDATE
TO authenticated
USING (
  business_id IN (
    SELECT id FROM businesses WHERE email = auth.email()
  )
  OR
  email = auth.email()
);

DROP POLICY IF EXISTS "Users can delete employee invitations" ON employee_invitations;
CREATE POLICY "Users can delete employee invitations"
ON employee_invitations FOR DELETE
TO authenticated
USING (
  business_id IN (
    SELECT id FROM businesses WHERE email = auth.email()
  )
);

-- ============================================
-- TABLA: users (usuarios del sistema)
-- ============================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own data" ON users;
CREATE POLICY "Users can view their own data"
ON users FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR
  business_id IN (
    SELECT id FROM businesses WHERE email = auth.email()
  )
  OR
  business_id IN (
    SELECT business_id FROM employee_invitations 
    WHERE email = auth.email() AND is_approved = true
  )
);

DROP POLICY IF EXISTS "Users can insert their own data" ON users;
CREATE POLICY "Users can insert their own data"
ON users FOR INSERT
TO authenticated
WITH CHECK (
  id = auth.uid()
  OR
  business_id IN (
    SELECT id FROM businesses WHERE email = auth.email()
  )
);

DROP POLICY IF EXISTS "Users can update their own data" ON users;
CREATE POLICY "Users can update their own data"
ON users FOR UPDATE
TO authenticated
USING (
  id = auth.uid()
  OR
  business_id IN (
    SELECT id FROM businesses WHERE email = auth.email()
  )
);

DROP POLICY IF EXISTS "Users can delete from their business" ON users;
CREATE POLICY "Users can delete from their business"
ON users FOR DELETE
TO authenticated
USING (
  business_id IN (
    SELECT id FROM businesses WHERE email = auth.email()
  )
);

-- ============================================
-- TABLA: businesses
-- ============================================

ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their business" ON businesses;
CREATE POLICY "Users can view their business"
ON businesses FOR SELECT
TO authenticated
USING (
  email = auth.email()
  OR
  id IN (
    SELECT business_id FROM employee_invitations 
    WHERE email = auth.email() AND is_approved = true
  )
);

DROP POLICY IF EXISTS "Users can insert their business" ON businesses;
CREATE POLICY "Users can insert their business"
ON businesses FOR INSERT
TO authenticated
WITH CHECK (
  email = auth.email()
);

DROP POLICY IF EXISTS "Users can update their business" ON businesses;
CREATE POLICY "Users can update their business"
ON businesses FOR UPDATE
TO authenticated
USING (
  email = auth.email()
);

DROP POLICY IF EXISTS "Users can delete their business" ON businesses;
CREATE POLICY "Users can delete their business"
ON businesses FOR DELETE
TO authenticated
USING (
  email = auth.email()
);

-- ============================================
-- VERIFICACIÓN
-- ============================================
-- Ejecuta esto para verificar que las políticas se crearon:

SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename IN ('products', 'sales', 'customers', 'suppliers', 'invoices', 'employees', 'employee_invitations', 'users', 'businesses')
ORDER BY tablename, policyname;
