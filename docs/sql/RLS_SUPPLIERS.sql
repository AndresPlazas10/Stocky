-- =====================================================
-- POLÍTICAS RLS - TABLA SUPPLIERS
-- =====================================================
-- Políticas de seguridad a nivel de fila para suppliers
-- Los proveedores pertenecen a un negocio (business_id)
-- =====================================================

-- =====================================================
-- LIMPIAR POLÍTICAS EXISTENTES
-- =====================================================

DROP POLICY IF EXISTS "suppliers_select_policy" ON suppliers;
DROP POLICY IF EXISTS "suppliers_insert_policy" ON suppliers;
DROP POLICY IF EXISTS "suppliers_update_policy" ON suppliers;
DROP POLICY IF EXISTS "suppliers_delete_policy" ON suppliers;

-- =====================================================
-- ASEGURAR QUE RLS ESTÁ HABILITADO
-- =====================================================

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- POLÍTICA 1: SELECT (Ver/Leer proveedores)
-- =====================================================
-- Permite ver proveedores de tus negocios

CREATE POLICY "suppliers_select_policy"
ON suppliers
FOR SELECT
TO authenticated
USING (
  -- El proveedor pertenece a un negocio donde soy owner o empleado
  business_id IN (SELECT business_id FROM get_user_business_ids())
);

COMMENT ON POLICY "suppliers_select_policy" ON suppliers IS
  'Permite ver proveedores de negocios donde eres owner o empleado activo';

-- =====================================================
-- POLÍTICA 2: INSERT (Crear proveedores)
-- =====================================================
-- Puedes crear proveedores en tus negocios

CREATE POLICY "suppliers_insert_policy"
ON suppliers
FOR INSERT
TO authenticated
WITH CHECK (
  -- Solo puedes crear proveedores en negocios donde tienes acceso
  business_id IN (SELECT business_id FROM get_user_business_ids())
);

COMMENT ON POLICY "suppliers_insert_policy" ON suppliers IS
  'Permite crear proveedores en negocios donde eres owner o empleado activo';

-- =====================================================
-- POLÍTICA 3: UPDATE (Actualizar proveedores)
-- =====================================================
-- Puedes actualizar proveedores de tus negocios
-- No puedes cambiar el business_id a otro negocio

CREATE POLICY "suppliers_update_policy"
ON suppliers
FOR UPDATE
TO authenticated
USING (
  -- El proveedor pertenece a tu negocio
  business_id IN (SELECT business_id FROM get_user_business_ids())
)
WITH CHECK (
  -- No puedes mover el proveedor a otro negocio
  business_id IN (SELECT business_id FROM get_user_business_ids())
);

COMMENT ON POLICY "suppliers_update_policy" ON suppliers IS
  'Permite actualizar proveedores de tus negocios, sin cambiar el business_id a otro negocio';

-- =====================================================
-- POLÍTICA 4: DELETE (Eliminar proveedores)
-- =====================================================
-- Puedes eliminar proveedores de tus negocios

CREATE POLICY "suppliers_delete_policy"
ON suppliers
FOR DELETE
TO authenticated
USING (
  -- El proveedor pertenece a tu negocio
  business_id IN (SELECT business_id FROM get_user_business_ids())
);

COMMENT ON POLICY "suppliers_delete_policy" ON suppliers IS
  'Permite eliminar proveedores de negocios donde eres owner o empleado activo';

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '=============================================';
  RAISE NOTICE '✅ POLÍTICAS RLS CREADAS - SUPPLIERS';
  RAISE NOTICE '=============================================';
  RAISE NOTICE '';
  RAISE NOTICE '📋 POLÍTICAS ACTIVAS:';
  RAISE NOTICE '';
  RAISE NOTICE '1️⃣  SELECT (Ver proveedores):';
  RAISE NOTICE '    ✓ Solo proveedores de TUS negocios';
  RAISE NOTICE '    ✓ Basado en business_id';
  RAISE NOTICE '';
  RAISE NOTICE '2️⃣  INSERT (Crear proveedores):';
  RAISE NOTICE '    ✓ Solo en negocios donde tienes acceso';
  RAISE NOTICE '    ✓ No puedes crear proveedores en negocios ajenos';
  RAISE NOTICE '';
  RAISE NOTICE '3️⃣  UPDATE (Actualizar proveedores):';
  RAISE NOTICE '    ✓ Solo proveedores de TUS negocios';
  RAISE NOTICE '    ✓ No puedes cambiar business_id';
  RAISE NOTICE '    ✓ Puedes actualizar nombre, contacto, dirección';
  RAISE NOTICE '';
  RAISE NOTICE '4️⃣  DELETE (Eliminar proveedores):';
  RAISE NOTICE '    ✓ Solo proveedores de TUS negocios';
  RAISE NOTICE '    ✓ Owner y empleados pueden eliminar';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 SEGURIDAD:';
  RAISE NOTICE '    ✓ RLS habilitado en suppliers';
  RAISE NOTICE '    ✓ Usa get_user_business_ids() (SECURITY DEFINER)';
  RAISE NOTICE '    ✓ Aislamiento por business_id';
  RAISE NOTICE '';
  RAISE NOTICE '💡 RECORDATORIO:';
  RAISE NOTICE '    Los proveedores están relacionados con:';
  RAISE NOTICE '    - purchases (compras realizadas al proveedor)';
  RAISE NOTICE '    - Campos típicos: name, contact, phone, email, address';
  RAISE NOTICE '';
  RAISE NOTICE '=============================================';
END $$;

-- =====================================================
-- QUERY DE VERIFICACIÓN
-- =====================================================

SELECT 
  '=== POLÍTICAS RLS EN SUPPLIERS ===' AS info;

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
  AND tablename = 'suppliers'
ORDER BY cmd, policyname;
