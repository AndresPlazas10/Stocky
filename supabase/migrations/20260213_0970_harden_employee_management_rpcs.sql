-- ============================================================
-- BLOCK 5 - Hardening RPCs de gestión de empleados
-- Fecha: 2026-02-13
-- Objetivo: versionar y asegurar create/delete de empleados,
-- eliminando dependencia operativa de delete_auth_user.
-- ============================================================

CREATE OR REPLACE FUNCTION public.can_manage_business_employees(
  p_business_id uuid,
  p_actor_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  IF p_business_id IS NULL OR p_actor_user_id IS NULL THEN
    RETURN false;
  END IF;

  -- Owner del negocio
  IF EXISTS (
    SELECT 1
    FROM public.businesses b
    WHERE b.id = p_business_id
      AND b.created_by = p_actor_user_id
  ) THEN
    RETURN true;
  END IF;

  -- Admin/Owner activo como empleado
  SELECT lower(coalesce(e.role, ''))
  INTO v_role
  FROM public.employees e
  WHERE e.business_id = p_business_id
    AND e.user_id = p_actor_user_id
    AND e.is_active = true
  LIMIT 1;

  IF v_role IN ('admin', 'owner', 'administrador', 'propietario')
     OR position('admin' in coalesce(v_role, '')) > 0 THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.can_manage_business_employees(uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_business_employees(uuid,uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_manage_business_employees(uuid,uuid) TO authenticated;

COMMENT ON FUNCTION public.can_manage_business_employees(uuid,uuid)
IS 'Valida si un usuario puede administrar empleados de un negocio (owner/admin activo).';

CREATE OR REPLACE FUNCTION public.create_employee(
  p_business_id uuid,
  p_user_id uuid,
  p_role text,
  p_full_name text,
  p_email text,
  p_username text DEFAULT NULL,
  p_access_code text DEFAULT NULL,
  p_is_active boolean DEFAULT true,
  p_admin_user_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_user_id uuid := auth.uid();
  v_new_employee_id uuid;
BEGIN
  IF p_business_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_business_id y p_user_id son obligatorios';
  END IF;

  IF v_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'Sesión inválida: auth.uid() es NULL';
  END IF;

  -- Flujo normal: actor autenticado administra empleados directamente.
  IF p_admin_user_id IS NULL OR p_admin_user_id = v_actor_user_id THEN
    IF NOT public.can_manage_business_employees(p_business_id, v_actor_user_id) THEN
      RAISE EXCEPTION 'No autorizado para crear empleados en este negocio';
    END IF;
  ELSE
    -- Flujo transitorio: el cliente cambió de sesión al crear auth user.
    -- Solo permitir si el actor actual es el user recién creado y el admin indicado tiene permisos.
    IF v_actor_user_id <> p_user_id THEN
      RAISE EXCEPTION 'No autorizado para suplantar administrador';
    END IF;

    IF NOT public.can_manage_business_employees(p_business_id, p_admin_user_id) THEN
      RAISE EXCEPTION 'No autorizado: administrador inválido para este negocio';
    END IF;
  END IF;

  INSERT INTO public.employees (
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
    coalesce(nullif(trim(p_role), ''), 'employee'),
    p_full_name,
    p_email,
    p_username,
    p_access_code,
    coalesce(p_is_active, true)
  )
  ON CONFLICT (business_id, user_id)
  DO UPDATE SET
    role = excluded.role,
    full_name = excluded.full_name,
    email = excluded.email,
    username = excluded.username,
    access_code = excluded.access_code,
    is_active = excluded.is_active,
    updated_at = now()
  RETURNING id INTO v_new_employee_id;

  RETURN v_new_employee_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_employee(uuid,uuid,text,text,text,text,text,boolean,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_employee(uuid,uuid,text,text,text,text,text,boolean,uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_employee(uuid,uuid,text,text,text,text,text,boolean,uuid) TO authenticated;

COMMENT ON FUNCTION public.create_employee(uuid,uuid,text,text,text,text,text,boolean,uuid)
IS 'Crea/actualiza empleado validando permisos de owner/admin. Soporta flujo transitorio con p_admin_user_id.';

CREATE OR REPLACE FUNCTION public.delete_employee(
  p_employee_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_user_id uuid := auth.uid();
  v_business_id uuid;
  v_target_user_id uuid;
BEGIN
  IF p_employee_id IS NULL THEN
    RAISE EXCEPTION 'p_employee_id es obligatorio';
  END IF;

  IF v_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'Sesión inválida: auth.uid() es NULL';
  END IF;

  SELECT e.business_id, e.user_id
  INTO v_business_id, v_target_user_id
  FROM public.employees e
  WHERE e.id = p_employee_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Empleado no encontrado';
  END IF;

  IF NOT public.can_manage_business_employees(v_business_id, v_actor_user_id) THEN
    RAISE EXCEPTION 'No autorizado para eliminar empleados en este negocio';
  END IF;

  -- Evitar auto eliminación accidental del actor administrador.
  IF v_target_user_id = v_actor_user_id THEN
    RAISE EXCEPTION 'No puedes eliminar tu propio usuario desde este flujo';
  END IF;

  DELETE FROM public.employees
  WHERE id = p_employee_id
    AND business_id = v_business_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_employee(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_employee(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_employee(uuid) TO authenticated;

COMMENT ON FUNCTION public.delete_employee(uuid)
IS 'Elimina empleado validando permisos owner/admin del negocio.';

-- Compatibilidad: función legacy, ahora segura y no destructiva para auth.users.
CREATE OR REPLACE FUNCTION public.delete_auth_user(
  user_id_to_delete uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Deprecated: la eliminación real en auth.users requiere backend con service role.
  -- Se mantiene para no romper clientes legacy.
  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_auth_user(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_auth_user(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_auth_user(uuid) TO authenticated;

COMMENT ON FUNCTION public.delete_auth_user(uuid)
IS 'DEPRECATED: no elimina auth.users. Mantener compatibilidad legacy; usar backend seguro si se requiere baja en Auth.';
