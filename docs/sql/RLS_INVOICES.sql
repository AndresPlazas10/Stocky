-- =====================================================
-- POLÍTICAS RLS - TABLA INVOICES
-- =====================================================
-- Políticas de seguridad a nivel de fila para invoices
-- Las facturas pertenecen a un negocio (business_id)
-- =====================================================

-- =====================================================
-- LIMPIAR POLÍTICAS EXISTENTES
-- =====================================================

DROP POLICY IF EXISTS "invoices_select_policy" ON invoices;
DROP POLICY IF EXISTS "invoices_insert_policy" ON invoices;
DROP POLICY IF EXISTS "invoices_update_policy" ON invoices;
DROP POLICY IF EXISTS "invoices_delete_policy" ON invoices;

-- =====================================================
-- ASEGURAR QUE RLS ESTÁ HABILITADO
-- =====================================================

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- POLÍTICA 1: SELECT (Ver/Leer facturas)
-- =====================================================
-- Permite ver facturas de tus negocios

CREATE POLICY "invoices_select_policy"
ON invoices
FOR SELECT
TO authenticated
USING (
  -- La factura pertenece a un negocio donde soy owner o empleado
  business_id IN (SELECT business_id FROM get_user_business_ids())
);

COMMENT ON POLICY "invoices_select_policy" ON invoices IS
  'Permite ver facturas de negocios donde eres owner o empleado activo';

-- =====================================================
-- POLÍTICA 2: INSERT (Crear facturas)
-- =====================================================
-- Puedes crear facturas en tus negocios

CREATE POLICY "invoices_insert_policy"
ON invoices
FOR INSERT
TO authenticated
WITH CHECK (
  -- Solo puedes crear facturas en negocios donde tienes acceso
  business_id IN (SELECT business_id FROM get_user_business_ids())
);

COMMENT ON POLICY "invoices_insert_policy" ON invoices IS
  'Permite crear facturas en negocios donde eres owner o empleado activo';

-- =====================================================
-- POLÍTICA 3: UPDATE (Actualizar facturas)
-- =====================================================
-- Puedes actualizar facturas de tus negocios
-- No puedes cambiar el business_id a otro negocio

CREATE POLICY "invoices_update_policy"
ON invoices
FOR UPDATE
TO authenticated
USING (
  -- La factura pertenece a tu negocio
  business_id IN (SELECT business_id FROM get_user_business_ids())
)
WITH CHECK (
  -- No puedes mover la factura a otro negocio
  business_id IN (SELECT business_id FROM get_user_business_ids())
);

COMMENT ON POLICY "invoices_update_policy" ON invoices IS
  'Permite actualizar facturas de tus negocios, sin cambiar el business_id a otro negocio';

-- =====================================================
-- POLÍTICA 4: DELETE (Eliminar facturas)
-- =====================================================
-- Puedes eliminar facturas de tus negocios

CREATE POLICY "invoices_delete_policy"
ON invoices
FOR DELETE
TO authenticated
USING (
  -- La factura pertenece a tu negocio
  business_id IN (SELECT business_id FROM get_user_business_ids())
);

COMMENT ON POLICY "invoices_delete_policy" ON invoices IS
  'Permite eliminar facturas de negocios donde eres owner o empleado activo';

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '=============================================';
  RAISE NOTICE '✅ POLÍTICAS RLS CREADAS - INVOICES';
  RAISE NOTICE '=============================================';
  RAISE NOTICE '';
  RAISE NOTICE '📋 POLÍTICAS ACTIVAS:';
  RAISE NOTICE '';
  RAISE NOTICE '1️⃣  SELECT (Ver facturas):';
  RAISE NOTICE '    ✓ Solo facturas de TUS negocios';
  RAISE NOTICE '    ✓ Basado en business_id';
  RAISE NOTICE '';
  RAISE NOTICE '2️⃣  INSERT (Crear facturas):';
  RAISE NOTICE '    ✓ Solo en negocios donde tienes acceso';
  RAISE NOTICE '    ✓ No puedes crear facturas en negocios ajenos';
  RAISE NOTICE '';
  RAISE NOTICE '3️⃣  UPDATE (Actualizar facturas):';
  RAISE NOTICE '    ✓ Solo facturas de TUS negocios';
  RAISE NOTICE '    ✓ No puedes cambiar business_id a otro negocio';
  RAISE NOTICE '    ✓ Puedes cambiar status (draft → sent → paid)';
  RAISE NOTICE '';
  RAISE NOTICE '4️⃣  DELETE (Eliminar facturas):';
  RAISE NOTICE '    ✓ Solo facturas de TUS negocios';
  RAISE NOTICE '    ✓ Owner y empleados pueden eliminar';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 SEGURIDAD:';
  RAISE NOTICE '    ✓ RLS habilitado en invoices';
  RAISE NOTICE '    ✓ Usa get_user_business_ids() (SECURITY DEFINER)';
  RAISE NOTICE '    ✓ Aislamiento por business_id';
  RAISE NOTICE '';
  RAISE NOTICE '💡 RECORDATORIO:';
  RAISE NOTICE '    Las facturas tienen items (invoice_items)';
  RAISE NOTICE '    que también están protegidos por RLS';
  RAISE NOTICE '';
  RAISE NOTICE '=============================================';
END $$;

-- =====================================================
-- QUERY DE VERIFICACIÓN
-- =====================================================

SELECT 
  '=== POLÍTICAS RLS EN INVOICES ===' AS info;

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
  AND tablename = 'invoices'
ORDER BY cmd, policyname;
