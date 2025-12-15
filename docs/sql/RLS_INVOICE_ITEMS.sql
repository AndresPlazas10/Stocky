-- =====================================================
-- POLÍTICAS RLS - TABLA INVOICE_ITEMS
-- =====================================================
-- Políticas de seguridad a nivel de fila para invoice_items
-- Los items pertenecen a facturas (invoices.business_id)
-- =====================================================

-- =====================================================
-- LIMPIAR POLÍTICAS EXISTENTES
-- =====================================================

DROP POLICY IF EXISTS "invoice_items_select_policy" ON invoice_items;
DROP POLICY IF EXISTS "invoice_items_insert_policy" ON invoice_items;
DROP POLICY IF EXISTS "invoice_items_update_policy" ON invoice_items;
DROP POLICY IF EXISTS "invoice_items_delete_policy" ON invoice_items;

-- =====================================================
-- ASEGURAR QUE RLS ESTÁ HABILITADO
-- =====================================================

ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- POLÍTICA 1: SELECT (Ver/Leer items de facturas)
-- =====================================================
-- Permite ver items de facturas de tus negocios

CREATE POLICY "invoice_items_select_policy"
ON invoice_items
FOR SELECT
TO authenticated
USING (
  -- El item pertenece a una factura de tu negocio
  invoice_id IN (
    SELECT id FROM invoices 
    WHERE business_id IN (SELECT business_id FROM get_user_business_ids())
  )
);

COMMENT ON POLICY "invoice_items_select_policy" ON invoice_items IS
  'Permite ver items de facturas de negocios donde eres owner o empleado activo';

-- =====================================================
-- POLÍTICA 2: INSERT (Crear items de facturas)
-- =====================================================
-- Puedes crear items en facturas de tus negocios

CREATE POLICY "invoice_items_insert_policy"
ON invoice_items
FOR INSERT
TO authenticated
WITH CHECK (
  -- Solo puedes crear items en facturas de tus negocios
  invoice_id IN (
    SELECT id FROM invoices 
    WHERE business_id IN (SELECT business_id FROM get_user_business_ids())
  )
);

COMMENT ON POLICY "invoice_items_insert_policy" ON invoice_items IS
  'Permite crear items en facturas de tus negocios';

-- =====================================================
-- POLÍTICA 3: UPDATE (Actualizar items de facturas)
-- =====================================================
-- Puedes actualizar items de facturas de tus negocios
-- No puedes cambiar el invoice_id a otra factura

CREATE POLICY "invoice_items_update_policy"
ON invoice_items
FOR UPDATE
TO authenticated
USING (
  -- El item pertenece a una factura de tu negocio
  invoice_id IN (
    SELECT id FROM invoices 
    WHERE business_id IN (SELECT business_id FROM get_user_business_ids())
  )
)
WITH CHECK (
  -- Después de actualizar, debe seguir perteneciendo a una factura de tu negocio
  invoice_id IN (
    SELECT id FROM invoices 
    WHERE business_id IN (SELECT business_id FROM get_user_business_ids())
  )
);

COMMENT ON POLICY "invoice_items_update_policy" ON invoice_items IS
  'Permite actualizar items de facturas de tus negocios, sin moverlos a otras facturas';

-- =====================================================
-- POLÍTICA 4: DELETE (Eliminar items de facturas)
-- =====================================================
-- Puedes eliminar items de facturas de tus negocios

CREATE POLICY "invoice_items_delete_policy"
ON invoice_items
FOR DELETE
TO authenticated
USING (
  -- El item pertenece a una factura de tu negocio
  invoice_id IN (
    SELECT id FROM invoices 
    WHERE business_id IN (SELECT business_id FROM get_user_business_ids())
  )
);

COMMENT ON POLICY "invoice_items_delete_policy" ON invoice_items IS
  'Permite eliminar items de facturas de tus negocios';

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '=============================================';
  RAISE NOTICE '✅ POLÍTICAS RLS CREADAS - INVOICE_ITEMS';
  RAISE NOTICE '=============================================';
  RAISE NOTICE '';
  RAISE NOTICE '📋 POLÍTICAS ACTIVAS:';
  RAISE NOTICE '';
  RAISE NOTICE '1️⃣  SELECT (Ver items):';
  RAISE NOTICE '    ✓ Solo items de facturas de TUS negocios';
  RAISE NOTICE '    ✓ Filtrado a través de invoices.business_id';
  RAISE NOTICE '';
  RAISE NOTICE '2️⃣  INSERT (Crear items):';
  RAISE NOTICE '    ✓ Solo en facturas de TUS negocios';
  RAISE NOTICE '    ✓ No puedes crear items en facturas ajenas';
  RAISE NOTICE '';
  RAISE NOTICE '3️⃣  UPDATE (Actualizar items):';
  RAISE NOTICE '    ✓ Solo items de TUS facturas';
  RAISE NOTICE '    ✓ No puedes mover items a otras facturas';
  RAISE NOTICE '';
  RAISE NOTICE '4️⃣  DELETE (Eliminar items):';
  RAISE NOTICE '    ✓ Solo items de TUS facturas';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 SEGURIDAD:';
  RAISE NOTICE '    ✓ RLS habilitado en invoice_items';
  RAISE NOTICE '    ✓ Usa get_user_business_ids() (SECURITY DEFINER)';
  RAISE NOTICE '    ✓ JOIN con invoices para verificar business_id';
  RAISE NOTICE '    ✓ Protección en cascada (invoice → business)';
  RAISE NOTICE '';
  RAISE NOTICE '=============================================';
END $$;

-- =====================================================
-- QUERY DE VERIFICACIÓN
-- =====================================================

SELECT 
  '=== POLÍTICAS RLS EN INVOICE_ITEMS ===' AS info;

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
  AND tablename = 'invoice_items'
ORDER BY cmd, policyname;
