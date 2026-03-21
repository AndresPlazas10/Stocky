-- =====================================================
-- Fix resolve_mobile_business_context auth guard
-- Fecha: 2026-03-16
-- Objetivo:
--   1) Evitar falsos negativos cuando p_user_id no coincide
--   2) Usar auth.uid() como fuente de verdad
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
  is_active boolean
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

  -- Fuente de verdad: auth.uid().
  v_user_id := v_auth_user_id;

  IF p_preferred_business_id IS NOT NULL THEN
    RETURN QUERY
    SELECT
      b.id,
      b.name,
      'owner'::text,
      b.created_at,
      b.is_active
    FROM public.businesses b
    WHERE b.id = p_preferred_business_id
      AND b.created_by = v_user_id
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
      COALESCE(e.created_at, b.created_at),
      b.is_active
    FROM public.employees e
    JOIN public.businesses b ON b.id = e.business_id
    WHERE e.user_id = v_user_id
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
    b.created_at,
    b.is_active
  FROM public.businesses b
  WHERE b.created_by = v_user_id
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
    COALESCE(e.created_at, b.created_at),
    b.is_active
  FROM public.employees e
  JOIN public.businesses b ON b.id = e.business_id
  WHERE e.user_id = v_user_id
    AND e.is_active = true
  ORDER BY e.created_at DESC NULLS LAST
  LIMIT 1;
END;
$$;

COMMENT ON FUNCTION public.resolve_mobile_business_context(uuid, uuid)
IS 'Returns owner/employee business context for mobile using auth.uid() as source of truth.';

REVOKE ALL ON FUNCTION public.resolve_mobile_business_context(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_mobile_business_context(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_mobile_business_context(uuid, uuid) TO service_role;

COMMIT;
