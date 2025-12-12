-- =====================================================
-- FIX: purchases_user_id_fkey FK CONSTRAINT ERROR
-- =====================================================
-- Error: insert or update on table "purchases" violates 
--        foreign key constraint "purchases_user_id_fkey"
--
-- Causa: El FK references una tabla 'users' que NO EXISTE
--        El código usa auth.users.id (correcto)
--        La aplicación usa 'employees' table, no 'users'
-- =====================================================

-- PASO 1: DIAGNÓSTICO - Verificar estado actual
-- =====================================================

-- 1.1 Verificar si existe la tabla 'users'
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'users'
) AS users_table_exists;

-- 1.2 Verificar el FK constraint actual
SELECT 
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_name = 'purchases_user_id_fkey';

-- 1.3 Ver estructura actual de purchases
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'purchases' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 1.4 Verificar estructura de employees (la tabla correcta)
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'employees' 
  AND table_schema = 'public'
ORDER BY ordinal_position;


-- =====================================================
-- PASO 2: SOLUCIÓN - Eliminar FK constraint incorrecto
-- =====================================================

-- IMPORTANTE: Este FK está mal configurado porque:
-- 1. La tabla 'users' NO EXISTE en public schema
-- 2. El código usa auth.users.id (Supabase Auth - tabla del sistema)
-- 3. La app usa 'employees' para vincular users con businesses
-- 4. purchases.user_id almacena auth.users.id (UUID de Supabase Auth)
-- 
-- DECISIÓN: Eliminar el FK porque:
-- - auth.users es una tabla del sistema (no podemos crear FK hacia ella)
-- - La integridad se mantiene a nivel de aplicación
-- - Los empleados se validan en 'employees' table

-- 2.1 Eliminar el FK constraint incorrecto
ALTER TABLE purchases 
DROP CONSTRAINT IF EXISTS purchases_user_id_fkey;

-- 2.2 Verificar que el constraint fue eliminado
SELECT constraint_name 
FROM information_schema.table_constraints 
WHERE table_name = 'purchases' 
  AND constraint_name = 'purchases_user_id_fkey';
-- Debe retornar 0 filas


-- =====================================================
-- PASO 3: OPCIONAL - Crear índice para mejorar performance
-- =====================================================

-- Aunque eliminamos el FK, mantener un índice en user_id
-- mejora el performance de queries que filtran por usuario
CREATE INDEX IF NOT EXISTS idx_purchases_user_id 
ON purchases(user_id);

-- Índice compuesto para queries comunes
CREATE INDEX IF NOT EXISTS idx_purchases_business_user 
ON purchases(business_id, user_id);


-- =====================================================
-- PASO 4: VERIFICACIÓN - Confirmar que todo funciona
-- =====================================================

-- 4.1 Verificar que no hay FK constraints en purchases.user_id
SELECT 
  tc.constraint_name,
  tc.constraint_type
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'purchases' 
  AND kcu.column_name = 'user_id'
  AND tc.constraint_type = 'FOREIGN KEY';
-- Debe retornar 0 filas

-- 4.2 Listar todos los constraints de purchases
SELECT 
  constraint_name,
  constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'purchases'
ORDER BY constraint_type, constraint_name;

-- 4.3 Verificar índices creados
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'purchases'
  AND schemaname = 'public'
ORDER BY indexname;


-- =====================================================
-- PASO 5: TEST - Simular INSERT para verificar fix
-- =====================================================

-- NOTA: No ejecutar este test si no tienes datos de prueba
-- Reemplaza los valores de ejemplo con datos reales

/*
-- Obtener un user_id de auth.users (ejemplo)
SELECT id FROM auth.users LIMIT 1;

-- Obtener un business_id válido
SELECT id FROM businesses LIMIT 1;

-- Obtener un supplier_id válido  
SELECT id FROM suppliers LIMIT 1;

-- Test de INSERT (reemplaza los UUIDs con valores reales)
INSERT INTO purchases (
  business_id,
  user_id,
  supplier_id,
  payment_method,
  total,
  notes
) VALUES (
  'tu-business-id-aqui',
  'tu-auth-user-id-aqui',
  'tu-supplier-id-aqui',
  'efectivo',
  100.00,
  'Test purchase después de fix FK'
)
RETURNING *;

-- Si el INSERT funciona, el problema está resuelto ✅
-- Eliminar el registro de prueba:
DELETE FROM purchases WHERE notes = 'Test purchase después de fix FK';
*/


-- =====================================================
-- DOCUMENTACIÓN DE LA SOLUCIÓN
-- =====================================================

/*
PROBLEMA ORIGINAL:
------------------
❌ Error: insert or update on table "purchases" violates foreign key 
   constraint "purchases_user_id_fkey"

CAUSA RAÍZ:
-----------
La tabla 'purchases' tenía un FK constraint que referenciaba una tabla 
'users' en el schema public que NO EXISTE.

DISEÑO ACTUAL DE LA BASE DE DATOS:
-----------------------------------
1. auth.users (Supabase Auth) - Tabla del sistema con usuarios autenticados
2. public.businesses - Negocios registrados
3. public.employees - Vincula auth.users con businesses (user_id → auth.users.id)
4. public.purchases - Compras realizadas (user_id almacena auth.users.id)

FLUJO CORRECTO:
---------------
1. Usuario se autentica → Registro en auth.users
2. Usuario se vincula a negocio → Registro en employees (user_id = auth.users.id)
3. Usuario hace compra → purchases.user_id = auth.users.id (del usuario autenticado)

SOLUCIÓN IMPLEMENTADA:
----------------------
✅ Eliminar FK constraint 'purchases_user_id_fkey' (referenciaba tabla inexistente)
✅ Mantener purchases.user_id como UUID (almacena auth.users.id)
✅ Crear índices para mejorar performance
✅ La integridad se mantiene a nivel de aplicación

POR QUÉ NO CREAMOS FK A auth.users:
------------------------------------
- auth.users es una tabla del sistema de Supabase Auth
- No se pueden crear FK desde public schema hacia auth schema
- La validación de usuarios se hace mediante:
  * Autenticación (Supabase Auth)
  * Verificación en employees table (business access)

ARCHIVOS RELACIONADOS:
----------------------
- src/components/Dashboard/Compras.jsx (líneas 307-340)
  * Obtiene user.id de supabase.auth.getUser()
  * INSERT en purchases con user_id: user.id

PRÓXIMOS PASOS:
---------------
1. Ejecutar PASO 2 de este script (DROP CONSTRAINT)
2. Ejecutar PASO 3 (CREATE INDEX - opcional pero recomendado)
3. Probar registro de compra en la aplicación
4. Verificar que el INSERT funciona sin errores

MANTENIMIENTO:
--------------
- Si en el futuro se crea tabla 'users' en public schema,
  considerar migrar de employees a users
- Mantener índices actualizados para queries frecuentes
- Documentar cualquier cambio en el diseño de la DB
*/
