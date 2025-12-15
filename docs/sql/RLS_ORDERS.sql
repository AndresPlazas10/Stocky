-- =====================================================
-- POLÍTICAS RLS - TABLA ORDERS
-- =====================================================
-- Políticas de seguridad a nivel de fila para orders
-- Las órdenes/comandas pertenecen a un negocio (business_id)
-- =====================================================

-- =====================================================
-- LIMPIAR POLÍTICAS EXISTENTES
-- =====================================================

DROP POLICY IF EXISTS "orders_select_policy" ON orders;
DROP POLICY IF EXISTS "orders_insert_policy" ON orders;
DROP POLICY IF EXISTS "orders_update_policy" ON orders;
DROP POLICY IF EXISTS "orders_delete_policy" ON orders;

-- =====================================================
-- ASEGURAR QUE RLS ESTÁ HABILITADO
-- =====================================================

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- POLÍTICA 1: SELECT (Ver/Leer órdenes)
-- =====================================================
-- Permite ver órdenes de tus negocios

CREATE POLICY "orders_select_policy"
ON orders
FOR SELECT
TO authenticated
USING (
  -- La orden pertenece a un negocio donde soy owner o empleado
  business_id IN (SELECT business_id FROM get_user_business_ids())
);

COMMENT ON POLICY "orders_select_policy" ON orders IS
  'Permite ver órdenes de negocios donde eres owner o empleado activo';

-- =====================================================
-- POLÍTICA 2: INSERT (Crear órdenes)
-- =====================================================
-- Puedes crear órdenes en tus negocios

CREATE POLICY "orders_insert_policy"
ON orders
FOR INSERT
TO authenticated
WITH CHECK (
  -- Solo puedes crear órdenes en negocios donde tienes acceso
  business_id IN (SELECT business_id FROM get_user_business_ids())
);

COMMENT ON POLICY "orders_insert_policy" ON orders IS
  'Permite crear órdenes en negocios donde eres owner o empleado activo';

-- =====================================================
-- POLÍTICA 3: UPDATE (Actualizar órdenes)
-- =====================================================
-- Puedes actualizar órdenes de tus negocios
-- No puedes cambiar el business_id a otro negocio

CREATE POLICY "orders_update_policy"
ON orders
FOR UPDATE
TO authenticated
USING (
  -- La orden pertenece a tu negocio
  business_id IN (SELECT business_id FROM get_user_business_ids())
)
WITH CHECK (
  -- No puedes mover la orden a otro negocio
  business_id IN (SELECT business_id FROM get_user_business_ids())
);

COMMENT ON POLICY "orders_update_policy" ON orders IS
  'Permite actualizar órdenes de tus negocios, sin cambiar el business_id a otro negocio';

-- =====================================================
-- POLÍTICA 4: DELETE (Eliminar órdenes)
-- =====================================================
-- Puedes eliminar órdenes de tus negocios

CREATE POLICY "orders_delete_policy"
ON orders
FOR DELETE
TO authenticated
USING (
  -- La orden pertenece a tu negocio
  business_id IN (SELECT business_id FROM get_user_business_ids())
);

COMMENT ON POLICY "orders_delete_policy" ON orders IS
  'Permite eliminar órdenes de negocios donde eres owner o empleado activo';

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '=============================================';
  RAISE NOTICE '✅ POLÍTICAS RLS CREADAS - ORDERS';
  RAISE NOTICE '=============================================';
  RAISE NOTICE '';
  RAISE NOTICE '📋 POLÍTICAS ACTIVAS:';
  RAISE NOTICE '';
  RAISE NOTICE '1️⃣  SELECT (Ver órdenes):';
  RAISE NOTICE '    ✓ Solo órdenes de TUS negocios';
  RAISE NOTICE '    ✓ Basado en business_id';
  RAISE NOTICE '';
  RAISE NOTICE '2️⃣  INSERT (Crear órdenes):';
  RAISE NOTICE '    ✓ Solo en negocios donde tienes acceso';
  RAISE NOTICE '    ✓ Útil al abrir una nueva comanda/mesa';
  RAISE NOTICE '';
  RAISE NOTICE '3️⃣  UPDATE (Actualizar órdenes):';
  RAISE NOTICE '    ✓ Solo órdenes de TUS negocios';
  RAISE NOTICE '    ✓ No puedes cambiar business_id';
  RAISE NOTICE '    ✓ Puedes cambiar status (open → closed)';
  RAISE NOTICE '    ✓ Puedes actualizar total al agregar items';
  RAISE NOTICE '';
  RAISE NOTICE '4️⃣  DELETE (Eliminar órdenes):';
  RAISE NOTICE '    ✓ Solo órdenes de TUS negocios';
  RAISE NOTICE '    ✓ Útil para cancelar comandas';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 SEGURIDAD:';
  RAISE NOTICE '    ✓ RLS habilitado en orders';
  RAISE NOTICE '    ✓ Usa get_user_business_ids() (SECURITY DEFINER)';
  RAISE NOTICE '    ✓ Aislamiento por business_id';
  RAISE NOTICE '';
  RAISE NOTICE '💡 RECORDATORIO:';
  RAISE NOTICE '    Las órdenes tienen items (order_items)';
  RAISE NOTICE '    que también están protegidos por RLS';
  RAISE NOTICE '    Se usan en módulo Mesas/Restaurante';
  RAISE NOTICE '';
  RAISE NOTICE '=============================================';
END $$;

-- =====================================================
-- QUERY DE VERIFICACIÓN
-- =====================================================

SELECT 
  '=== POLÍTICAS RLS EN ORDERS ===' AS info;

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
  AND tablename = 'orders'
ORDER BY cmd, policyname;
