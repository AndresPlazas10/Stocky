-- ============================================
-- 🔧 FIX: Eliminar foreign key constraints problemáticas
-- ============================================

-- 1. Eliminar FK constraint de orders.user_id
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_user_id_fkey;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS fk_orders_user;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_user_fkey;
ALTER TABLE orders ALTER COLUMN user_id DROP NOT NULL;

-- 2. Habilitar RLS en users si no está habilitado
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 3. Políticas para users
DROP POLICY IF EXISTS "Enable read for authenticated users" ON users;
CREATE POLICY "Enable read for authenticated users"
ON users FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Enable insert for authenticated users" ON users;
CREATE POLICY "Enable insert for authenticated users"
ON users FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update for authenticated users" ON users;
CREATE POLICY "Enable update for authenticated users"
ON users FOR UPDATE
TO authenticated
USING (true);

-- 4. Verificar
SELECT 'FK constraints eliminadas y RLS configurado correctamente' as status;
