-- =====================================================
-- DIAGNÓSTICO URGENTE: RLS BLOQUEANDO CREACIÓN
-- =====================================================
-- Ejecutar esto primero para ver qué está pasando
-- =====================================================

-- PASO 1: Ver si RLS está habilitado
-- =====================================================
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename = 'businesses';

-- PASO 2: Ver TODAS las políticas actuales
-- =====================================================
SELECT 
  policyname,
  cmd,
  permissive,
  roles::text,
  qual::text as using_clause,
  with_check::text as with_check_clause
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'businesses'
ORDER BY cmd, policyname;

-- PASO 3: Verificar el usuario actual
-- =====================================================
SELECT 
  auth.uid() as mi_user_id,
  CASE 
    WHEN auth.uid() IS NULL THEN '❌ NO AUTENTICADO'
    ELSE '✅ AUTENTICADO'
  END as estado;

-- PASO 4: Ver si tienes negocios existentes
-- =====================================================
SELECT 
  id,
  name,
  created_by,
  CASE 
    WHEN created_by = auth.uid() THEN '✅ Mío'
    ELSE '❌ De otro usuario'
  END as ownership
FROM businesses
LIMIT 10;

-- =====================================================
-- SOLUCIÓN TEMPORAL: DESACTIVAR RLS PARA TESTING
-- =====================================================
-- ⚠️ SOLO PARA DEBUGGING - NO EN PRODUCCIÓN
/*
ALTER TABLE businesses DISABLE ROW LEVEL SECURITY;

-- Ahora intenta crear el negocio desde la app
-- Luego vuelve a habilitar:
-- ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
*/

-- =====================================================
-- SOLUCIÓN DEFINITIVA: ELIMINAR Y RECREAR POLÍTICAS
-- =====================================================

-- PASO A: Eliminar TODAS las políticas actuales
DROP POLICY IF EXISTS "businesses_select" ON businesses;
DROP POLICY IF EXISTS "businesses_select_policy" ON businesses;
DROP POLICY IF EXISTS "businesses_select_simple" ON businesses;
DROP POLICY IF EXISTS "businesses_select_with_employees" ON businesses;
DROP POLICY IF EXISTS "businesses_insert" ON businesses;
DROP POLICY IF EXISTS "businesses_insert_policy" ON businesses;
DROP POLICY IF EXISTS "businesses_insert_simple" ON businesses;
DROP POLICY IF EXISTS "businesses_update" ON businesses;
DROP POLICY IF EXISTS "businesses_update_policy" ON businesses;
DROP POLICY IF EXISTS "businesses_update_simple" ON businesses;
DROP POLICY IF EXISTS "businesses_delete" ON businesses;
DROP POLICY IF EXISTS "businesses_delete_policy" ON businesses;
DROP POLICY IF EXISTS "businesses_delete_simple" ON businesses;

-- PASO B: Verificar que no quedaron políticas
SELECT COUNT(*) as policies_remaining 
FROM pg_policies 
WHERE tablename = 'businesses';
-- Debe retornar 0

-- PASO C: Asegurar que RLS está habilitado
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;

-- PASO D: Crear SOLO la política INSERT (mínima)
CREATE POLICY "businesses_allow_insert"
  ON businesses
  FOR INSERT
  TO authenticated
  WITH CHECK (true);  -- ⚠️ PERMISIVO - Solo para testing

-- PASO E: Probar INSERT desde la app
-- Si funciona, el problema ERA la política WITH CHECK

-- PASO F: Crear política INSERT segura
DROP POLICY IF EXISTS "businesses_allow_insert" ON businesses;

CREATE POLICY "businesses_insert_secure"
  ON businesses
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- PASO G: Crear política SELECT
CREATE POLICY "businesses_select_secure"
  ON businesses
  FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

-- PASO H: Crear política UPDATE
CREATE POLICY "businesses_update_secure"
  ON businesses
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- PASO I: Crear política DELETE
CREATE POLICY "businesses_delete_secure"
  ON businesses
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- =====================================================
-- VERIFICACIÓN FINAL
-- =====================================================

-- Ver políticas activas
SELECT 
  policyname,
  cmd,
  permissive,
  CASE 
    WHEN cmd = 'INSERT' AND with_check IS NOT NULL THEN '✅ WITH CHECK OK'
    WHEN cmd = 'SELECT' AND qual IS NOT NULL THEN '✅ USING OK'
    WHEN cmd = 'UPDATE' AND qual IS NOT NULL AND with_check IS NOT NULL THEN '✅ USING + CHECK OK'
    WHEN cmd = 'DELETE' AND qual IS NOT NULL THEN '✅ USING OK'
    ELSE '❌ Configuración incompleta'
  END as estado
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'businesses'
ORDER BY cmd;

-- =====================================================
-- ALTERNATIVA: POLÍTICA PERMISIVA (Solo debugging)
-- =====================================================
-- Si NADA funciona, usa esto temporalmente:
/*
DROP POLICY IF EXISTS "businesses_allow_all" ON businesses;

CREATE POLICY "businesses_allow_all"
  ON businesses
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Esto permite TODO a usuarios autenticados
-- ⚠️ NO USAR EN PRODUCCIÓN
*/

-- =====================================================
-- DIAGNÓSTICO AVANZADO
-- =====================================================

-- Ver el SQL generado para INSERT
EXPLAIN (VERBOSE, COSTS OFF)
INSERT INTO businesses (name, type, created_by)
VALUES ('Test', 'Retail', auth.uid());

-- Ver si hay triggers que bloqueen
SELECT 
  trigger_name,
  event_manipulation,
  action_statement,
  action_timing
FROM information_schema.triggers
WHERE event_object_table = 'businesses'
  AND event_object_schema = 'public'
  AND event_manipulation = 'INSERT';

-- Ver constraints que puedan bloquear
SELECT 
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.table_schema = 'public'
  AND tc.table_name = 'businesses';

-- =====================================================
-- PRUEBA MANUAL DE INSERCIÓN
-- =====================================================

-- Ver tu user_id actual
SELECT auth.uid() as mi_user_id;

-- Intentar insertar directamente (reemplaza el UUID)
/*
INSERT INTO businesses (
  id,
  name,
  type,
  created_by,
  created_at
) VALUES (
  gen_random_uuid(),
  'Test Manual',
  'Retail',
  auth.uid(),  -- Reemplaza con tu user_id si auth.uid() es null
  NOW()
);
*/

-- =====================================================
-- RESUMEN DE POSIBLES CAUSAS
-- =====================================================

/*
❌ POSIBLES CAUSAS:

1. auth.uid() retorna NULL
   → Usuario no autenticado en Supabase
   → Solución: Verificar sesión en la app

2. Política INSERT tiene USING (no debe)
   → INSERT solo debe tener WITH CHECK
   → Solución: Recrear política sin USING

3. Política WITH CHECK muy restrictiva
   → created_by = auth.uid() pero auth.uid() es NULL
   → Solución: Verificar autenticación

4. Hay múltiples políticas conflictivas
   → Políticas se suman con AND
   → Solución: Eliminar todas y crear solo 1 por comando

5. Trigger bloqueando INSERT
   → Trigger BEFORE INSERT retorna NULL
   → Solución: Ver y deshabilitar trigger

6. Constraint de foreign key
   → created_by referencia auth.users pero UUID inválido
   → Solución: Verificar que user existe

SIGUIENTE PASO:
===============
Ejecuta PARTE 1-4 para diagnosticar, luego SOLUCIÓN DEFINITIVA.
*/
