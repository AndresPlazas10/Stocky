-- =====================================================
-- SOLUCIÓN RECURSIÓN INFINITA - BUSINESSES + EMPLOYEES
-- =====================================================
-- Este script corrige el problema de recursión infinita
-- entre las políticas RLS de businesses y employees
-- =====================================================

-- =====================================================
-- PASO 1: ELIMINAR POLÍTICAS PROBLEMÁTICAS
-- =====================================================

DROP POLICY IF EXISTS "businesses_select_policy" ON businesses;
DROP POLICY IF EXISTS "employees_select_policy" ON employees;

-- =====================================================
-- PASO 2: FUNCIÓN HELPER PARA VERIFICAR SI USUARIO ES EMPLEADO
-- =====================================================
-- Esta función usa SECURITY DEFINER para bypassear RLS
-- y romper la dependencia circular

CREATE OR REPLACE FUNCTION is_user_employee_of_business(business_uuid UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Verificar si el usuario actual es empleado activo del negocio
  RETURN EXISTS (
    SELECT 1 
    FROM employees 
    WHERE business_id = business_uuid 
      AND user_id = auth.uid() 
      AND is_active = true
  );
END;
$$;

GRANT EXECUTE ON FUNCTION is_user_employee_of_business(UUID) TO authenticated;

COMMENT ON FUNCTION is_user_employee_of_business(UUID) IS
  'Verifica si el usuario actual es empleado activo de un negocio específico.
   Usa SECURITY DEFINER para evitar recursión con políticas RLS.';

-- =====================================================
-- PASO 3: FUNCIÓN HELPER PARA VERIFICAR SI USUARIO ES OWNER
-- =====================================================

CREATE OR REPLACE FUNCTION is_user_owner_of_business(business_uuid UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Verificar si el usuario actual es owner del negocio
  RETURN EXISTS (
    SELECT 1 
    FROM businesses 
    WHERE id = business_uuid 
      AND created_by = auth.uid()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION is_user_owner_of_business(UUID) TO authenticated;

COMMENT ON FUNCTION is_user_owner_of_business(UUID) IS
  'Verifica si el usuario actual es owner de un negocio específico.
   Usa SECURITY DEFINER para evitar recursión con políticas RLS.';

-- =====================================================
-- PASO 4: NUEVA POLÍTICA SELECT PARA BUSINESSES (SIN RECURSIÓN)
-- =====================================================

CREATE POLICY "businesses_select_policy"
ON businesses
FOR SELECT
TO authenticated
USING (
  -- Solo puedes ver negocios donde eres el owner
  created_by = auth.uid()
  -- Nota: Los empleados NO pueden hacer SELECT directo en businesses
  -- Pero pueden acceder a través de get_user_business_ids() en otras tablas
);

COMMENT ON POLICY "businesses_select_policy" ON businesses IS
  'Permite ver solo negocios donde eres el owner (rompe recursión con employees)';

-- =====================================================
-- PASO 5: NUEVA POLÍTICA SELECT PARA EMPLOYEES (SIN RECURSIÓN)
-- =====================================================

CREATE POLICY "employees_select_policy"
ON employees
FOR SELECT
TO authenticated
USING (
  -- Puedes ver tu propio registro de empleado
  user_id = auth.uid()
  OR
  -- O si eres owner del negocio (usando función helper)
  is_user_owner_of_business(business_id)
);

COMMENT ON POLICY "employees_select_policy" ON employees IS
  'Permite ver tu propio registro o empleados de negocios donde eres owner';

-- =====================================================
-- PASO 6: POLÍTICAS INSERT/UPDATE/DELETE PARA EMPLOYEES
-- =====================================================
-- También usan función helper para evitar problemas

DROP POLICY IF EXISTS "employees_insert_policy" ON employees;
DROP POLICY IF EXISTS "employees_update_policy" ON employees;
DROP POLICY IF EXISTS "employees_delete_policy" ON employees;

CREATE POLICY "employees_insert_policy"
ON employees
FOR INSERT
TO authenticated
WITH CHECK (
  is_user_owner_of_business(business_id)
);

CREATE POLICY "employees_update_policy"
ON employees
FOR UPDATE
TO authenticated
USING (
  is_user_owner_of_business(business_id) OR user_id = auth.uid()
)
WITH CHECK (
  is_user_owner_of_business(business_id) OR user_id = auth.uid()
);

CREATE POLICY "employees_delete_policy"
ON employees
FOR DELETE
TO authenticated
USING (
  is_user_owner_of_business(business_id)
);

COMMENT ON POLICY "employees_insert_policy" ON employees IS
  'Solo owner puede crear empleados (usa función helper)';
COMMENT ON POLICY "employees_update_policy" ON employees IS
  'Owner o empleado mismo puede actualizar (usa función helper)';
COMMENT ON POLICY "employees_delete_policy" ON employees IS
  'Solo owner puede eliminar empleados (usa función helper)';

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '=============================================';
  RAISE NOTICE '✅ RECURSIÓN INFINITA CORREGIDA';
  RAISE NOTICE '=============================================';
  RAISE NOTICE '';
  RAISE NOTICE '🔧 CAMBIOS APLICADOS:';
  RAISE NOTICE '';
  RAISE NOTICE '1️⃣  Función is_user_employee_of_business(uuid):';
  RAISE NOTICE '    ✓ SECURITY DEFINER (bypasea RLS)';
  RAISE NOTICE '    ✓ Verifica si usuario es empleado activo';
  RAISE NOTICE '';
  RAISE NOTICE '2️⃣  Función is_user_owner_of_business(uuid):';
  RAISE NOTICE '    ✓ SECURITY DEFINER (bypasea RLS)';
  RAISE NOTICE '    ✓ Verifica si usuario es owner';
  RAISE NOTICE '';
  RAISE NOTICE '3️⃣  Política businesses SELECT:';
  RAISE NOTICE '    ✓ Solo owner puede ver (created_by = auth.uid())';
  RAISE NOTICE '    ✓ NO consulta employees (rompe recursión)';
  RAISE NOTICE '';
  RAISE NOTICE '4️⃣  Política employees SELECT:';
  RAISE NOTICE '    ✓ Usuario ve su propio registro';
  RAISE NOTICE '    ✓ Owner ve todos sus empleados (usando función)';
  RAISE NOTICE '    ✓ NO consulta businesses en subquery (rompe recursión)';
  RAISE NOTICE '';
  RAISE NOTICE '5️⃣  Políticas employees INSERT/UPDATE/DELETE:';
  RAISE NOTICE '    ✓ Todas usan is_user_owner_of_business()';
  RAISE NOTICE '    ✓ Sin subqueries a businesses';
  RAISE NOTICE '    ✓ Evita violaciones de RLS policy';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 RESULTADO:';
  RAISE NOTICE '    ✓ Sin recursión infinita';
  RAISE NOTICE '    ✓ Puedes crear negocios sin error';
  RAISE NOTICE '    ✓ Empleados pueden acceder a través de get_user_business_ids()';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  NOTA IMPORTANTE:';
  RAISE NOTICE '    Los empleados NO hacen SELECT directo en businesses.';
  RAISE NOTICE '    Acceden al negocio a través de:';
  RAISE NOTICE '    - Consultas JOIN desde otras tablas';
  RAISE NOTICE '    - La función get_user_business_ids()';
  RAISE NOTICE '    - Esto es normal y esperado';
  RAISE NOTICE '';
  RAISE NOTICE '=============================================';
END $$;

-- =====================================================
-- QUERIES DE VERIFICACIÓN
-- =====================================================

-- Ver políticas de businesses
SELECT 
  '=== POLÍTICAS BUSINESSES ===' AS info;

SELECT 
  policyname,
  cmd,
  qual::text AS using_clause
FROM pg_policies
WHERE tablename = 'businesses'
ORDER BY cmd;

-- Ver políticas de employees  
SELECT 
  '=== POLÍTICAS EMPLOYEES ===' AS info;

SELECT 
  policyname,
  cmd,
  qual::text AS using_clause
FROM pg_policies
WHERE tablename = 'employees'
ORDER BY cmd;

-- Ver funciones helper
SELECT 
  '=== FUNCIONES HELPER ===' AS info;

SELECT 
  routine_name,
  security_type
FROM information_schema.routines
WHERE routine_name IN ('is_user_employee_of_business', 'is_user_owner_of_business');
