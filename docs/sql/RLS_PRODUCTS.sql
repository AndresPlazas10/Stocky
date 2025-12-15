-- =====================================================
-- POLÍTICAS RLS - TABLA PRODUCTS
-- =====================================================
-- Políticas de seguridad a nivel de fila para products
-- Los productos pertenecen a un negocio (business_id)
-- =====================================================

-- =====================================================
-- LIMPIAR POLÍTICAS EXISTENTES
-- =====================================================

DROP POLICY IF EXISTS "products_select_policy" ON products;
DROP POLICY IF EXISTS "products_insert_policy" ON products;
DROP POLICY IF EXISTS "products_update_policy" ON products;
DROP POLICY IF EXISTS "products_delete_policy" ON products;

-- =====================================================
-- ASEGURAR QUE RLS ESTÁ HABILITADO
-- =====================================================

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- POLÍTICA 1: SELECT (Ver/Leer productos)
-- =====================================================
-- Permite ver productos de tus negocios

CREATE POLICY "products_select_policy"
ON products
FOR SELECT
TO authenticated
USING (
  -- El producto pertenece a un negocio donde soy owner o empleado
  business_id IN (SELECT business_id FROM get_user_business_ids())
);

COMMENT ON POLICY "products_select_policy" ON products IS
  'Permite ver productos de negocios donde eres owner o empleado activo';

-- =====================================================
-- POLÍTICA 2: INSERT (Crear productos)
-- =====================================================
-- Puedes crear productos en tus negocios

CREATE POLICY "products_insert_policy"
ON products
FOR INSERT
TO authenticated
WITH CHECK (
  -- Solo puedes crear productos en negocios donde tienes acceso
  business_id IN (SELECT business_id FROM get_user_business_ids())
);

COMMENT ON POLICY "products_insert_policy" ON products IS
  'Permite crear productos en negocios donde eres owner o empleado activo';

-- =====================================================
-- POLÍTICA 3: UPDATE (Actualizar productos)
-- =====================================================
-- Puedes actualizar productos de tus negocios
-- No puedes cambiar el business_id a otro negocio

CREATE POLICY "products_update_policy"
ON products
FOR UPDATE
TO authenticated
USING (
  -- El producto pertenece a tu negocio
  business_id IN (SELECT business_id FROM get_user_business_ids())
)
WITH CHECK (
  -- No puedes mover el producto a otro negocio
  business_id IN (SELECT business_id FROM get_user_business_ids())
);

COMMENT ON POLICY "products_update_policy" ON products IS
  'Permite actualizar productos de tus negocios, sin cambiar el business_id a otro negocio';

-- =====================================================
-- POLÍTICA 4: DELETE (Eliminar productos)
-- =====================================================
-- Puedes eliminar productos de tus negocios

CREATE POLICY "products_delete_policy"
ON products
FOR DELETE
TO authenticated
USING (
  -- El producto pertenece a tu negocio
  business_id IN (SELECT business_id FROM get_user_business_ids())
);

COMMENT ON POLICY "products_delete_policy" ON products IS
  'Permite eliminar productos de negocios donde eres owner o empleado activo';

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '=============================================';
  RAISE NOTICE '✅ POLÍTICAS RLS CREADAS - PRODUCTS';
  RAISE NOTICE '=============================================';
  RAISE NOTICE '';
  RAISE NOTICE '📋 POLÍTICAS ACTIVAS:';
  RAISE NOTICE '';
  RAISE NOTICE '1️⃣  SELECT (Ver productos):';
  RAISE NOTICE '    ✓ Solo productos de TUS negocios';
  RAISE NOTICE '    ✓ Basado en business_id';
  RAISE NOTICE '';
  RAISE NOTICE '2️⃣  INSERT (Crear productos):';
  RAISE NOTICE '    ✓ Solo en negocios donde tienes acceso';
  RAISE NOTICE '    ✓ No puedes crear productos en negocios ajenos';
  RAISE NOTICE '';
  RAISE NOTICE '3️⃣  UPDATE (Actualizar productos):';
  RAISE NOTICE '    ✓ Solo productos de TUS negocios';
  RAISE NOTICE '    ✓ No puedes cambiar business_id';
  RAISE NOTICE '    ✓ Puedes actualizar precio, stock, etc.';
  RAISE NOTICE '';
  RAISE NOTICE '4️⃣  DELETE (Eliminar productos):';
  RAISE NOTICE '    ✓ Solo productos de TUS negocios';
  RAISE NOTICE '    ✓ Owner y empleados pueden eliminar';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 SEGURIDAD:';
  RAISE NOTICE '    ✓ RLS habilitado en products';
  RAISE NOTICE '    ✓ Usa get_user_business_ids() (SECURITY DEFINER)';
  RAISE NOTICE '    ✓ Aislamiento por business_id';
  RAISE NOTICE '';
  RAISE NOTICE '💡 RECORDATORIO:';
  RAISE NOTICE '    Los productos se usan en:';
  RAISE NOTICE '    - Ventas (sale_details)';
  RAISE NOTICE '    - Compras (purchase_details)';
  RAISE NOTICE '    - Facturas (invoice_items)';
  RAISE NOTICE '    - Órdenes (order_items)';
  RAISE NOTICE '';
  RAISE NOTICE '=============================================';
END $$;

-- =====================================================
-- QUERY DE VERIFICACIÓN
-- =====================================================

SELECT 
  '=== POLÍTICAS RLS EN PRODUCTS ===' AS info;

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
  AND tablename = 'products'
ORDER BY cmd, policyname;
