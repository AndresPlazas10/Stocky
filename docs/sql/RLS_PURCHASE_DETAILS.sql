-- =====================================================
-- POLÍTICAS RLS - TABLA PURCHASE_DETAILS
-- =====================================================
-- Políticas de seguridad a nivel de fila para purchase_details
-- Los detalles de compra pertenecen a una compra (purchase_id)
-- que pertenece a un negocio (business_id)
-- =====================================================

-- =====================================================
-- LIMPIAR POLÍTICAS EXISTENTES
-- =====================================================

DROP POLICY IF EXISTS "purchase_details_select_policy" ON purchase_details;
DROP POLICY IF EXISTS "purchase_details_insert_policy" ON purchase_details;
DROP POLICY IF EXISTS "purchase_details_update_policy" ON purchase_details;
DROP POLICY IF EXISTS "purchase_details_delete_policy" ON purchase_details;

-- =====================================================
-- ASEGURAR QUE RLS ESTÁ HABILITADO
-- =====================================================

ALTER TABLE purchase_details ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- POLÍTICA 1: SELECT (Ver/Leer detalles de compra)
-- =====================================================
-- Permite ver detalles de compras de tus negocios

CREATE POLICY "purchase_details_select_policy"
ON purchase_details
FOR SELECT
TO authenticated
USING (
  -- El detalle pertenece a una compra de tu negocio
  -- Cascada: purchase_id → purchases.business_id
  purchase_id IN (
    SELECT id 
    FROM purchases 
    WHERE business_id IN (SELECT business_id FROM get_user_business_ids())
  )
);

COMMENT ON POLICY "purchase_details_select_policy" ON purchase_details IS
  'Permite ver detalles de compras de negocios donde eres owner o empleado activo';

-- =====================================================
-- POLÍTICA 2: INSERT (Crear detalles de compra)
-- =====================================================
-- Puedes agregar productos a compras de tus negocios

CREATE POLICY "purchase_details_insert_policy"
ON purchase_details
FOR INSERT
TO authenticated
WITH CHECK (
  -- Solo puedes agregar detalles a compras de tus negocios
  purchase_id IN (
    SELECT id 
    FROM purchases 
    WHERE business_id IN (SELECT business_id FROM get_user_business_ids())
  )
);

COMMENT ON POLICY "purchase_details_insert_policy" ON purchase_details IS
  'Permite crear detalles en compras de negocios donde eres owner o empleado activo';

-- =====================================================
-- POLÍTICA 3: UPDATE (Actualizar detalles de compra)
-- =====================================================
-- Puedes actualizar detalles de compras de tus negocios
-- No puedes mover el detalle a otra compra

CREATE POLICY "purchase_details_update_policy"
ON purchase_details
FOR UPDATE
TO authenticated
USING (
  -- El detalle pertenece a una compra de tu negocio
  purchase_id IN (
    SELECT id 
    FROM purchases 
    WHERE business_id IN (SELECT business_id FROM get_user_business_ids())
  )
)
WITH CHECK (
  -- No puedes mover el detalle a una compra de otro negocio
  purchase_id IN (
    SELECT id 
    FROM purchases 
    WHERE business_id IN (SELECT business_id FROM get_user_business_ids())
  )
);

COMMENT ON POLICY "purchase_details_update_policy" ON purchase_details IS
  'Permite actualizar detalles de compras de tus negocios, sin mover el detalle a otra compra';

-- =====================================================
-- POLÍTICA 4: DELETE (Eliminar detalles de compra)
-- =====================================================
-- Puedes eliminar detalles de compras de tus negocios

CREATE POLICY "purchase_details_delete_policy"
ON purchase_details
FOR DELETE
TO authenticated
USING (
  -- El detalle pertenece a una compra de tu negocio
  purchase_id IN (
    SELECT id 
    FROM purchases 
    WHERE business_id IN (SELECT business_id FROM get_user_business_ids())
  )
);

COMMENT ON POLICY "purchase_details_delete_policy" ON purchase_details IS
  'Permite eliminar detalles de compras de negocios donde eres owner o empleado activo';

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '=============================================';
  RAISE NOTICE '✅ POLÍTICAS RLS CREADAS - PURCHASE_DETAILS';
  RAISE NOTICE '=============================================';
  RAISE NOTICE '';
  RAISE NOTICE '📋 POLÍTICAS ACTIVAS:';
  RAISE NOTICE '';
  RAISE NOTICE '1️⃣  SELECT (Ver detalles):';
  RAISE NOTICE '    ✓ Solo detalles de compras de TUS negocios';
  RAISE NOTICE '    ✓ Filtro cascada: purchase_id → purchases.business_id';
  RAISE NOTICE '';
  RAISE NOTICE '2️⃣  INSERT (Crear detalles):';
  RAISE NOTICE '    ✓ Solo en compras de tus negocios';
  RAISE NOTICE '    ✓ No puedes agregar detalles a compras ajenas';
  RAISE NOTICE '';
  RAISE NOTICE '3️⃣  UPDATE (Actualizar detalles):';
  RAISE NOTICE '    ✓ Solo detalles de compras de TUS negocios';
  RAISE NOTICE '    ✓ No puedes cambiar purchase_id a otra compra';
  RAISE NOTICE '    ✓ Útil para corregir cantidad, precio unitario';
  RAISE NOTICE '';
  RAISE NOTICE '4️⃣  DELETE (Eliminar detalles):';
  RAISE NOTICE '    ✓ Solo detalles de compras de TUS negocios';
  RAISE NOTICE '    ✓ Owner y empleados pueden eliminar';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 SEGURIDAD:';
  RAISE NOTICE '    ✓ RLS habilitado en purchase_details';
  RAISE NOTICE '    ✓ Aislamiento por business_id (cascada)';
  RAISE NOTICE '    ✓ No puedes ver/modificar compras de otros negocios';
  RAISE NOTICE '';
  RAISE NOTICE '💡 RECORDATORIO:';
  RAISE NOTICE '    - purchase_details → purchases → business_id';
  RAISE NOTICE '    - Cada detalle tiene: product_id, quantity, unit_price';
  RAISE NOTICE '    - UPDATE útil para ajustar cantidades recibidas';
  RAISE NOTICE '';
  RAISE NOTICE '=============================================';
END $$;

-- =====================================================
-- QUERY DE VERIFICACIÓN
-- =====================================================

SELECT 
  '=== POLÍTICAS RLS EN PURCHASE_DETAILS ===' AS info;

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
  AND tablename = 'purchase_details'
ORDER BY cmd, policyname;
