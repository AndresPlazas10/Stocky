-- =====================================================
-- POLÍTICAS RLS - TABLA SALE_DETAILS
-- =====================================================
-- Políticas de seguridad a nivel de fila para sale_details
-- Los detalles de venta pertenecen a una venta (sale_id)
-- que pertenece a un negocio (business_id)
-- =====================================================

-- =====================================================
-- LIMPIAR POLÍTICAS EXISTENTES
-- =====================================================

DROP POLICY IF EXISTS "sale_details_select_policy" ON sale_details;
DROP POLICY IF EXISTS "sale_details_insert_policy" ON sale_details;
DROP POLICY IF EXISTS "sale_details_update_policy" ON sale_details;
DROP POLICY IF EXISTS "sale_details_delete_policy" ON sale_details;

-- =====================================================
-- ASEGURAR QUE RLS ESTÁ HABILITADO
-- =====================================================

ALTER TABLE sale_details ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- POLÍTICA 1: SELECT (Ver/Leer detalles de venta)
-- =====================================================
-- Permite ver detalles de ventas de tus negocios

CREATE POLICY "sale_details_select_policy"
ON sale_details
FOR SELECT
TO authenticated
USING (
  -- El detalle pertenece a una venta de tu negocio
  -- Cascada: sale_id → sales.business_id
  sale_id IN (
    SELECT id 
    FROM sales 
    WHERE business_id IN (SELECT business_id FROM get_user_business_ids())
  )
);

COMMENT ON POLICY "sale_details_select_policy" ON sale_details IS
  'Permite ver detalles de ventas de negocios donde eres owner o empleado activo';

-- =====================================================
-- POLÍTICA 2: INSERT (Crear detalles de venta)
-- =====================================================
-- Puedes agregar productos a ventas de tus negocios

CREATE POLICY "sale_details_insert_policy"
ON sale_details
FOR INSERT
TO authenticated
WITH CHECK (
  -- Solo puedes agregar detalles a ventas de tus negocios
  sale_id IN (
    SELECT id 
    FROM sales 
    WHERE business_id IN (SELECT business_id FROM get_user_business_ids())
  )
);

COMMENT ON POLICY "sale_details_insert_policy" ON sale_details IS
  'Permite crear detalles en ventas de negocios donde eres owner o empleado activo';

-- =====================================================
-- POLÍTICA 3: UPDATE (Actualizar detalles de venta)
-- =====================================================
-- Puedes actualizar detalles de ventas de tus negocios
-- No puedes mover el detalle a otra venta

CREATE POLICY "sale_details_update_policy"
ON sale_details
FOR UPDATE
TO authenticated
USING (
  -- El detalle pertenece a una venta de tu negocio
  sale_id IN (
    SELECT id 
    FROM sales 
    WHERE business_id IN (SELECT business_id FROM get_user_business_ids())
  )
)
WITH CHECK (
  -- No puedes mover el detalle a una venta de otro negocio
  sale_id IN (
    SELECT id 
    FROM sales 
    WHERE business_id IN (SELECT business_id FROM get_user_business_ids())
  )
);

COMMENT ON POLICY "sale_details_update_policy" ON sale_details IS
  'Permite actualizar detalles de ventas de tus negocios, sin mover el detalle a otra venta';

-- =====================================================
-- POLÍTICA 4: DELETE (Eliminar detalles de venta)
-- =====================================================
-- Puedes eliminar detalles de ventas de tus negocios

CREATE POLICY "sale_details_delete_policy"
ON sale_details
FOR DELETE
TO authenticated
USING (
  -- El detalle pertenece a una venta de tu negocio
  sale_id IN (
    SELECT id 
    FROM sales 
    WHERE business_id IN (SELECT business_id FROM get_user_business_ids())
  )
);

COMMENT ON POLICY "sale_details_delete_policy" ON sale_details IS
  'Permite eliminar detalles de ventas de negocios donde eres owner o empleado activo';

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '=============================================';
  RAISE NOTICE '✅ POLÍTICAS RLS CREADAS - SALE_DETAILS';
  RAISE NOTICE '=============================================';
  RAISE NOTICE '';
  RAISE NOTICE '📋 POLÍTICAS ACTIVAS:';
  RAISE NOTICE '';
  RAISE NOTICE '1️⃣  SELECT (Ver detalles):';
  RAISE NOTICE '    ✓ Solo detalles de ventas de TUS negocios';
  RAISE NOTICE '    ✓ Filtro cascada: sale_id → sales.business_id';
  RAISE NOTICE '';
  RAISE NOTICE '2️⃣  INSERT (Crear detalles):';
  RAISE NOTICE '    ✓ Solo en ventas de tus negocios';
  RAISE NOTICE '    ✓ No puedes agregar detalles a ventas ajenas';
  RAISE NOTICE '';
  RAISE NOTICE '3️⃣  UPDATE (Actualizar detalles):';
  RAISE NOTICE '    ✓ Solo detalles de ventas de TUS negocios';
  RAISE NOTICE '    ✓ No puedes cambiar sale_id a otra venta';
  RAISE NOTICE '    ✓ Útil para corregir cantidad, precio unitario';
  RAISE NOTICE '';
  RAISE NOTICE '4️⃣  DELETE (Eliminar detalles):';
  RAISE NOTICE '    ✓ Solo detalles de ventas de TUS negocios';
  RAISE NOTICE '    ✓ Owner y empleados pueden eliminar';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 SEGURIDAD:';
  RAISE NOTICE '    ✓ RLS habilitado en sale_details';
  RAISE NOTICE '    ✓ Aislamiento por business_id (cascada)';
  RAISE NOTICE '    ✓ No puedes ver/modificar ventas de otros negocios';
  RAISE NOTICE '';
  RAISE NOTICE '💡 RECORDATORIO:';
  RAISE NOTICE '    - sale_details → sales → business_id';
  RAISE NOTICE '    - Cada detalle tiene: product_id, quantity, unit_price';
  RAISE NOTICE '    - UPDATE útil para ajustar cantidades o precios';
  RAISE NOTICE '';
  RAISE NOTICE '=============================================';
END $$;

-- =====================================================
-- QUERY DE VERIFICACIÓN
-- =====================================================

SELECT 
  '=== POLÍTICAS RLS EN SALE_DETAILS ===' AS info;

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
  AND tablename = 'sale_details'
ORDER BY cmd, policyname;
