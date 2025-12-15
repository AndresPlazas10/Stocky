-- =====================================================
-- POLÍTICAS RLS - TABLA PURCHASES
-- =====================================================
-- Políticas de seguridad a nivel de fila para purchases
-- Las compras pertenecen a un negocio (business_id)
-- =====================================================

-- =====================================================
-- LIMPIAR POLÍTICAS EXISTENTES
-- =====================================================

DROP POLICY IF EXISTS "purchases_select_policy" ON purchases;
DROP POLICY IF EXISTS "purchases_insert_policy" ON purchases;
DROP POLICY IF EXISTS "purchases_update_policy" ON purchases;
DROP POLICY IF EXISTS "purchases_delete_policy" ON purchases;

-- =====================================================
-- ASEGURAR QUE RLS ESTÁ HABILITADO
-- =====================================================

ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- POLÍTICA 1: SELECT (Ver/Leer compras)
-- =====================================================
-- Permite ver compras de tus negocios

CREATE POLICY "purchases_select_policy"
ON purchases
FOR SELECT
TO authenticated
USING (
  -- La compra pertenece a un negocio donde soy owner o empleado
  business_id IN (SELECT business_id FROM get_user_business_ids())
);

COMMENT ON POLICY "purchases_select_policy" ON purchases IS
  'Permite ver compras de negocios donde eres owner o empleado activo';

-- =====================================================
-- POLÍTICA 2: INSERT (Crear compras)
-- =====================================================
-- Puedes crear compras en tus negocios

CREATE POLICY "purchases_insert_policy"
ON purchases
FOR INSERT
TO authenticated
WITH CHECK (
  -- Solo puedes crear compras en negocios donde tienes acceso
  business_id IN (SELECT business_id FROM get_user_business_ids())
);

COMMENT ON POLICY "purchases_insert_policy" ON purchases IS
  'Permite crear compras en negocios donde eres owner o empleado activo';

-- =====================================================
-- POLÍTICA 3: UPDATE (Actualizar compras)
-- =====================================================
-- Puedes actualizar compras de tus negocios
-- No puedes cambiar el business_id a otro negocio

CREATE POLICY "purchases_update_policy"
ON purchases
FOR UPDATE
TO authenticated
USING (
  -- La compra pertenece a tu negocio
  business_id IN (SELECT business_id FROM get_user_business_ids())
)
WITH CHECK (
  -- No puedes mover la compra a otro negocio
  business_id IN (SELECT business_id FROM get_user_business_ids())
);

COMMENT ON POLICY "purchases_update_policy" ON purchases IS
  'Permite actualizar compras de tus negocios, sin cambiar el business_id a otro negocio';

-- =====================================================
-- POLÍTICA 4: DELETE (Eliminar compras)
-- =====================================================
-- Puedes eliminar compras de tus negocios

CREATE POLICY "purchases_delete_policy"
ON purchases
FOR DELETE
TO authenticated
USING (
  -- La compra pertenece a tu negocio
  business_id IN (SELECT business_id FROM get_user_business_ids())
);

COMMENT ON POLICY "purchases_delete_policy" ON purchases IS
  'Permite eliminar compras de negocios donde eres owner o empleado activo';

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '=============================================';
  RAISE NOTICE '✅ POLÍTICAS RLS CREADAS - PURCHASES';
  RAISE NOTICE '=============================================';
  RAISE NOTICE '';
  RAISE NOTICE '📋 POLÍTICAS ACTIVAS:';
  RAISE NOTICE '';
  RAISE NOTICE '1️⃣  SELECT (Ver compras):';
  RAISE NOTICE '    ✓ Solo compras de TUS negocios';
  RAISE NOTICE '    ✓ Basado en business_id';
  RAISE NOTICE '';
  RAISE NOTICE '2️⃣  INSERT (Crear compras):';
  RAISE NOTICE '    ✓ Solo en negocios donde tienes acceso';
  RAISE NOTICE '    ✓ No puedes crear compras en negocios ajenos';
  RAISE NOTICE '';
  RAISE NOTICE '3️⃣  UPDATE (Actualizar compras):';
  RAISE NOTICE '    ✓ Solo compras de TUS negocios';
  RAISE NOTICE '    ✓ No puedes cambiar business_id';
  RAISE NOTICE '    ✓ Útil para actualizar total, supplier_id, notas';
  RAISE NOTICE '';
  RAISE NOTICE '4️⃣  DELETE (Eliminar compras):';
  RAISE NOTICE '    ✓ Solo compras de TUS negocios';
  RAISE NOTICE '    ✓ Owner y empleados pueden eliminar';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 SEGURIDAD:';
  RAISE NOTICE '    ✓ RLS habilitado en purchases';
  RAISE NOTICE '    ✓ Usa get_user_business_ids() (SECURITY DEFINER)';
  RAISE NOTICE '    ✓ Aislamiento por business_id';
  RAISE NOTICE '';
  RAISE NOTICE '💡 RECORDATORIO:';
  RAISE NOTICE '    Las compras están relacionadas con:';
  RAISE NOTICE '    - purchase_details (detalles de productos)';
  RAISE NOTICE '    - suppliers (proveedor de la compra)';
  RAISE NOTICE '    - Campos típicos: total, supplier_id, purchase_date';
  RAISE NOTICE '';
  RAISE NOTICE '=============================================';
END $$;

-- =====================================================
-- QUERY DE VERIFICACIÓN
-- =====================================================

SELECT 
  '=== POLÍTICAS RLS EN PURCHASES ===' AS info;

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
  AND tablename = 'purchases'
ORDER BY cmd, policyname;
