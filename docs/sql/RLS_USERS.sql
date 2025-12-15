-- =====================================================
-- POLÍTICAS RLS - TABLA USERS
-- =====================================================
-- Políticas de seguridad a nivel de fila para users
-- Los usuarios son perfiles personales vinculados a auth.users
-- Cada usuario solo puede ver/modificar su propio perfil
-- =====================================================

-- =====================================================
-- LIMPIAR POLÍTICAS EXISTENTES
-- =====================================================

DROP POLICY IF EXISTS "users_select_policy" ON users;
DROP POLICY IF EXISTS "users_insert_policy" ON users;
DROP POLICY IF EXISTS "users_update_policy" ON users;
DROP POLICY IF EXISTS "users_delete_policy" ON users;

-- =====================================================
-- ASEGURAR QUE RLS ESTÁ HABILITADO
-- =====================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- POLÍTICA 1: SELECT (Ver/Leer perfil de usuario)
-- =====================================================
-- Cada usuario solo puede ver su propio perfil

CREATE POLICY "users_select_policy"
ON users
FOR SELECT
TO authenticated
USING (
  -- Solo puedes ver tu propio perfil
  id = auth.uid()
);

COMMENT ON POLICY "users_select_policy" ON users IS
  'Permite ver solo tu propio perfil de usuario';

-- =====================================================
-- POLÍTICA 2: INSERT (Crear perfil de usuario)
-- =====================================================
-- Solo puedes crear tu propio perfil

CREATE POLICY "users_insert_policy"
ON users
FOR INSERT
TO authenticated
WITH CHECK (
  -- Solo puedes crear tu propio perfil
  id = auth.uid()
);

COMMENT ON POLICY "users_insert_policy" ON users IS
  'Permite crear solo tu propio perfil (id debe coincidir con auth.uid())';

-- =====================================================
-- POLÍTICA 3: UPDATE (Actualizar perfil de usuario)
-- =====================================================
-- Solo puedes actualizar tu propio perfil
-- No puedes cambiar el id

CREATE POLICY "users_update_policy"
ON users
FOR UPDATE
TO authenticated
USING (
  -- Solo puedes actualizar tu propio perfil
  id = auth.uid()
)
WITH CHECK (
  -- No puedes cambiar tu id a otro usuario
  id = auth.uid()
);

COMMENT ON POLICY "users_update_policy" ON users IS
  'Permite actualizar solo tu propio perfil, sin cambiar el id';

-- =====================================================
-- POLÍTICA 4: DELETE (Eliminar perfil de usuario)
-- =====================================================
-- Solo puedes eliminar tu propio perfil

CREATE POLICY "users_delete_policy"
ON users
FOR DELETE
TO authenticated
USING (
  -- Solo puedes eliminar tu propio perfil
  id = auth.uid()
);

COMMENT ON POLICY "users_delete_policy" ON users IS
  'Permite eliminar solo tu propio perfil de usuario';

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '=============================================';
  RAISE NOTICE '✅ POLÍTICAS RLS CREADAS - USERS';
  RAISE NOTICE '=============================================';
  RAISE NOTICE '';
  RAISE NOTICE '📋 POLÍTICAS ACTIVAS:';
  RAISE NOTICE '';
  RAISE NOTICE '1️⃣  SELECT (Ver perfil):';
  RAISE NOTICE '    ✓ Solo TU propio perfil';
  RAISE NOTICE '    ✓ Basado en id = auth.uid()';
  RAISE NOTICE '';
  RAISE NOTICE '2️⃣  INSERT (Crear perfil):';
  RAISE NOTICE '    ✓ Solo TU propio perfil';
  RAISE NOTICE '    ✓ id debe coincidir con auth.uid()';
  RAISE NOTICE '';
  RAISE NOTICE '3️⃣  UPDATE (Actualizar perfil):';
  RAISE NOTICE '    ✓ Solo TU propio perfil';
  RAISE NOTICE '    ✓ No puedes cambiar id';
  RAISE NOTICE '    ✓ Puedes actualizar nombre, email, etc.';
  RAISE NOTICE '';
  RAISE NOTICE '4️⃣  DELETE (Eliminar perfil):';
  RAISE NOTICE '    ✓ Solo TU propio perfil';
  RAISE NOTICE '    ✓ Aislamiento individual por usuario';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 SEGURIDAD:';
  RAISE NOTICE '    ✓ RLS habilitado en users';
  RAISE NOTICE '    ✓ Usa auth.uid() directamente';
  RAISE NOTICE '    ✓ Aislamiento por usuario (NO por business_id)';
  RAISE NOTICE '';
  RAISE NOTICE '💡 RECORDATORIO:';
  RAISE NOTICE '    Los usuarios están relacionados con:';
  RAISE NOTICE '    - businesses (a través de created_by)';
  RAISE NOTICE '    - employees (a través de user_id)';
  RAISE NOTICE '    - Campos típicos: id, email, full_name, avatar_url';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  IMPORTANTE:';
  RAISE NOTICE '    Esta tabla NO usa business_id';
  RAISE NOTICE '    Cada usuario solo ve/modifica su propio registro';
  RAISE NOTICE '';
  RAISE NOTICE '=============================================';
END $$;

-- =====================================================
-- QUERY DE VERIFICACIÓN
-- =====================================================

SELECT 
  '=== POLÍTICAS RLS EN USERS ===' AS info;

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
  AND tablename = 'users'
ORDER BY cmd, policyname;
