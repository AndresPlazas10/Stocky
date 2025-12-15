-- =====================================================
-- POLÍTICAS RLS - TABLA SALES
-- =====================================================
-- Políticas de seguridad a nivel de fila para sales
-- Las ventas pertenecen a un negocio (business_id)
-- =====================================================

-- =====================================================
-- LIMPIAR POLÍTICAS EXISTENTES
-- =====================================================

DROP POLICY IF EXISTS "sales_select_policy" ON sales;
DROP POLICY IF EXISTS "sales_insert_policy" ON sales;
DROP POLICY IF EXISTS "sales_update_policy" ON sales;
DROP POLICY IF EXISTS "sales_delete_policy" ON sales;

-- =====================================================
-- ASEGURAR QUE RLS ESTÁ HABILITADO
-- =====================================================

ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- POLÍTICA 1: SELECT (Ver/Leer ventas)
-- =====================================================
-- Permite ver ventas de tus negocios

CREATE POLICY "sales_select_policy"
ON sales
FOR SELECT
TO authenticated
USING (
  -- La venta pertenece a un negocio donde soy owner o empleado
  business_id IN (SELECT business_id FROM get_user_business_ids())
);

COMMENT ON POLICY "sales_select_policy" ON sales IS
  'Permite ver ventas de negocios donde eres owner o empleado activo';

-- =====================================================
-- POLÍTICA 2: INSERT (Crear ventas)
-- =====================================================
-- Puedes crear ventas en tus negocios

CREATE POLICY "sales_insert_policy"
ON sales
FOR INSERT
TO authenticated
WITH CHECK (
  -- Solo puedes crear ventas en negocios donde tienes acceso
  business_id IN (SELECT business_id FROM get_user_business_ids())
);

COMMENT ON POLICY "sales_insert_policy" ON sales IS
  'Permite crear ventas en negocios donde eres owner o empleado activo';

-- =====================================================
-- POLÍTICA 3: UPDATE (Actualizar ventas)
-- =====================================================
-- Puedes actualizar ventas de tus negocios
-- No puedes cambiar el business_id a otro negocio

CREATE POLICY "sales_update_policy"
ON sales
FOR UPDATE
TO authenticated
USING (
  -- La venta pertenece a tu negocio
  business_id IN (SELECT business_id FROM get_user_business_ids())
)
WITH CHECK (
  -- No puedes mover la venta a otro negocio
  business_id IN (SELECT business_id FROM get_user_business_ids())
);

COMMENT ON POLICY "sales_update_policy" ON sales IS
  'Permite actualizar ventas de tus negocios, sin cambiar el business_id a otro negocio';

-- =====================================================
-- POLÍTICA 4: DELETE (Eliminar ventas)
-- =====================================================
-- Puedes eliminar ventas de tus negocios

CREATE POLICY "sales_delete_policy"
ON sales
FOR DELETE
TO authenticated
USING (
  -- La venta pertenece a tu negocio
  business_id IN (SELECT business_id FROM get_user_business_ids())
);

COMMENT ON POLICY "sales_delete_policy" ON sales IS
  'Permite eliminar ventas de negocios donde eres owner o empleado activo';

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '=============================================';
  RAISE NOTICE '✅ POLÍTICAS RLS CREADAS - SALES';
  RAISE NOTICE '=============================================';
  RAISE NOTICE '';
  RAISE NOTICE '📋 POLÍTICAS ACTIVAS:';
  RAISE NOTICE '';
  RAISE NOTICE '1️⃣  SELECT (Ver ventas):';
  RAISE NOTICE '    ✓ Solo ventas de TUS negocios';
  RAISE NOTICE '    ✓ Basado en business_id';
  RAISE NOTICE '';
  RAISE NOTICE '2️⃣  INSERT (Crear ventas):';
  RAISE NOTICE '    ✓ Solo en negocios donde tienes acceso';
  RAISE NOTICE '    ✓ Empleados pueden registrar ventas';
  RAISE NOTICE '';
  RAISE NOTICE '3️⃣  UPDATE (Actualizar ventas):';
  RAISE NOTICE '    ✓ Solo ventas de TUS negocios';
  RAISE NOTICE '    ✓ No puedes cambiar business_id';
  RAISE NOTICE '    ✓ Útil para actualizar total, payment_method, notas';
  RAISE NOTICE '';
  RAISE NOTICE '4️⃣  DELETE (Eliminar ventas):';
  RAISE NOTICE '    ✓ Solo ventas de TUS negocios';
  RAISE NOTICE '    ✓ Owner y empleados pueden eliminar';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 SEGURIDAD:';
  RAISE NOTICE '    ✓ RLS habilitado en sales';
  RAISE NOTICE '    ✓ Usa get_user_business_ids() (SECURITY DEFINER)';
  RAISE NOTICE '    ✓ Aislamiento por business_id';
  RAISE NOTICE '';
  RAISE NOTICE '💡 RECORDATORIO:';
  RAISE NOTICE '    Las ventas están relacionadas con:';
  RAISE NOTICE '    - sale_details (productos vendidos)';
  RAISE NOTICE '    - customers (cliente opcional via customer_id)';
  RAISE NOTICE '    - Campos: total, payment_method, seller_name, notes';
  RAISE NOTICE '';
  RAISE NOTICE '=============================================';
END $$;

-- =====================================================
-- QUERY DE VERIFICACIÓN
-- =====================================================

SELECT 
  '=== POLÍTICAS RLS EN SALES ===' AS info;

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
  AND tablename = 'sales'
ORDER BY cmd, policyname;
