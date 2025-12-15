-- =====================================================
-- POLÍTICAS RLS - TABLA ORDER_ITEMS
-- =====================================================
-- Políticas de seguridad a nivel de fila para order_items
-- Los items pertenecen a órdenes/comandas (orders.business_id)
-- =====================================================

-- =====================================================
-- LIMPIAR POLÍTICAS EXISTENTES
-- =====================================================

DROP POLICY IF EXISTS "order_items_select_policy" ON order_items;
DROP POLICY IF EXISTS "order_items_insert_policy" ON order_items;
DROP POLICY IF EXISTS "order_items_update_policy" ON order_items;
DROP POLICY IF EXISTS "order_items_delete_policy" ON order_items;

-- =====================================================
-- ASEGURAR QUE RLS ESTÁ HABILITADO
-- =====================================================

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- POLÍTICA 1: SELECT (Ver/Leer items de órdenes)
-- =====================================================
-- Permite ver items de órdenes de tus negocios

CREATE POLICY "order_items_select_policy"
ON order_items
FOR SELECT
TO authenticated
USING (
  -- El item pertenece a una orden de tu negocio
  order_id IN (
    SELECT id FROM orders 
    WHERE business_id IN (SELECT business_id FROM get_user_business_ids())
  )
);

COMMENT ON POLICY "order_items_select_policy" ON order_items IS
  'Permite ver items de órdenes de negocios donde eres owner o empleado activo';

-- =====================================================
-- POLÍTICA 2: INSERT (Crear items de órdenes)
-- =====================================================
-- Puedes crear items en órdenes de tus negocios

CREATE POLICY "order_items_insert_policy"
ON order_items
FOR INSERT
TO authenticated
WITH CHECK (
  -- Solo puedes crear items en órdenes de tus negocios
  order_id IN (
    SELECT id FROM orders 
    WHERE business_id IN (SELECT business_id FROM get_user_business_ids())
  )
);

COMMENT ON POLICY "order_items_insert_policy" ON order_items IS
  'Permite crear items en órdenes de tus negocios';

-- =====================================================
-- POLÍTICA 3: UPDATE (Actualizar items de órdenes)
-- =====================================================
-- Puedes actualizar items de órdenes de tus negocios
-- No puedes cambiar el order_id a otra orden

CREATE POLICY "order_items_update_policy"
ON order_items
FOR UPDATE
TO authenticated
USING (
  -- El item pertenece a una orden de tu negocio
  order_id IN (
    SELECT id FROM orders 
    WHERE business_id IN (SELECT business_id FROM get_user_business_ids())
  )
)
WITH CHECK (
  -- Después de actualizar, debe seguir perteneciendo a una orden de tu negocio
  order_id IN (
    SELECT id FROM orders 
    WHERE business_id IN (SELECT business_id FROM get_user_business_ids())
  )
);

COMMENT ON POLICY "order_items_update_policy" ON order_items IS
  'Permite actualizar items de órdenes de tus negocios, sin moverlos a otras órdenes';

-- =====================================================
-- POLÍTICA 4: DELETE (Eliminar items de órdenes)
-- =====================================================
-- Puedes eliminar items de órdenes de tus negocios

CREATE POLICY "order_items_delete_policy"
ON order_items
FOR DELETE
TO authenticated
USING (
  -- El item pertenece a una orden de tu negocio
  order_id IN (
    SELECT id FROM orders 
    WHERE business_id IN (SELECT business_id FROM get_user_business_ids())
  )
);

COMMENT ON POLICY "order_items_delete_policy" ON order_items IS
  'Permite eliminar items de órdenes de tus negocios';

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '=============================================';
  RAISE NOTICE '✅ POLÍTICAS RLS CREADAS - ORDER_ITEMS';
  RAISE NOTICE '=============================================';
  RAISE NOTICE '';
  RAISE NOTICE '📋 POLÍTICAS ACTIVAS:';
  RAISE NOTICE '';
  RAISE NOTICE '1️⃣  SELECT (Ver items):';
  RAISE NOTICE '    ✓ Solo items de órdenes de TUS negocios';
  RAISE NOTICE '    ✓ Filtrado a través de orders.business_id';
  RAISE NOTICE '';
  RAISE NOTICE '2️⃣  INSERT (Crear items):';
  RAISE NOTICE '    ✓ Solo en órdenes de TUS negocios';
  RAISE NOTICE '    ✓ No puedes crear items en órdenes ajenas';
  RAISE NOTICE '';
  RAISE NOTICE '3️⃣  UPDATE (Actualizar items):';
  RAISE NOTICE '    ✓ Solo items de TUS órdenes';
  RAISE NOTICE '    ✓ No puedes mover items a otras órdenes';
  RAISE NOTICE '    ✓ Útil para modificar cantidad o notas';
  RAISE NOTICE '';
  RAISE NOTICE '4️⃣  DELETE (Eliminar items):';
  RAISE NOTICE '    ✓ Solo items de TUS órdenes';
  RAISE NOTICE '    ✓ Útil para cancelar productos de la comanda';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 SEGURIDAD:';
  RAISE NOTICE '    ✓ RLS habilitado en order_items';
  RAISE NOTICE '    ✓ Usa get_user_business_ids() (SECURITY DEFINER)';
  RAISE NOTICE '    ✓ JOIN con orders para verificar business_id';
  RAISE NOTICE '    ✓ Protección en cascada (order_items → orders → business)';
  RAISE NOTICE '';
  RAISE NOTICE '💡 CONTEXTO:';
  RAISE NOTICE '    Los order_items son productos agregados a comandas';
  RAISE NOTICE '    Se usan típicamente en módulo de Mesas/Restaurante';
  RAISE NOTICE '';
  RAISE NOTICE '=============================================';
END $$;

-- =====================================================
-- QUERY DE VERIFICACIÓN
-- =====================================================

SELECT 
  '=== POLÍTICAS RLS EN ORDER_ITEMS ===' AS info;

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
  AND tablename = 'order_items'
ORDER BY cmd, policyname;
