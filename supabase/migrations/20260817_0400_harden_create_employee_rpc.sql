-- ============================================================
-- HARDENING SEGURIDAD FASE 1 - Fix create_employee (escalada)
-- Fecha: 2026-08-17
-- Objetivo: cerrar la escalada de privilegios cross-tenant.
-- La versión anterior tenía una "rama transitoria" que aceptaba
-- p_admin_user_id controlado por el cliente: cualquier usuario
-- autenticado podía añadirse como empleado (incluso owner) de un
-- negocio ajeno si conocía el UUID de un admin real.
--
-- El flujo legítimo (web y móvil) usa isolatedAuthClient con
-- persistSession=false y llama a la RPC con la sesión del admin
-- (p_admin_user_id = adminSession.user.id = auth.uid()), por lo que
-- la rama transitoria NUNCA se ejecuta en el flujo real: se elimina.
-- Además se restringe p_role a roles operativos (nunca owner/admin).
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1) can_manage_business_employees: cerrar el oráculo.
--    La versión anterior aceptaba p_actor_user_id arbitrario y
--    devolvía si ESE usuario (no el caller) es admin del negocio.
--    Ahora ignora el parámetro y usa SIEMPRE auth.uid() del caller.
--    Se conserva la firma (uuid, uuid) para no romper llamadas.
-- ------------------------------------------------------------
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
  v_uid uuid := auth.uid();
BEGIN
  IF p_business_id IS NULL OR v_uid IS NULL THEN
    RETURN false;
  END IF;

  -- Owner del negocio (SIEMPRE el caller autenticado)
  IF EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = p_business_id
      AND b.created_by = v_uid
  ) THEN
    RETURN true;
  END IF;

  -- Admin/Owner activo como empleado (SIEMPRE el caller autenticado)
  SELECT lower(coalesce(e.role, '')) INTO v_role
  FROM public.employees e
  WHERE e.business_id = p_business_id
    AND e.user_id = v_uid
    AND e.is_active = true
  LIMIT 1;

  IF v_role IN ('admin', 'owner', 'administrador', 'propietario')
     OR position('admin' in coalesce(v_role, '')) > 0 THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

COMMENT ON FUNCTION public.can_manage_business_employees(uuid,uuid)
IS 'Valida si el usuario AUTENTICADO (auth.uid()) puede administrar empleados de un negocio (owner/admin activo). El parámetro p_actor_user_id se ignora: siempre usa auth.uid() para evitar oráculos de membresía.';

REVOKE ALL ON FUNCTION public.can_manage_business_employees(uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_business_employees(uuid,uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_manage_business_employees(uuid,uuid) TO authenticated;

-- ------------------------------------------------------------
-- 2) create_employee: sin rama transitoria + roles restringidos.
-- ------------------------------------------------------------
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
  v_role_norm text;
BEGIN
  IF p_business_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_business_id y p_user_id son obligatorios';
  END IF;

  IF v_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'Sesión inválida: auth.uid() es NULL';
  END IF;

  -- SOLO el actor autenticado (auth.uid()) puede crear empleados si es
  -- owner/admin del negocio. El parámetro p_admin_user_id se ignora:
  -- nunca se confía en un UUID enviado por el cliente para autorizar.
  IF NOT public.can_manage_business_employees(p_business_id, v_actor_user_id) THEN
    RAISE EXCEPTION 'No autorizado para crear empleados en este negocio';
  END IF;

  -- Restringir el rol en el servidor: solo roles operativos. Nunca se
  -- puede auto-asignar owner/admin/administrador/propietario.
  v_role_norm := lower(trim(coalesce(p_role, '')));
  IF v_role_norm NOT IN ('employee', 'kitchen', 'cocina', 'mesero', 'cajero') THEN
    RAISE EXCEPTION 'Rol no permitido: solo se pueden asignar roles operativos';
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
    v_role_norm,
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

COMMENT ON FUNCTION public.create_employee(uuid,uuid,text,text,text,text,text,boolean,uuid)
IS 'Crea/actualiza empleado. Autoriza con can_manage_business_employees usando SIEMPRE auth.uid() del caller (sin flujo transitorio ni p_admin_user_id confiable). Solo asigna roles operativos (employee, kitchen, cocina, mesero, cajero).';

REVOKE ALL ON FUNCTION public.create_employee(uuid,uuid,text,text,text,text,text,boolean,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_employee(uuid,uuid,text,text,text,text,text,boolean,uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_employee(uuid,uuid,text,text,text,text,text,boolean,uuid) TO authenticated;

COMMIT;
