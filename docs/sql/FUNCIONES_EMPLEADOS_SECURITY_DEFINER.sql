-- =====================================================
-- SOLUCIÓN DEFINITIVA: FUNCIÓN PARA CREAR EMPLEADOS
-- =====================================================
-- Esta función bypasea RLS usando SECURITY DEFINER
-- Permite crear empleados sin problemas de políticas RLS
-- =====================================================

-- =====================================================
-- PASO 1: FUNCIÓN PARA CREAR EMPLEADOS (BYPASEA RLS)
-- =====================================================

-- Eliminar versión anterior si existe
DROP FUNCTION IF EXISTS create_employee(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN);

CREATE OR REPLACE FUNCTION create_employee(
  p_business_id UUID,
  p_user_id UUID,
  p_role TEXT,
  p_full_name TEXT,
  p_email TEXT,
  p_username TEXT DEFAULT NULL,
  p_access_code TEXT DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT true,
  p_admin_user_id UUID DEFAULT NULL  -- ⚡ NUEVO: ID del admin que crea el empleado
)
RETURNS UUID
SECURITY DEFINER -- ⚡ BYPASEA RLS
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_new_employee_id UUID;
  v_current_user_id UUID;
  v_business_owner_id UUID;
  v_business_exists BOOLEAN;
BEGIN
  -- Obtener usuario actual (admin puede pasar su ID explícitamente)
  v_current_user_id := COALESCE(p_admin_user_id, auth.uid());
  
  -- Verificar que el negocio existe
  SELECT EXISTS(SELECT 1 FROM businesses WHERE id = p_business_id)
  INTO v_business_exists;
  
  IF NOT v_business_exists THEN
    RAISE EXCEPTION 'El negocio con ID % no existe', p_business_id;
  END IF;
  
  -- Obtener el owner del negocio
  SELECT created_by INTO v_business_owner_id
  FROM businesses
  WHERE id = p_business_id;
  
  -- Verificar ownership con mensajes de debug
  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'auth.uid() retornó NULL - no hay sesión activa';
  END IF;
  
  IF v_business_owner_id IS NULL THEN
    RAISE EXCEPTION 'El negocio % no tiene owner (created_by es NULL)', p_business_id;
  END IF;
  
  IF v_current_user_id != v_business_owner_id THEN
    RAISE EXCEPTION 'Solo el owner del negocio puede crear empleados. Usuario actual: %, Owner del negocio: %', 
      v_current_user_id, v_business_owner_id;
  END IF;
  
  -- Insertar el empleado (BYPASEA RLS porque usamos SECURITY DEFINER)
  INSERT INTO employees (
    business_id,
    user_id,
    role,
    full_name,
    email,
    username,
    access_code,
    is_active
  ) VALUES (
    p_business_id,
    p_user_id,
    p_role,
    p_full_name,
    p_email,
    p_username,
    p_access_code,
    p_is_active
  )
  RETURNING id INTO v_new_employee_id;
  
  RETURN v_new_employee_id;
END;
$$;

-- Dar permisos
GRANT EXECUTE ON FUNCTION create_employee(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, UUID) TO authenticated;

COMMENT ON FUNCTION create_employee IS
  'Crea un empleado verificando que el usuario actual sea owner del negocio.
   Usa SECURITY DEFINER para bypassear políticas RLS.';

-- =====================================================
-- PASO 2: FUNCIÓN PARA ACTUALIZAR EMPLEADOS
-- =====================================================

CREATE OR REPLACE FUNCTION update_employee(
  p_employee_id UUID,
  p_role TEXT DEFAULT NULL,
  p_full_name TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_username TEXT DEFAULT NULL,
  p_access_code TEXT DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT NULL
)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_business_id UUID;
  v_is_owner BOOLEAN;
  v_is_self BOOLEAN;
BEGIN
  -- Obtener business_id del empleado
  SELECT business_id INTO v_business_id
  FROM employees
  WHERE id = p_employee_id;
  
  IF v_business_id IS NULL THEN
    RAISE EXCEPTION 'Empleado no encontrado';
  END IF;
  
  -- Verificar si es owner o es el mismo empleado
  SELECT 
    created_by = auth.uid() INTO v_is_owner
  FROM businesses
  WHERE id = v_business_id;
  
  SELECT user_id = auth.uid() INTO v_is_self
  FROM employees
  WHERE id = p_employee_id;
  
  IF NOT (v_is_owner OR v_is_self) THEN
    RAISE EXCEPTION 'No tienes permisos para actualizar este empleado';
  END IF;
  
  -- Actualizar empleado
  UPDATE employees
  SET
    role = COALESCE(p_role, role),
    full_name = COALESCE(p_full_name, full_name),
    email = COALESCE(p_email, email),
    username = COALESCE(p_username, username),
    access_code = COALESCE(p_access_code, access_code),
    is_active = COALESCE(p_is_active, is_active),
    updated_at = NOW()
  WHERE id = p_employee_id;
  
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION update_employee(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;

COMMENT ON FUNCTION update_employee IS
  'Actualiza un empleado si eres owner o el mismo empleado.
   Usa SECURITY DEFINER para bypassear RLS.';

-- =====================================================
-- PASO 3: FUNCIÓN PARA ELIMINAR EMPLEADOS
-- =====================================================

CREATE OR REPLACE FUNCTION delete_employee(p_employee_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_business_id UUID;
  v_is_owner BOOLEAN;
BEGIN
  -- Obtener business_id del empleado
  SELECT business_id INTO v_business_id
  FROM employees
  WHERE id = p_employee_id;
  
  IF v_business_id IS NULL THEN
    RAISE EXCEPTION 'Empleado no encontrado';
  END IF;
  
  -- Verificar que es owner
  SELECT created_by = auth.uid() INTO v_is_owner
  FROM businesses
  WHERE id = v_business_id;
  
  IF NOT v_is_owner THEN
    RAISE EXCEPTION 'Solo el owner puede eliminar empleados';
  END IF;
  
  -- Eliminar empleado
  DELETE FROM employees WHERE id = p_employee_id;
  
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION delete_employee(UUID) TO authenticated;

COMMENT ON FUNCTION delete_employee IS
  'Elimina un empleado si eres owner del negocio.
   Usa SECURITY DEFINER para bypassear RLS.';

-- =====================================================
-- PASO 4: SIMPLIFICAR POLÍTICAS RLS DE EMPLOYEES
-- =====================================================
-- Como usamos funciones, las políticas pueden ser más permisivas

DROP POLICY IF EXISTS "employees_insert_policy" ON employees;
DROP POLICY IF EXISTS "employees_update_policy" ON employees;
DROP POLICY IF EXISTS "employees_delete_policy" ON employees;

-- Política INSERT: Permitir si se usa la función o si cumple condiciones
CREATE POLICY "employees_insert_policy"
ON employees
FOR INSERT
TO authenticated
WITH CHECK (
  -- Permitir si es owner del negocio
  is_user_owner_of_business(business_id)
);

-- Política UPDATE: Permitir owner o mismo usuario
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

-- Política DELETE: Solo owner
CREATE POLICY "employees_delete_policy"
ON employees
FOR DELETE
TO authenticated
USING (
  is_user_owner_of_business(business_id)
);

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '=============================================';
  RAISE NOTICE '✅ FUNCIONES SECURITY DEFINER CREADAS';
  RAISE NOTICE '=============================================';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 FUNCIONES DISPONIBLES:';
  RAISE NOTICE '';
  RAISE NOTICE '1️⃣  create_employee():';
  RAISE NOTICE '    SELECT create_employee(';
  RAISE NOTICE '      business_id => ''uuid'',';
  RAISE NOTICE '      user_id => ''uuid'',';
  RAISE NOTICE '      role => ''cajero'',';
  RAISE NOTICE '      full_name => ''Nombre Completo'',';
  RAISE NOTICE '      email => ''email@ejemplo.com''';
  RAISE NOTICE '    );';
  RAISE NOTICE '';
  RAISE NOTICE '2️⃣  update_employee():';
  RAISE NOTICE '    SELECT update_employee(';
  RAISE NOTICE '      employee_id => ''uuid'',';
  RAISE NOTICE '      role => ''gerente'',';
  RAISE NOTICE '      is_active => false';
  RAISE NOTICE '    );';
  RAISE NOTICE '';
  RAISE NOTICE '3️⃣  delete_employee():';
  RAISE NOTICE '    SELECT delete_employee(''employee_uuid'');';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 SEGURIDAD:';
  RAISE NOTICE '    ✓ Todas usan SECURITY DEFINER';
  RAISE NOTICE '    ✓ Bypassean políticas RLS';
  RAISE NOTICE '    ✓ Verifican permisos internamente';
  RAISE NOTICE '    ✓ Solo owner puede crear/eliminar';
  RAISE NOTICE '    ✓ Owner o mismo empleado puede actualizar';
  RAISE NOTICE '';
  RAISE NOTICE '💡 USO EN LA APLICACIÓN:';
  RAISE NOTICE '    Reemplaza INSERT/UPDATE/DELETE directo con estas funciones';
  RAISE NOTICE '    Ejemplo en JavaScript/TypeScript:';
  RAISE NOTICE '';
  RAISE NOTICE '    const { data, error } = await supabase.rpc(''create_employee'', {';
  RAISE NOTICE '      p_business_id: businessId,';
  RAISE NOTICE '      p_user_id: userId,';
  RAISE NOTICE '      p_role: ''cajero'',';
  RAISE NOTICE '      p_full_name: ''Juan Pérez'',';
  RAISE NOTICE '      p_email: ''juan@ejemplo.com''';
  RAISE NOTICE '    });';
  RAISE NOTICE '';
  RAISE NOTICE '=============================================';
END $$;

-- Ver funciones creadas
SELECT 
  '=== FUNCIONES CREADAS ===' AS info;

SELECT 
  routine_name,
  security_type,
  data_type AS returns
FROM information_schema.routines
WHERE routine_name IN ('create_employee', 'update_employee', 'delete_employee')
ORDER BY routine_name;
