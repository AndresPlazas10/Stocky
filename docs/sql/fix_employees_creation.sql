-- =====================================================
-- FIX: SOLUCIÓN COMPLETA PARA CREACIÓN DE EMPLEADOS
-- =====================================================
-- Este script soluciona el problema de creación de empleados
-- que funciona en PC del desarrollador pero falla en clientes
-- =====================================================

-- PROBLEMA DIAGNOSTICADO:
-- 1. RLS desactivado (inseguro)
-- 2. Función helper get_user_business_ids() no existe
-- 3. Sin logs para debugging
-- 4. business_id puede ser null/undefined

-- SOLUCIÓN:
-- 1. Reactivar RLS con políticas correctas
-- 2. Crear función helper necesaria
-- 3. Validar business_id antes de INSERT
-- =====================================================

-- PASO 1: CREAR FUNCIÓN HELPER (CRÍTICO)
-- =====================================================

CREATE OR REPLACE FUNCTION get_user_business_ids()
RETURNS TABLE(business_id UUID) 
SECURITY DEFINER -- Bypasea RLS para evitar dependencias circulares
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Devolver negocios creados por el usuario (owner)
  RETURN QUERY
  SELECT id FROM businesses WHERE created_by = auth.uid()
  
  UNION
  
  -- Devolver negocios donde el usuario es empleado activo
  SELECT b.id 
  FROM businesses b
  INNER JOIN employees e ON e.business_id = b.id
  WHERE e.user_id = auth.uid() AND e.is_active = true;
END;
$$;

-- Dar permisos a la función
GRANT EXECUTE ON FUNCTION get_user_business_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_business_ids() TO anon;

COMMENT ON FUNCTION get_user_business_ids() IS 
  'Devuelve los IDs de negocios a los que el usuario tiene acceso (como owner o empleado activo).
   Usa SECURITY DEFINER para bypassear RLS y evitar dependencias circulares.';

-- =====================================================
-- PASO 2: REACTIVAR RLS EN TABLAS CRÍTICAS
-- =====================================================

ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PASO 3: POLÍTICAS PARA BUSINESSES
-- =====================================================

-- Limpiar políticas antiguas
DROP POLICY IF EXISTS "businesses_select" ON businesses;
DROP POLICY IF EXISTS "businesses_insert" ON businesses;
DROP POLICY IF EXISTS "businesses_update" ON businesses;
DROP POLICY IF EXISTS "businesses_delete" ON businesses;
DROP POLICY IF EXISTS "businesses_all" ON businesses;

-- SELECT: Ver negocios a los que tengo acceso
CREATE POLICY "businesses_select"
  ON businesses
  FOR SELECT
  TO authenticated
  USING (id IN (SELECT get_user_business_ids()));

-- INSERT: Permitir crear negocios (cualquier usuario autenticado)
CREATE POLICY "businesses_insert"
  ON businesses
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- UPDATE: Solo owner puede actualizar su negocio
CREATE POLICY "businesses_update"
  ON businesses
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid());

-- DELETE: Solo owner puede eliminar su negocio
CREATE POLICY "businesses_delete"
  ON businesses
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- =====================================================
-- PASO 4: POLÍTICAS PARA EMPLOYEES (CRÍTICO)
-- =====================================================

-- Limpiar políticas antiguas
DROP POLICY IF EXISTS "employees_select" ON employees;
DROP POLICY IF EXISTS "employees_insert" ON employees;
DROP POLICY IF EXISTS "employees_update" ON employees;
DROP POLICY IF EXISTS "employees_delete" ON employees;
DROP POLICY IF EXISTS "employees_all" ON employees;
DROP POLICY IF EXISTS "Enable read access for business members" ON employees;

-- SELECT: Ver empleados de mis negocios
CREATE POLICY "employees_select"
  ON employees
  FOR SELECT
  TO authenticated
  USING (business_id IN (SELECT get_user_business_ids()));

-- INSERT: Permitir crear empleados en mis negocios
-- IMPORTANTE: Esta política usa la función helper para validar business_id
CREATE POLICY "employees_insert"
  ON employees
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Validar que el business_id existe en la lista de negocios del usuario
    business_id IN (SELECT get_user_business_ids())
  );

-- UPDATE: Actualizar empleados de mis negocios
CREATE POLICY "employees_update"
  ON employees
  FOR UPDATE
  TO authenticated
  USING (business_id IN (SELECT get_user_business_ids()))
  WITH CHECK (business_id IN (SELECT get_user_business_ids()));

-- DELETE: Eliminar empleados de mis negocios
CREATE POLICY "employees_delete"
  ON employees
  FOR DELETE
  TO authenticated
  USING (business_id IN (SELECT get_user_business_ids()));

-- =====================================================
-- PASO 5: VERIFICAR CONFIGURACIÓN
-- =====================================================

-- Ver si RLS está habilitado
SELECT 
  schemaname,
  tablename AS tabla,
  CASE 
    WHEN rowsecurity THEN '✅ RLS HABILITADO'
    ELSE '❌ RLS DESHABILITADO'
  END AS status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('businesses', 'employees')
ORDER BY tablename;

-- Ver políticas activas
SELECT 
  schemaname,
  tablename AS tabla,
  policyname AS politica,
  cmd AS operacion
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('businesses', 'employees')
ORDER BY tablename, policyname;

-- Ver si la función existe
SELECT 
  routine_name,
  routine_type,
  security_type,
  'GRANT EXECUTE ON FUNCTION ' || routine_name || '() TO authenticated;' as permisos
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'get_user_business_ids';

-- =====================================================
-- PASO 6: TEST DE LA FUNCIÓN
-- =====================================================

-- Probar la función (debe devolver los business_ids del usuario actual)
SELECT * FROM get_user_business_ids();

-- Si no devuelve nada, verificar:
-- 1. Que estés autenticado (auth.uid() no es null)
-- 2. Que tengas un negocio en businesses con created_by = tu user_id
-- 3. O que tengas un registro en employees con user_id = tu user_id

-- =====================================================
-- RESULTADO ESPERADO
-- =====================================================
/*
DESPUÉS DE EJECUTAR ESTE SCRIPT:

1. RLS HABILITADO en businesses y employees ✅
2. Función get_user_business_ids() EXISTE ✅
3. Políticas CORRECTAS creadas ✅
4. INSERT en employees FUNCIONARÁ para:
   - Owners creando empleados en su negocio ✅
   - La función valida automáticamente el business_id ✅

TESTING:
1. Login como owner
2. Ir a Dashboard > Empleados
3. Crear un nuevo empleado
4. Verificar que se crea exitosamente
5. Verificar en consola del navegador que NO hay errores

Si sigue fallando:
1. Verificar en DevTools → Network → Fetch/XHR
2. Buscar el POST a /auth/v1/signup
3. Verificar el response code (debe ser 200)
4. Buscar el INSERT en employees
5. Ver el error específico en la respuesta
*/

-- =====================================================
-- NOTAS IMPORTANTES
-- =====================================================
/*
⚠️  SEGURIDAD:
- Con RLS habilitado, los usuarios solo pueden:
  - Ver empleados de SUS negocios
  - Crear empleados en SUS negocios
  - No pueden acceder a datos de otros negocios

✅ PRODUCTION READY:
- Estas políticas son seguras para producción
- Protegen datos multi-tenant
- Evitan dependencias circulares

🔧 DEBUGGING:
- Si falla, revisar logs en Supabase Dashboard:
  - Settings → API → Logs
  - Authentication → Users (verificar que se crea el usuario)
  - Database → employees (verificar que se inserta el registro)

📝 ROLLBACK:
- Si necesitas revertir, ejecuta: docs/sql/disable_all_rls.sql
- Pero NO es recomendado para producción
*/
