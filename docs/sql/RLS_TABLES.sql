-- =====================================================
-- POLÍTICAS RLS - TABLA TABLES
-- =====================================================
-- Políticas de seguridad a nivel de fila para tables
-- Las mesas pertenecen a un negocio (business_id)
-- Usadas en el módulo de restaurante/comandas
-- =====================================================

-- =====================================================
-- LIMPIAR POLÍTICAS EXISTENTES
-- =====================================================

DROP POLICY IF EXISTS "tables_select_policy" ON tables;
DROP POLICY IF EXISTS "tables_insert_policy" ON tables;
DROP POLICY IF EXISTS "tables_update_policy" ON tables;
DROP POLICY IF EXISTS "tables_delete_policy" ON tables;

-- =====================================================
-- ASEGURAR QUE RLS ESTÁ HABILITADO
-- =====================================================

ALTER TABLE tables ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- POLÍTICA 1: SELECT (Ver/Leer mesas)
-- =====================================================
-- Permite ver mesas de tus negocios

CREATE POLICY "tables_select_policy"
ON tables
FOR SELECT
TO authenticated
USING (
  -- La mesa pertenece a un negocio donde soy owner o empleado
  business_id IN (SELECT business_id FROM get_user_business_ids())
);

COMMENT ON POLICY "tables_select_policy" ON tables IS
  'Permite ver mesas de negocios donde eres owner o empleado activo';

-- =====================================================
-- POLÍTICA 2: INSERT (Crear mesas)
-- =====================================================
-- Puedes crear mesas en tus negocios

CREATE POLICY "tables_insert_policy"
ON tables
FOR INSERT
TO authenticated
WITH CHECK (
  -- Solo puedes crear mesas en negocios donde tienes acceso
  business_id IN (SELECT business_id FROM get_user_business_ids())
);

COMMENT ON POLICY "tables_insert_policy" ON tables IS
  'Permite crear mesas en negocios donde eres owner o empleado activo';

-- =====================================================
-- POLÍTICA 3: UPDATE (Actualizar mesas)
-- =====================================================
-- Puedes actualizar mesas de tus negocios
-- No puedes cambiar el business_id a otro negocio

CREATE POLICY "tables_update_policy"
ON tables
FOR UPDATE
TO authenticated
USING (
  -- La mesa pertenece a tu negocio
  business_id IN (SELECT business_id FROM get_user_business_ids())
)
WITH CHECK (
  -- No puedes mover la mesa a otro negocio
  business_id IN (SELECT business_id FROM get_user_business_ids())
);

COMMENT ON POLICY "tables_update_policy" ON tables IS
  'Permite actualizar mesas de tus negocios, sin cambiar el business_id a otro negocio';

-- =====================================================
-- POLÍTICA 4: DELETE (Eliminar mesas)
-- =====================================================
-- Puedes eliminar mesas de tus negocios

CREATE POLICY "tables_delete_policy"
ON tables
FOR DELETE
TO authenticated
USING (
  -- La mesa pertenece a tu negocio
  business_id IN (SELECT business_id FROM get_user_business_ids())
);

COMMENT ON POLICY "tables_delete_policy" ON tables IS
  'Permite eliminar mesas de negocios donde eres owner o empleado activo';

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '=============================================';
  RAISE NOTICE '✅ POLÍTICAS RLS CREADAS - TABLES';
  RAISE NOTICE '=============================================';
  RAISE NOTICE '';
  RAISE NOTICE '📋 POLÍTICAS ACTIVAS:';
  RAISE NOTICE '';
  RAISE NOTICE '1️⃣  SELECT (Ver mesas):';
  RAISE NOTICE '    ✓ Solo mesas de TUS negocios';
  RAISE NOTICE '    ✓ Basado en business_id';
  RAISE NOTICE '';
  RAISE NOTICE '2️⃣  INSERT (Crear mesas):';
  RAISE NOTICE '    ✓ Solo en negocios donde tienes acceso';
  RAISE NOTICE '    ✓ No puedes crear mesas en negocios ajenos';
  RAISE NOTICE '';
  RAISE NOTICE '3️⃣  UPDATE (Actualizar mesas):';
  RAISE NOTICE '    ✓ Solo mesas de TUS negocios';
  RAISE NOTICE '    ✓ No puedes cambiar business_id';
  RAISE NOTICE '    ✓ Útil para cambiar status (available/occupied)';
  RAISE NOTICE '';
  RAISE NOTICE '4️⃣  DELETE (Eliminar mesas):';
  RAISE NOTICE '    ✓ Solo mesas de TUS negocios';
  RAISE NOTICE '    ✓ Owner y empleados pueden eliminar';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 SEGURIDAD:';
  RAISE NOTICE '    ✓ RLS habilitado en tables';
  RAISE NOTICE '    ✓ Usa get_user_business_ids() (SECURITY DEFINER)';
  RAISE NOTICE '    ✓ Aislamiento por business_id';
  RAISE NOTICE '';
  RAISE NOTICE '💡 RECORDATORIO:';
  RAISE NOTICE '    Las mesas están relacionadas con:';
  RAISE NOTICE '    - orders (comandas asignadas a la mesa)';
  RAISE NOTICE '    - Campos típicos: number, status, capacity';
  RAISE NOTICE '    - Módulo restaurante/punto de venta';
  RAISE NOTICE '';
  RAISE NOTICE '=============================================';
END $$;

-- =====================================================
-- QUERY DE VERIFICACIÓN
-- =====================================================

SELECT 
  '=== POLÍTICAS RLS EN TABLES ===' AS info;

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
  AND tablename = 'tables'
ORDER BY cmd, policyname;
