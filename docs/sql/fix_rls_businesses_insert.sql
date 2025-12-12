-- =====================================================
-- FIX URGENTE: Error al crear negocios
-- =====================================================
-- Error: "new row violates row-level-security policy"
-- Causa: Política INSERT muy restrictiva
-- Solución: Permitir a cualquier usuario autenticado crear negocio
-- =====================================================

-- DIAGNÓSTICO: Ver política actual
-- =====================================================
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'businesses'
  AND cmd = 'INSERT';

-- =====================================================
-- SOLUCIÓN RÁPIDA: Corregir política INSERT
-- =====================================================

-- OPCIÓN 1: Recrear política INSERT (Recomendado)
-- =====================================================
DROP POLICY IF EXISTS "businesses_insert" ON businesses;

CREATE POLICY "businesses_insert"
  ON businesses
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

COMMENT ON POLICY "businesses_insert" ON businesses IS
  'Permite a cualquier usuario autenticado crear un negocio. Solo valida que created_by sea el usuario actual.';

-- =====================================================
-- OPCIÓN 2: Si OPCIÓN 1 no funciona, deshabilitar RLS temporalmente
-- =====================================================
/*
-- ⚠️ SOLO USAR SI OPCIÓN 1 FALLA
-- Deshabilitar RLS en businesses temporalmente
ALTER TABLE businesses DISABLE ROW LEVEL SECURITY;

-- Probar crear negocio desde la app
-- Después de verificar que funciona, VOLVER A HABILITAR:
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;

-- Y recrear las políticas correctamente
*/

-- =====================================================
-- OPCIÓN 3: Política ultra-permisiva (último recurso)
-- =====================================================
/*
-- ⚠️ SOLO SI NADA MÁS FUNCIONA
DROP POLICY IF EXISTS "businesses_insert" ON businesses;

CREATE POLICY "businesses_insert_permissive"
  ON businesses
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Después de verificar, reemplazar por la política segura:
-- WITH CHECK (created_by = auth.uid())
*/

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

-- Ver políticas de businesses
SELECT 
  policyname,
  cmd,
  roles,
  CASE 
    WHEN with_check IS NOT NULL THEN 'WITH CHECK configurado ✅'
    ELSE 'Sin WITH CHECK ❌'
  END as estado
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'businesses'
ORDER BY cmd;

-- =====================================================
-- PRUEBA
-- =====================================================

-- Probar creación de negocio (reemplaza valores)
/*
INSERT INTO businesses (
  business_name,
  business_type,
  created_by
) VALUES (
  'Mi Negocio Test',
  'Retail',
  auth.uid()
);

-- Si funciona, debería retornar el ID del negocio
-- Si falla, revisar que auth.uid() no sea NULL
*/

-- =====================================================
-- DIAGNÓSTICO ADICIONAL
-- =====================================================

-- Verificar que RLS esté habilitado
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename = 'businesses';

-- Ver TODAS las políticas de businesses
SELECT 
  policyname,
  cmd as operacion,
  permissive,
  roles,
  CASE 
    WHEN qual IS NOT NULL THEN 'Tiene USING ✅'
    ELSE 'Sin USING'
  END as using_clause,
  CASE 
    WHEN with_check IS NOT NULL THEN 'Tiene WITH CHECK ✅'
    ELSE 'Sin WITH CHECK'
  END as check_clause
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'businesses'
ORDER BY cmd, policyname;

-- =====================================================
-- SI AÚN NO FUNCIONA: Verificar auth.uid()
-- =====================================================

-- Ejecutar en Supabase SQL Editor mientras estás logueado:
SELECT 
  auth.uid() as mi_user_id,
  auth.role() as mi_rol,
  CASE 
    WHEN auth.uid() IS NULL THEN '❌ No hay usuario autenticado'
    ELSE '✅ Usuario autenticado correctamente'
  END as estado;

-- =====================================================
-- ALTERNATIVA: Política más permisiva (si es necesario)
-- =====================================================

/*
-- Si la política anterior no funciona, usar esta (más permisiva):
DROP POLICY IF EXISTS "businesses_insert" ON businesses;

CREATE POLICY "businesses_insert"
  ON businesses
  FOR INSERT
  TO authenticated
  WITH CHECK (true); -- Permite cualquier inserción de usuarios autenticados

-- ⚠️ NOTA: Esta política es MUY permisiva. Usar solo temporalmente.
-- Después de verificar que funciona, restaurar la política con created_by check.
*/

-- =====================================================
-- RESUMEN
-- =====================================================
/*
PASOS EJECUTADOS:
1. ✅ Eliminada política INSERT restrictiva
2. ✅ Creada política INSERT correcta (WITH CHECK created_by = auth.uid())
3. ⏳ Probar creación de negocio desde la app

PRÓXIMO PASO:
- Ir a la aplicación
- Intentar crear un negocio
- Si funciona: ✅ Problema resuelto
- Si falla: Ejecutar diagnóstico adicional arriba

CAUSA DEL PROBLEMA:
La política anterior probablemente tenía un USING clause restrictivo
que impedía INSERTs. Las políticas INSERT solo deben usar WITH CHECK,
no USING.

POLÍTICA CORRECTA:
- FOR INSERT solo usa WITH CHECK (no USING)
- Valida que created_by = auth.uid()
- Permite a cualquier usuario autenticado crear su negocio
*/
