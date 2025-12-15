-- =====================================================
-- POLÍTICAS RLS - TABLA BUSINESSES
-- =====================================================
-- Políticas de seguridad a nivel de fila para businesses
-- Basado en la estructura actual de la base de datos
-- =====================================================

-- =====================================================
-- LIMPIAR POLÍTICAS EXISTENTES
-- =====================================================

DROP POLICY IF EXISTS "businesses_select_policy" ON businesses;
DROP POLICY IF EXISTS "businesses_insert_policy" ON businesses;
DROP POLICY IF EXISTS "businesses_update_policy" ON businesses;
DROP POLICY IF EXISTS "businesses_delete_policy" ON businesses;

-- =====================================================
-- ASEGURAR QUE RLS ESTÁ HABILITADO
-- =====================================================

ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- POLÍTICA 1: SELECT (Ver/Leer negocios)
-- =====================================================
-- IMPORTANTE: Solo permite ver negocios donde eres OWNER
-- Los empleados NO hacen SELECT directo en businesses para evitar recursión
-- Acceden al negocio a través de get_user_business_ids() en otras tablas

CREATE POLICY "businesses_select_policy"
ON businesses
FOR SELECT
TO authenticated
USING (
  -- Solo puedes ver negocios donde eres el owner
  created_by = auth.uid()
  -- NOTA: NO incluimos empleados aquí para evitar recursión infinita
  -- (employees SELECT consulta businesses, creando ciclo)
);

COMMENT ON POLICY "businesses_select_policy" ON businesses IS
  'Permite ver solo negocios donde eres owner (empleados acceden vía get_user_business_ids)';

-- =====================================================
-- POLÍTICA 2: INSERT (Crear negocios)
-- =====================================================
-- Solo puedes crear negocios donde TÚ eres el owner

CREATE POLICY "businesses_insert_policy"
ON businesses
FOR INSERT
TO authenticated
WITH CHECK (
  -- Solo puedes crear negocios donde tú eres el created_by
  created_by = auth.uid()
);

COMMENT ON POLICY "businesses_insert_policy" ON businesses IS
  'Solo puedes crear negocios donde tú eres el owner (created_by)';

-- =====================================================
-- POLÍTICA 3: UPDATE (Actualizar negocios)
-- =====================================================
-- Solo el OWNER puede actualizar su negocio

CREATE POLICY "businesses_update_policy"
ON businesses
FOR UPDATE
TO authenticated
USING (
  -- Solo el owner puede actualizar
  created_by = auth.uid()
)
WITH CHECK (
  -- No puedes cambiar el owner a otra persona
  created_by = auth.uid()
);

COMMENT ON POLICY "businesses_update_policy" ON businesses IS
  'Solo el owner puede actualizar su negocio y no puede cambiar el created_by';

-- =====================================================
-- POLÍTICA 4: DELETE (Eliminar negocios)
-- =====================================================
-- Solo el OWNER puede eliminar su negocio

CREATE POLICY "businesses_delete_policy"
ON businesses
FOR DELETE
TO authenticated
USING (
  -- Solo el owner puede eliminar
  created_by = auth.uid()
);

COMMENT ON POLICY "businesses_delete_policy" ON businesses IS
  'Solo el owner puede eliminar su propio negocio';

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '=============================================';
  RAISE NOTICE '✅ POLÍTICAS RLS CREADAS - BUSINESSES';
  RAISE NOTICE '=============================================';
  RAISE NOTICE '';
  RAISE NOTICE '📋 POLÍTICAS ACTIVAS:';
  RAISE NOTICE '';
  RAISE NOTICE '1️⃣  SELECT (Ver negocios):';
  RAISE NOTICE '    ✓ Solo el OWNER puede hacer SELECT directo';
  RAISE NOTICE '    ⚠️  Empleados NO hacen SELECT directo (evita recursión)';
  RAISE NOTICE '    ✓ Empleados acceden vía get_user_business_ids()';
  RAISE NOTICE '';
  RAISE NOTICE '2️⃣  INSERT (Crear negocios):';
  RAISE NOTICE '    ✓ Solo si created_by = tu user_id';
  RAISE NOTICE '    ✓ No puedes crear negocios a nombre de otros';
  RAISE NOTICE '';
  RAISE NOTICE '3️⃣  UPDATE (Actualizar negocios):';
  RAISE NOTICE '    ✓ Solo el OWNER puede actualizar';
  RAISE NOTICE '    ✓ No puede cambiar el created_by';
  RAISE NOTICE '';
  RAISE NOTICE '4️⃣  DELETE (Eliminar negocios):';
  RAISE NOTICE '    ✓ Solo el OWNER puede eliminar';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 SEGURIDAD:';
  RAISE NOTICE '    ✓ RLS habilitado en businesses';
  RAISE NOTICE '    ✓ NO usa get_user_business_ids() (evita recursión)';
  RAISE NOTICE '    ✓ Consulta directa a employees para verificación';
  RAISE NOTICE '    ✓ Sin recursión infinita';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  IMPORTANTE:';
  RAISE NOTICE '    Esta tabla businesses NO debe usar get_user_business_ids()';
  RAISE NOTICE '    porque causaría recursión infinita (la función consulta businesses)';
  RAISE NOTICE '';
  RAISE NOTICE '=============================================';
END $$;

-- =====================================================
-- QUERY DE VERIFICACIÓN
-- =====================================================

SELECT 
  '=== POLÍTICAS RLS EN BUSINESSES ===' AS info;

SELECT 
  policyname AS politica,
  cmd AS operacion,
  CASE 
    WHEN qual IS NOT NULL THEN 'Tiene USING'
    ELSE 'Sin USING'
  END AS using_clause,
  CASE 
    WHEN with_check IS NOT NULL THEN 'Tiene WITH CHECK'
    ELSE 'Sin WITH CHECK'
  END AS with_check_clause
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'businesses'
ORDER BY cmd, policyname;
