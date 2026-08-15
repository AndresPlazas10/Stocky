-- =====================================================
-- AÑADIR ROLE AL CONTEXTO MOBILE (resolve_mobile_business_context)
-- Fecha: 2026-08-13
-- Objetivo: exponer el rol del empleado (employees.role)
-- para que la app mobile pueda limitar la navegación
-- del rol cocina (solo sección de mesas).
-- =====================================================

BEGIN;

DROP FUNCTION IF EXISTS public.resolve_mobile_business_context(uuid, uuid);

CREATE OR REPLACE FUNCTION public.resolve_mobile_business_context(
  p_user_id uuid,
  p_preferred_business_id uuid DEFAULT NULL
)
RETURNS TABLE(
  business_id uuid,
  business_name text,
  source text,
  role text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_user_id uuid;
BEGIN
  v_auth_user_id := auth.uid();

  IF v_auth_user_id IS NULL OR v_auth_user_id IS DISTINCT FROM p_user_id THEN
    RETURN;
  END IF;

  IF p_preferred_business_id IS NOT NULL THEN
    RETURN QUERY
    SELECT
      b.id,
      b.name,
      'owner'::text,
      'owner'::text,
      b.created_at
    FROM public.businesses b
    WHERE b.id = p_preferred_business_id
      AND b.created_by = p_user_id
    ORDER BY b.created_at DESC NULLS LAST
    LIMIT 1;
    IF FOUND THEN
      RETURN;
    END IF;

    RETURN QUERY
    SELECT
      b.id,
      b.name,
      'employee'::text,
      COALESCE(lower(e.role::text), 'employee'),
      COALESCE(e.created_at, b.created_at)
    FROM public.employees e
    JOIN public.businesses b ON b.id = e.business_id
    WHERE e.user_id = p_user_id
      AND e.is_active = true
      AND e.business_id = p_preferred_business_id
    ORDER BY e.created_at DESC NULLS LAST
    LIMIT 1;
    IF FOUND THEN
      RETURN;
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    b.id,
    b.name,
    'owner'::text,
    'owner'::text,
    b.created_at
  FROM public.businesses b
  WHERE b.created_by = p_user_id
  ORDER BY b.created_at DESC NULLS LAST
  LIMIT 1;
  IF FOUND THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    b.id,
    b.name,
    'employee'::text,
    COALESCE(lower(e.role::text), 'employee'),
    COALESCE(e.created_at, b.created_at)
  FROM public.employees e
  JOIN public.businesses b ON b.id = e.business_id
  WHERE e.user_id = p_user_id
    AND e.is_active = true
  ORDER BY e.created_at DESC NULLS LAST
  LIMIT 1;
END;
$$;

COMMENT ON FUNCTION public.resolve_mobile_business_context(uuid, uuid)
IS 'Returns owner/employee business context for mobile with the employee role (employees.role) in a single query with auth guard.';

REVOKE ALL ON FUNCTION public.resolve_mobile_business_context(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_mobile_business_context(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_mobile_business_context(uuid, uuid) TO service_role;

COMMIT;
