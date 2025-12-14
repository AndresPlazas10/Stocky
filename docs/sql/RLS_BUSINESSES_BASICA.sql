-- =====================================================
-- RLS SUPER BÁSICA PARA BUSINESSES
-- =====================================================
-- Script minimalista - Solo lo esencial
-- =====================================================

-- PASO 1: Limpiar TODO
-- =====================================================
DROP POLICY IF EXISTS "businesses_select" ON businesses;
DROP POLICY IF EXISTS "businesses_select_policy" ON businesses;
DROP POLICY IF EXISTS "businesses_select_simple" ON businesses;
DROP POLICY IF EXISTS "businesses_select_with_employees" ON businesses;
DROP POLICY IF EXISTS "businesses_select_secure" ON businesses;
DROP POLICY IF EXISTS "businesses_insert" ON businesses;
DROP POLICY IF EXISTS "businesses_insert_policy" ON businesses;
DROP POLICY IF EXISTS "businesses_insert_simple" ON businesses;
DROP POLICY IF EXISTS "businesses_insert_secure" ON businesses;
DROP POLICY IF EXISTS "businesses_allow_insert" ON businesses;
DROP POLICY IF EXISTS "businesses_update" ON businesses;
DROP POLICY IF EXISTS "businesses_update_policy" ON businesses;
DROP POLICY IF EXISTS "businesses_update_simple" ON businesses;
DROP POLICY IF EXISTS "businesses_update_secure" ON businesses;
DROP POLICY IF EXISTS "businesses_delete" ON businesses;
DROP POLICY IF EXISTS "businesses_delete_policy" ON businesses;
DROP POLICY IF EXISTS "businesses_delete_simple" ON businesses;
DROP POLICY IF EXISTS "businesses_delete_secure" ON businesses;
DROP POLICY IF EXISTS "businesses_allow_all" ON businesses;

-- PASO 2: Habilitar RLS
-- =====================================================
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;

-- PASO 3: Crear SOLO 4 políticas básicas
-- =====================================================

-- INSERT: Cualquier usuario autenticado puede crear
CREATE POLICY "businesses_insert"
  ON businesses
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- SELECT: Ver negocios propios O donde eres empleado
CREATE POLICY "businesses_select"
  ON businesses
  FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM employees 
      WHERE employees.business_id = businesses.id 
        AND employees.user_id = auth.uid()
        AND employees.is_active = true
    )
  );

-- UPDATE: Solo actualizar tus propios negocios
CREATE POLICY "businesses_update"
  ON businesses
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- DELETE: Solo eliminar tus propios negocios
CREATE POLICY "businesses_delete"
  ON businesses
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

-- Debe mostrar exactamente 4 políticas
SELECT 
  policyname,
  cmd,
  CASE 
    WHEN cmd = 'INSERT' THEN '✅ Crear negocio'
    WHEN cmd = 'SELECT' THEN '✅ Ver negocios'
    WHEN cmd = 'UPDATE' THEN '✅ Actualizar negocio'
    WHEN cmd = 'DELETE' THEN '✅ Eliminar negocio'
  END as descripcion
FROM pg_policies
WHERE tablename = 'businesses'
ORDER BY cmd;

-- Ver tu user_id
SELECT auth.uid() as mi_user_id;

-- =====================================================
-- LISTO PARA USAR
-- =====================================================
-- Ahora puedes crear negocios desde la app
-- La RLS validará que created_by = tu user_id
-- =====================================================
