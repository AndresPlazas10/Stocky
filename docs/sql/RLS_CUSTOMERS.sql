-- =====================================================
-- POLÍTICAS RLS - TABLA CUSTOMERS
-- =====================================================
-- Políticas de seguridad a nivel de fila para customers
-- Los clientes pertenecen a un negocio (business_id)
-- =====================================================

-- =====================================================
-- LIMPIAR POLÍTICAS EXISTENTES
-- =====================================================

DROP POLICY IF EXISTS "customers_select_policy" ON customers;
DROP POLICY IF EXISTS "customers_insert_policy" ON customers;
DROP POLICY IF EXISTS "customers_update_policy" ON customers;
DROP POLICY IF EXISTS "customers_delete_policy" ON customers;

-- =====================================================
-- ASEGURAR QUE RLS ESTÁ HABILITADO
-- =====================================================

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- POLÍTICA 1: SELECT (Ver/Leer clientes)
-- =====================================================
-- Permite ver clientes del negocio donde el usuario es:
-- - Owner o empleado activo

CREATE POLICY "customers_select_policy"
ON customers
FOR SELECT
TO authenticated
USING (
  -- El cliente pertenece a un negocio donde soy owner o empleado
  business_id IN (SELECT business_id FROM get_user_business_ids())
);

COMMENT ON POLICY "customers_select_policy" ON customers IS
  'Permite ver clientes de negocios donde eres owner o empleado activo';

-- =====================================================
-- POLÍTICA 2: INSERT (Crear clientes)
-- =====================================================
-- Puedes crear clientes en negocios donde eres owner o empleado activo

CREATE POLICY "customers_insert_policy"
ON customers
FOR INSERT
TO authenticated
WITH CHECK (
  -- Solo puedes crear clientes en negocios donde tienes acceso
  business_id IN (SELECT business_id FROM get_user_business_ids())
);

COMMENT ON POLICY "customers_insert_policy" ON customers IS
  'Permite crear clientes en negocios donde eres owner o empleado activo';

-- =====================================================
-- POLÍTICA 3: UPDATE (Actualizar clientes)
-- =====================================================
-- Puedes actualizar clientes de tu negocio
-- No puedes cambiar el business_id a otro negocio

CREATE POLICY "customers_update_policy"
ON customers
FOR UPDATE
TO authenticated
USING (
  -- El cliente pertenece a tu negocio
  business_id IN (SELECT business_id FROM get_user_business_ids())
)
WITH CHECK (
  -- No puedes mover el cliente a otro negocio
  business_id IN (SELECT business_id FROM get_user_business_ids())
);

COMMENT ON POLICY "customers_update_policy" ON customers IS
  'Permite actualizar clientes de tu negocio, sin cambiar el business_id a otro negocio';

-- =====================================================
-- POLÍTICA 4: DELETE (Eliminar clientes)
-- =====================================================
-- Puedes eliminar clientes de tu negocio
-- (Owner y empleados pueden eliminar - ajustar si solo quieres owner)

CREATE POLICY "customers_delete_policy"
ON customers
FOR DELETE
TO authenticated
USING (
  -- El cliente pertenece a tu negocio
  business_id IN (SELECT business_id FROM get_user_business_ids())
);

COMMENT ON POLICY "customers_delete_policy" ON customers IS
  'Permite eliminar clientes de negocios donde eres owner o empleado activo';

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '=============================================';
  RAISE NOTICE '✅ POLÍTICAS RLS CREADAS - CUSTOMERS';
  RAISE NOTICE '=============================================';
  RAISE NOTICE '';
  RAISE NOTICE '📋 POLÍTICAS ACTIVAS:';
  RAISE NOTICE '';
  RAISE NOTICE '1️⃣  SELECT (Ver clientes):';
  RAISE NOTICE '    ✓ Solo clientes de TUS negocios';
  RAISE NOTICE '    ✓ Basado en business_id';
  RAISE NOTICE '';
  RAISE NOTICE '2️⃣  INSERT (Crear clientes):';
  RAISE NOTICE '    ✓ Solo en negocios donde tienes acceso';
  RAISE NOTICE '    ✓ No puedes crear en negocios ajenos';
  RAISE NOTICE '';
  RAISE NOTICE '3️⃣  UPDATE (Actualizar clientes):';
  RAISE NOTICE '    ✓ Solo clientes de TUS negocios';
  RAISE NOTICE '    ✓ No puedes cambiar business_id a otro negocio';
  RAISE NOTICE '';
  RAISE NOTICE '4️⃣  DELETE (Eliminar clientes):';
  RAISE NOTICE '    ✓ Solo clientes de TUS negocios';
  RAISE NOTICE '    ✓ Owner y empleados pueden eliminar';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 SEGURIDAD:';
  RAISE NOTICE '    ✓ RLS habilitado en customers';
  RAISE NOTICE '    ✓ Usa get_user_business_ids() (SECURITY DEFINER)';
  RAISE NOTICE '    ✓ Aislamiento por business_id';
  RAISE NOTICE '';
  RAISE NOTICE '=============================================';
END $$;

-- =====================================================
-- QUERY DE VERIFICACIÓN
-- =====================================================

SELECT 
  '=== POLÍTICAS RLS EN CUSTOMERS ===' AS info;

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
  AND tablename = 'customers'
ORDER BY cmd, policyname;
