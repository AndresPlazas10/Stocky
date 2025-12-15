-- =====================================================
-- POLÍTICAS RLS - TABLA EMPLOYEES
-- =====================================================
-- Políticas de seguridad a nivel de fila para employees
-- IMPORTANTE: NO usa get_user_business_ids() para evitar
-- recursión infinita (esa función consulta employees)
-- =====================================================

-- =====================================================
-- LIMPIAR POLÍTICAS EXISTENTES
-- =====================================================

DROP POLICY IF EXISTS "employees_select_policy" ON employees;
DROP POLICY IF EXISTS "employees_insert_policy" ON employees;
DROP POLICY IF EXISTS "employees_update_policy" ON employees;
DROP POLICY IF EXISTS "employees_delete_policy" ON employees;

-- =====================================================
-- ASEGURAR QUE RLS ESTÁ HABILITADO
-- =====================================================

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- POLÍTICA 1: SELECT (Ver/Leer empleados)
-- =====================================================
-- IMPORTANTE: NO consulta businesses en subquery para evitar recursión
-- Usa función helper SECURITY DEFINER en su lugar

CREATE POLICY "employees_select_policy"
ON employees
FOR SELECT
TO authenticated
USING (
  -- Es mi propio registro de empleado
  user_id = auth.uid()
  OR
  -- Soy owner del negocio (usando función helper para evitar recursión)
  is_user_owner_of_business(business_id)
);

COMMENT ON POLICY "employees_select_policy" ON employees IS
  'Permite ver tu propio registro o empleados de negocios donde eres owner (sin recursión)';

-- =====================================================
-- POLÍTICA 2: INSERT (Crear empleados)
-- =====================================================
-- Solo el OWNER del negocio puede crear empleados
-- Usa función helper para evitar problemas con RLS de businesses

CREATE POLICY "employees_insert_policy"
ON employees
FOR INSERT
TO authenticated
WITH CHECK (
  -- Solo el owner del negocio puede crear empleados (usando función helper)
  is_user_owner_of_business(business_id)
);

COMMENT ON POLICY "employees_insert_policy" ON employees IS
  'Solo el owner del negocio puede crear empleados (usa función helper)';

-- =====================================================
-- POLÍTICA 3: UPDATE (Actualizar empleados)
-- =====================================================
-- Permite actualizar si:
-- 1. Eres el OWNER del negocio (puede actualizar cualquier empleado)
-- 2. Eres TÚ mismo (solo tu propio registro)

CREATE POLICY "employees_update_policy"
ON employees
FOR UPDATE
TO authenticated
USING (
  -- Soy el owner del negocio
  business_id IN ( (usando función helper)
  is_user_owner_of_business(business_id)
  OR
  -- Es mi propio registro
  user_id = auth.uid()
)
WITH CHECK (
  -- Después de actualizar, debe cumplir las mismas condiciones
  is_user_owner_of_business(business_id)
  OR
  user_id = auth.uid()
);

COMMENT ON POLICY "employees_update_policy" ON employees IS
  'Owner puede actualizar cualquier empleado, empleados pueden actualizar su propio registro (usa función helper)
-- =====================================================
-- POLÍTICA 4: DELETE (Eliminar empleados)
-- =====================================================
-- Solo el OWNER del negocio puede eliminar empleados

CREATE POLICY "employees_delete_policy"
ON employees
FOR DELETE
TO authenticated
USING (
  -- Solo el owner del negocio puede eliminar empleados
  business_id IN (
    SELECT id FROM businesses WHERE created_by = auth.uid()
  )
); (usando función helper)
  is_user_owner_of_business(business_id)
);

COMMENT ON POLICY "employees_delete_policy" ON employees IS
  'Solo el owner del negocio puede eliminar empleados (usa función helper)===

DO $$
BEGIN
  RAISE NOTICE '=============================================';
  RAISE NOTICE '✅ POLÍTICAS RLS CREADAS - EMPLOYEES';
  RAISE NOTICE '=============================================';
  RAISE NOTICE '';
  RAISE NOTICE '📋 POLÍTICAS ACTIVAS:';
  RAISE NOTICE '';
  RAISE NOTICE '1️⃣  SELECT (Ver empleados):';
  RAISE NOTICE '    ✓ OWNER ve todos los empleados (usando función helper)';
  RAISE NOTICE '    ✓ Empleados solo se ven a sí mismos';
  RAISE NOTICE '    ⚠️  NO consulta businesses en subquery (evita recursión)';
  RAISE NOTICE '';
  RAISE NOTICE '2️⃣  INSERT (Crear empleados):';
  RAISE NOTICE '    ✓ Solo el OWNER del negocio';
  RAISE NOTICE '    ✓ Empleados NO pueden crear otros empleados';
  RAISE NOTICE '';
  RAISE NOTICE '3️⃣  UPDATE (Actualizar empleados):';
  RAISE NOTICE '    ✓ OWNER puede actualizar cualquier empleado';
  RAISE NOTICE '    ✓ Empleados pueden actualizar su propio registro';
  RAISE NOTICE '';
  RAISE NOTICE '4️⃣  DELETE (Eliminar empleados):';
  RAISE NOTICE '    ✓ Solo el OWNER del negocio';
  RAISE NOTICE '    ✓ Empleados NO pueden eliminarse ni eliminar otros';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 SEGURIDAD:';
  RAISE NOTICE '    ✓ RLS habilitado en employees';
  RAISE NOTICE '    ✓ NO usa get_user_business_ids() (evita recursión)';
  RAISE NOTICE '    ✓ Consulta directa a businesses.created_by';
  RAISE NOTICE '    ✓ Empleados aislados (solo ven su propio registro)';
  RAISE NOTICE '';Usa función is_user_owner_of_business() SECURITY DEFINER';
  RAISE NOTICE '    ✓ Sin subqueries a businesses (evita problemas RLS)
  RAISE NOTICE '⚠️  IMPORTANTE:';
  RAISE NOTICE '    Esta tabla NO debe usar get_user_business_ids()';
  RAISE NOTICE '    porque esa función consulta employees (recursión infinita)';
  RAISE NOTICE '';
  RAISE NOTICE '=============================================';
END $$;

-- =====================================================
-- QUERY DE VERIFICACIÓN
-- =====================================================

SELECT 
  '=== POLÍTICAS RLS EN EMPLOYEES ===' AS info;

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
  AND tablename = 'employees'
ORDER BY cmd, policyname;
