-- ============================================
-- 🔐 POLÍTICAS RLS PARA tables
-- ============================================

-- Habilitar RLS en tables
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;

-- Permitir SELECT para usuarios autenticados
DROP POLICY IF EXISTS "Enable read for authenticated users" ON tables;
CREATE POLICY "Enable read for authenticated users"
ON tables FOR SELECT
TO authenticated
USING (true);

-- Permitir INSERT para usuarios autenticados
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON tables;
CREATE POLICY "Enable insert for authenticated users"
ON tables FOR INSERT
TO authenticated
WITH CHECK (true);

-- Permitir UPDATE para usuarios autenticados
DROP POLICY IF EXISTS "Enable update for authenticated users" ON tables;
CREATE POLICY "Enable update for authenticated users"
ON tables FOR UPDATE
TO authenticated
USING (true);

-- Permitir DELETE para usuarios autenticados
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON tables;
CREATE POLICY "Enable delete for authenticated users"
ON tables FOR DELETE
TO authenticated
USING (true);

SELECT 'Políticas RLS para tables aplicadas correctamente' as status;
