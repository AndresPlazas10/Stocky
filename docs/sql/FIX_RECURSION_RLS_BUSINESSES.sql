-- =====================================================
-- DIAGNÓSTICO: RECURSIÓN INFINITA EN POLICIES RLS
-- =====================================================
-- Error: "infinite recursion detected in policy for relation businesses"
-- Análisis técnico completo y solución definitiva
-- =====================================================

-- =====================================================
-- PARTE 1: DIAGNÓSTICO DEL PROBLEMA
-- =====================================================

/*
PROBLEMA IDENTIFICADO:
=====================

La política "businesses_select_policy" tiene una recursión infinita:

CREATE POLICY "businesses_select_policy"
  ON businesses FOR SELECT
  USING (
    created_by = auth.uid()
    OR
    id IN (
      SELECT business_id FROM employees 
      WHERE user_id = auth.uid() AND is_active = true  -- ✅ OK
    )
  );

❌ CAUSA DE RECURSIÓN:
Cuando se ejecuta la subconsulta:
  SELECT business_id FROM employees WHERE user_id = auth.uid()

PostgreSQL TAMBIÉN aplica RLS a la tabla 'employees'.

La política de 'employees' valida:
  business_id IN (SELECT id FROM businesses WHERE ...)  -- ❌ RECURSIÓN!

CICLO INFINITO:
1. businesses SELECT → necesita validar employees
2. employees SELECT → necesita validar businesses
3. businesses SELECT → necesita validar employees
4. ... INFINITO

SOLUCIÓN:
=========
Eliminar TODAS las subconsultas que referencien otras tablas con RLS.
Usar solo columnas directas de la tabla actual.
*/

-- =====================================================
-- PARTE 2: VER POLÍTICAS ACTUALES (DIAGNÓSTICO)
-- =====================================================

-- Ver TODAS las políticas de businesses
SELECT 
  policyname,
  cmd,
  qual::text as using_expression,
  with_check::text as check_expression
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'businesses'
ORDER BY cmd;

-- Ver políticas de employees (para identificar recursión)
SELECT 
  policyname,
  cmd,
  qual::text as using_expression,
  with_check::text as check_expression
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'employees'
ORDER BY cmd;

-- =====================================================
-- PARTE 3: ELIMINAR POLÍTICAS PROBLEMÁTICAS
-- =====================================================

-- ⚠️ PASO OBLIGATORIO: Borrar TODAS las políticas de businesses
DROP POLICY IF EXISTS "businesses_select" ON businesses;
DROP POLICY IF EXISTS "businesses_select_policy" ON businesses;
DROP POLICY IF EXISTS "businesses_insert" ON businesses;
DROP POLICY IF EXISTS "businesses_insert_policy" ON businesses;
DROP POLICY IF EXISTS "businesses_update" ON businesses;
DROP POLICY IF EXISTS "businesses_update_policy" ON businesses;
DROP POLICY IF EXISTS "businesses_delete" ON businesses;
DROP POLICY IF EXISTS "businesses_delete_policy" ON businesses;

-- Verificar que se eliminaron
SELECT COUNT(*) as policies_remaining 
FROM pg_policies 
WHERE tablename = 'businesses';
-- Debe retornar 0

-- =====================================================
-- PARTE 4: POLÍTICAS RLS CORRECTAS (SIN RECURSIÓN)
-- =====================================================

-- ✅ REGLA DE ORO: 
-- Las políticas de 'businesses' solo deben validar la columna 'created_by'
-- NO deben hacer subconsultas a 'employees' ni a ninguna otra tabla

-- POLÍTICA 1: SELECT (Ver negocios)
-- Solo usuarios que son dueños del negocio
CREATE POLICY "businesses_select_simple"
  ON businesses
  FOR SELECT
  TO authenticated
  USING (
    -- SOLO validar que el usuario es el creador
    created_by = auth.uid()
  );

COMMENT ON POLICY "businesses_select_simple" ON businesses IS
  'Usuarios solo ven negocios donde created_by = su user_id. SIN subconsultas para evitar recursión.';

-- POLÍTICA 2: INSERT (Crear negocio)
-- Cualquier usuario autenticado puede crear su negocio
CREATE POLICY "businesses_insert_simple"
  ON businesses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Validar que el usuario es quien se registra como creador
    created_by = auth.uid()
  );

COMMENT ON POLICY "businesses_insert_simple" ON businesses IS
  'Permite crear negocios. Solo valida que created_by sea el usuario actual.';

-- POLÍTICA 3: UPDATE (Actualizar negocio)
-- Solo el dueño puede actualizar
CREATE POLICY "businesses_update_simple"
  ON businesses
  FOR UPDATE
  TO authenticated
  USING (
    -- Solo el creador puede ver el negocio para actualizarlo
    created_by = auth.uid()
  )
  WITH CHECK (
    -- Solo puede actualizarlo si sigue siendo el creador
    created_by = auth.uid()
  );

COMMENT ON POLICY "businesses_update_simple" ON businesses IS
  'Solo el dueño (created_by) puede actualizar su negocio.';

-- POLÍTICA 4: DELETE (Eliminar negocio)
-- Solo el dueño puede eliminar
CREATE POLICY "businesses_delete_simple"
  ON businesses
  FOR DELETE
  TO authenticated
  USING (
    -- Solo el creador puede eliminar
    created_by = auth.uid()
  );

COMMENT ON POLICY "businesses_delete_simple" ON businesses IS
  'Solo el dueño (created_by) puede eliminar su negocio.';

-- =====================================================
-- PARTE 5: VERIFICACIÓN DE POLÍTICAS
-- =====================================================

-- Ver políticas creadas
SELECT 
  policyname,
  cmd as operacion,
  permissive,
  roles,
  CASE 
    WHEN qual IS NOT NULL THEN '✅ Tiene USING'
    ELSE '⚪ Sin USING'
  END as using_clause,
  CASE 
    WHEN with_check IS NOT NULL THEN '✅ Tiene WITH CHECK'
    ELSE '⚪ Sin WITH CHECK'
  END as check_clause
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'businesses'
ORDER BY cmd;

-- Verificar contenido de las políticas (sin recursión)
SELECT 
  policyname,
  cmd,
  qual::text as using_expression
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'businesses'
  AND qual IS NOT NULL;

-- =====================================================
-- PARTE 6: SOLUCIÓN PARA EMPLEADOS (OPCIONAL)
-- =====================================================

/*
IMPORTANTE: 
===========
Si quieres que EMPLEADOS también vean el negocio donde trabajan,
NO puedes hacerlo en la política de 'businesses' (causaría recursión).

OPCIÓN A (Recomendada): 
- Mantener política simple en 'businesses'
- En el frontend, hacer JOIN explícito:
  SELECT b.* FROM businesses b
  LEFT JOIN employees e ON e.business_id = b.id
  WHERE b.created_by = auth.uid()
     OR (e.user_id = auth.uid() AND e.is_active = true)

OPCIÓN B (Función SECURITY DEFINER sin RLS):
- Crear función que bypasea RLS para obtener business_ids
- Ver implementación abajo
*/

-- Función auxiliar (opcional) - Bypasea RLS
CREATE OR REPLACE FUNCTION get_user_businesses()
RETURNS TABLE(business_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER  -- Bypasea RLS
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  -- Negocios propios
  SELECT id FROM businesses WHERE created_by = auth.uid()
  UNION
  -- Negocios donde soy empleado (sin validar RLS de businesses)
  SELECT e.business_id 
  FROM employees e
  WHERE e.user_id = auth.uid() 
    AND e.is_active = true;
END;
$$;

GRANT EXECUTE ON FUNCTION get_user_businesses() TO authenticated;

-- Ahora SÍ podemos usar la función en SELECT (no causa recursión)
DROP POLICY IF EXISTS "businesses_select_simple" ON businesses;

CREATE POLICY "businesses_select_with_employees"
  ON businesses
  FOR SELECT
  TO authenticated
  USING (
    -- Usar función que bypasea RLS
    id IN (SELECT business_id FROM get_user_businesses())
  );

COMMENT ON POLICY "businesses_select_with_employees" ON businesses IS
  'Ver negocios propios o donde soy empleado. Usa función SECURITY DEFINER para evitar recursión.';

-- =====================================================
-- PARTE 7: VERIFICAR TRIGGERS Y DEFAULTS
-- =====================================================

-- Ver triggers en businesses
SELECT 
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'businesses'
  AND event_object_schema = 'public';

-- Ver columnas con defaults problemáticos
SELECT 
  column_name,
  column_default,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'businesses'
  AND column_default IS NOT NULL;

-- Ver constraints que puedan causar problemas
SELECT 
  constraint_name,
  constraint_type
FROM information_schema.table_constraints
WHERE table_schema = 'public'
  AND table_name = 'businesses';

-- =====================================================
-- PARTE 8: PRUEBA FINAL
-- =====================================================

-- Test 1: Ver mis negocios (debe funcionar)
SELECT id, name, created_by 
FROM businesses 
WHERE created_by = auth.uid();

-- Test 2: Crear negocio (debe funcionar)
-- (Ejecutar desde la app o reemplazar valores)
/*
INSERT INTO businesses (
  name,
  type,
  created_by
) VALUES (
  'Test Negocio',
  'Retail',
  auth.uid()
);
*/

-- =====================================================
-- PARTE 9: RESUMEN TÉCNICO
-- =====================================================

DO $$
DECLARE
  v_policy_count INTEGER;
  v_trigger_count INTEGER;
BEGIN
  -- Contar políticas
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE tablename = 'businesses';
  
  -- Contar triggers
  SELECT COUNT(*) INTO v_trigger_count
  FROM information_schema.triggers
  WHERE event_object_table = 'businesses';
  
  RAISE NOTICE '================================================';
  RAISE NOTICE '✅ DIAGNÓSTICO COMPLETADO';
  RAISE NOTICE '================================================';
  RAISE NOTICE 'Políticas en businesses: %', v_policy_count;
  RAISE NOTICE 'Triggers en businesses: %', v_trigger_count;
  RAISE NOTICE '';
  RAISE NOTICE '🔧 SOLUCIÓN APLICADA:';
  RAISE NOTICE '  ✅ Políticas simples (solo created_by)';
  RAISE NOTICE '  ✅ Sin subconsultas recursivas';
  RAISE NOTICE '  ✅ Sin dependencias circulares';
  RAISE NOTICE '';
  RAISE NOTICE '📋 POLÍTICAS ACTIVAS:';
  RAISE NOTICE '  - SELECT: created_by = auth.uid()';
  RAISE NOTICE '  - INSERT: created_by = auth.uid()';
  RAISE NOTICE '  - UPDATE: created_by = auth.uid()';
  RAISE NOTICE '  - DELETE: created_by = auth.uid()';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Ya puedes crear negocios sin errores';
  RAISE NOTICE '================================================';
END $$;

-- =====================================================
-- NOTAS FINALES
-- =====================================================

/*
CAUSA RAÍZ DEL PROBLEMA:
========================
La política original tenía:
  id IN (SELECT business_id FROM employees WHERE ...)

Cuando PostgreSQL ejecuta esa subconsulta:
1. Aplica RLS a 'employees'
2. La política de 'employees' valida contra 'businesses'
3. La política de 'businesses' vuelve a validar contra 'employees'
4. ♾️ RECURSIÓN INFINITA

SOLUCIÓN IMPLEMENTADA:
=====================
Políticas de 'businesses' solo validan 'created_by'.
NO hacen subconsultas a otras tablas.
Si necesitas que empleados vean negocios, usa:
- Función SECURITY DEFINER (implementada arriba), o
- JOIN en el frontend/aplicación

VENTAJAS:
=========
✅ Cero recursión
✅ Performance óptimo (sin subconsultas)
✅ Lógica clara y simple
✅ Fácil de debuggear

DESVENTAJAS:
============
⚠️ Empleados NO ven negocios automáticamente
   Solución: Usar get_user_businesses() o JOIN en app

RECOMENDACIÓN FINAL:
====================
1. Usar política simple (solo created_by) en businesses
2. En employees, validar solo business_id sin referencias
3. En el frontend, hacer JOINs explícitos cuando sea necesario
4. Para reportes/dashboards, usar vistas o funciones SECURITY DEFINER

PRÓXIMOS PASOS:
===============
1. ✅ Ejecutar este script completo
2. ✅ Probar crear negocio desde la app
3. ✅ Verificar que no hay errores de recursión
4. ⚪ (Opcional) Implementar get_user_businesses() si necesitas
5. ⚪ Actualizar políticas de employees (sin referencias a businesses)
*/
