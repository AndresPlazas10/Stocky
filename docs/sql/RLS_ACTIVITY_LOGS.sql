-- =====================================================
-- POLÍTICAS RLS - TABLA ACTIVITY_LOGS
-- =====================================================
-- Políticas de seguridad a nivel de fila para activity_logs
-- Los logs de actividad pertenecen a un negocio (business_id)
-- Registran acciones de usuarios para auditoría
-- =====================================================

-- =====================================================
-- LIMPIAR POLÍTICAS EXISTENTES
-- =====================================================

DROP POLICY IF EXISTS "activity_logs_select_policy" ON activity_logs;
DROP POLICY IF EXISTS "activity_logs_insert_policy" ON activity_logs;
DROP POLICY IF EXISTS "activity_logs_update_policy" ON activity_logs;
DROP POLICY IF EXISTS "activity_logs_delete_policy" ON activity_logs;

-- =====================================================
-- ASEGURAR QUE RLS ESTÁ HABILITADO
-- =====================================================

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- POLÍTICA 1: SELECT (Ver/Leer logs)
-- =====================================================
-- Permite ver logs de tus negocios

CREATE POLICY "activity_logs_select_policy"
ON activity_logs
FOR SELECT
TO authenticated
USING (
  -- El log pertenece a un negocio donde soy owner o empleado
  business_id IN (SELECT business_id FROM get_user_business_ids())
);

COMMENT ON POLICY "activity_logs_select_policy" ON activity_logs IS
  'Permite ver logs de actividad de negocios donde eres owner o empleado activo';

-- =====================================================
-- POLÍTICA 2: INSERT (Crear logs)
-- =====================================================
-- Puedes crear logs en tus negocios

CREATE POLICY "activity_logs_insert_policy"
ON activity_logs
FOR INSERT
TO authenticated
WITH CHECK (
  -- Solo puedes crear logs en negocios donde tienes acceso
  business_id IN (SELECT business_id FROM get_user_business_ids())
);

COMMENT ON POLICY "activity_logs_insert_policy" ON activity_logs IS
  'Permite crear logs de actividad en negocios donde eres owner o empleado activo';

-- =====================================================
-- POLÍTICA 3: UPDATE (Actualizar logs)
-- =====================================================
-- Generalmente los logs NO deberían modificarse (auditoría)
-- Pero permitimos actualización con restricciones

CREATE POLICY "activity_logs_update_policy"
ON activity_logs
FOR UPDATE
TO authenticated
USING (
  -- El log pertenece a tu negocio
  business_id IN (SELECT business_id FROM get_user_business_ids())
)
WITH CHECK (
  -- No puedes mover el log a otro negocio
  business_id IN (SELECT business_id FROM get_user_business_ids())
);

COMMENT ON POLICY "activity_logs_update_policy" ON activity_logs IS
  'Permite actualizar logs de tus negocios (generalmente deshabilitado en auditoría)';

-- =====================================================
-- POLÍTICA 4: DELETE (Eliminar logs)
-- =====================================================
-- Puedes eliminar logs de tus negocios
-- Nota: En auditoría real, esto debería estar restringido

CREATE POLICY "activity_logs_delete_policy"
ON activity_logs
FOR DELETE
TO authenticated
USING (
  -- El log pertenece a tu negocio
  business_id IN (SELECT business_id FROM get_user_business_ids())
);

COMMENT ON POLICY "activity_logs_delete_policy" ON activity_logs IS
  'Permite eliminar logs de negocios donde eres owner o empleado activo';

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '=============================================';
  RAISE NOTICE '✅ POLÍTICAS RLS CREADAS - ACTIVITY_LOGS';
  RAISE NOTICE '=============================================';
  RAISE NOTICE '';
  RAISE NOTICE '📋 POLÍTICAS ACTIVAS:';
  RAISE NOTICE '';
  RAISE NOTICE '1️⃣  SELECT (Ver logs):';
  RAISE NOTICE '    ✓ Solo logs de TUS negocios';
  RAISE NOTICE '    ✓ Basado en business_id';
  RAISE NOTICE '';
  RAISE NOTICE '2️⃣  INSERT (Crear logs):';
  RAISE NOTICE '    ✓ Solo en negocios donde tienes acceso';
  RAISE NOTICE '    ✓ Sistema registra acciones automáticamente';
  RAISE NOTICE '';
  RAISE NOTICE '3️⃣  UPDATE (Actualizar logs):';
  RAISE NOTICE '    ✓ Solo logs de TUS negocios';
  RAISE NOTICE '    ✓ No puedes cambiar business_id';
  RAISE NOTICE '    ⚠️  Idealmente logs NO deberían modificarse';
  RAISE NOTICE '';
  RAISE NOTICE '4️⃣  DELETE (Eliminar logs):';
  RAISE NOTICE '    ✓ Solo logs de TUS negocios';
  RAISE NOTICE '    ⚠️  En auditoría real, esto debería bloquearse';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 SEGURIDAD:';
  RAISE NOTICE '    ✓ RLS habilitado en activity_logs';
  RAISE NOTICE '    ✓ Usa get_user_business_ids() (SECURITY DEFINER)';
  RAISE NOTICE '    ✓ Aislamiento por business_id';
  RAISE NOTICE '';
  RAISE NOTICE '💡 RECORDATORIO:';
  RAISE NOTICE '    Los logs de actividad registran:';
  RAISE NOTICE '    - Acciones de usuarios (CREATE, UPDATE, DELETE)';
  RAISE NOTICE '    - Módulo afectado (ventas, compras, inventario)';
  RAISE NOTICE '    - user_id, timestamp, detalles de la acción';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  MEJORES PRÁCTICAS:';
  RAISE NOTICE '    - Logs son inmutables (no UPDATE/DELETE)';
  RAISE NOTICE '    - Considerar deshabilitar UPDATE/DELETE policies';
  RAISE NOTICE '    - Usar para auditoría y trazabilidad';
  RAISE NOTICE '';
  RAISE NOTICE '=============================================';
END $$;

-- =====================================================
-- QUERY DE VERIFICACIÓN
-- =====================================================

SELECT 
  '=== POLÍTICAS RLS EN ACTIVITY_LOGS ===' AS info;

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
  AND tablename = 'activity_logs'
ORDER BY cmd, policyname;
