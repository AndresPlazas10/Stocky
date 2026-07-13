-- =====================================================
-- ACTUALIZAR resolve_mobile_business_context CON CAMPOS DE PAÍS
-- Fecha: 2026-07-07
-- Objetivo:
--   1) Agregar country_code, timezone, currency a RETURNS TABLE
--   2) Agregar estos campos a todos los SELECT dentro de la función
--   3) Permitir que el frontend cambie idioma según el país del negocio
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
  created_at timestamptz,
  is_active boolean,
  country_code varchar,
  timezone varchar,
  currency varchar
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_user_id uuid := auth.uid();
  v_user_id uuid;
BEGIN
  IF v_auth_user_id IS NULL THEN
    RETURN;
  END IF;

  v_user_id := v_auth_user_id;

  -- 1) Intentar con negocio preferido como owner
  IF p_preferred_business_id IS NOT NULL THEN
    RETURN QUERY
    SELECT
      b.id,
      b.name,
      'owner'::text,
      b.created_at,
      b.is_active,
      b.country_code,
      b.timezone,
      b.currency
    FROM public.businesses b
    WHERE b.id = p_preferred_business_id
      AND b.created_by = v_user_id
    ORDER BY b.created_at DESC NULLS LAST
    LIMIT 1;
    IF FOUND THEN
      RETURN;
    END IF;

    -- 2) Intentar con negocio preferido como empleado
    RETURN QUERY
    SELECT
      b.id,
      b.name,
      'employee'::text,
      COALESCE(e.created_at, b.created_at),
      b.is_active,
      b.country_code,
      b.timezone,
      b.currency
    FROM public.employees e
    JOIN public.businesses b ON b.id = e.business_id
    WHERE e.user_id = v_user_id
      AND COALESCE(e.is_active, true) = true
      AND e.business_id = p_preferred_business_id
    ORDER BY e.created_at DESC NULLS LAST
    LIMIT 1;
    IF FOUND THEN
      RETURN;
    END IF;
  END IF;

  -- 3) Buscar último negocio propio (owner)
  RETURN QUERY
  SELECT
    b.id,
    b.name,
    'owner'::text,
    b.created_at,
    b.is_active,
    b.country_code,
    b.timezone,
    b.currency
  FROM public.businesses b
  WHERE b.created_by = v_user_id
  ORDER BY b.created_at DESC NULLS LAST
  LIMIT 1;
  IF FOUND THEN
    RETURN;
  END IF;

  -- 4) Buscar último negocio como empleado
  RETURN QUERY
  SELECT
    b.id,
    b.name,
    'employee'::text,
    COALESCE(e.created_at, b.created_at),
    b.is_active,
    b.country_code,
    b.timezone,
    b.currency
  FROM public.employees e
  JOIN public.businesses b ON b.id = e.business_id
  WHERE e.user_id = v_user_id
    AND COALESCE(e.is_active, true) = true
  ORDER BY e.created_at DESC NULLS LAST
  LIMIT 1;
END;
$$;

COMMENT ON FUNCTION public.resolve_mobile_business_context(uuid, uuid)
IS 'Returns owner/employee business context for mobile with country_code, timezone, and currency. Treats NULL employee is_active as true.';

REVOKE ALL ON FUNCTION public.resolve_mobile_business_context(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_mobile_business_context(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_mobile_business_context(uuid, uuid) TO service_role;

COMMIT;
