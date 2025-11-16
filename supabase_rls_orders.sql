-- ============================================
-- 🔐 POLÍTICAS RLS PARA orders y order_items
-- ============================================

-- ============================================
-- TABLA: orders
-- ============================================

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Permitir SELECT para usuarios autenticados
DROP POLICY IF EXISTS "Enable read for authenticated users" ON orders;
CREATE POLICY "Enable read for authenticated users"
ON orders FOR SELECT
TO authenticated
USING (true);

-- Permitir INSERT para usuarios autenticados
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON orders;
CREATE POLICY "Enable insert for authenticated users"
ON orders FOR INSERT
TO authenticated
WITH CHECK (true);

-- Permitir UPDATE para usuarios autenticados
DROP POLICY IF EXISTS "Enable update for authenticated users" ON orders;
CREATE POLICY "Enable update for authenticated users"
ON orders FOR UPDATE
TO authenticated
USING (true);

-- Permitir DELETE para usuarios autenticados
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON orders;
CREATE POLICY "Enable delete for authenticated users"
ON orders FOR DELETE
TO authenticated
USING (true);

-- ============================================
-- TABLA: order_items
-- ============================================

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Permitir SELECT para usuarios autenticados
DROP POLICY IF EXISTS "Enable read for authenticated users" ON order_items;
CREATE POLICY "Enable read for authenticated users"
ON order_items FOR SELECT
TO authenticated
USING (true);

-- Permitir INSERT para usuarios autenticados
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON order_items;
CREATE POLICY "Enable insert for authenticated users"
ON order_items FOR INSERT
TO authenticated
WITH CHECK (true);

-- Permitir UPDATE para usuarios autenticados
DROP POLICY IF EXISTS "Enable update for authenticated users" ON order_items;
CREATE POLICY "Enable update for authenticated users"
ON order_items FOR UPDATE
TO authenticated
USING (true);

-- Permitir DELETE para usuarios autenticados
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON order_items;
CREATE POLICY "Enable delete for authenticated users"
ON order_items FOR DELETE
TO authenticated
USING (true);

SELECT 'Políticas RLS para orders y order_items aplicadas correctamente' as status;
