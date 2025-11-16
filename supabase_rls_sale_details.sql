-- ============================================
-- 🔐 POLÍTICAS RLS PARA sale_details
-- ============================================

-- Habilitar RLS en sale_details
ALTER TABLE sale_details ENABLE ROW LEVEL SECURITY;

-- Permitir SELECT para usuarios autenticados
DROP POLICY IF EXISTS "Enable read for authenticated users" ON sale_details;
CREATE POLICY "Enable read for authenticated users"
ON sale_details FOR SELECT
TO authenticated
USING (true);

-- Permitir INSERT para usuarios autenticados
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON sale_details;
CREATE POLICY "Enable insert for authenticated users"
ON sale_details FOR INSERT
TO authenticated
WITH CHECK (true);

-- Permitir UPDATE para usuarios autenticados
DROP POLICY IF EXISTS "Enable update for authenticated users" ON sale_details;
CREATE POLICY "Enable update for authenticated users"
ON sale_details FOR UPDATE
TO authenticated
USING (true);

-- Permitir DELETE para usuarios autenticados
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON sale_details;
CREATE POLICY "Enable delete for authenticated users"
ON sale_details FOR DELETE
TO authenticated
USING (true);

SELECT 'Políticas RLS para sale_details aplicadas correctamente' as status;
