-- =====================================================
-- Enforce business active status in access helper
-- Fecha: 2026-03-14
-- Objetivo:
--   1) Bloquear acceso cuando businesses.is_active = false
--   2) Mantener compatibilidad con helpers usados por RPCs/cron
-- =====================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.can_access_business(p_business_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR p_business_id IS NULL THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.businesses b
    WHERE b.id = p_business_id
      AND b.created_by = v_uid
      AND COALESCE(b.is_active, true) = true
  ) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.employees e
    JOIN public.businesses b ON b.id = e.business_id
    WHERE e.business_id = p_business_id
      AND e.user_id = v_uid
      AND COALESCE(e.is_active, true) = true
      AND COALESCE(b.is_active, true) = true
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.can_access_business(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_business(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_access_business(uuid) TO authenticated;

-- Helper overload used by some RPCs to validate actor explicitly.
CREATE OR REPLACE FUNCTION public.can_access_business(
  p_actor uuid,
  p_business_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_actor IS NULL OR p_business_id IS NULL THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.businesses b
    WHERE b.id = p_business_id
      AND b.created_by = p_actor
      AND COALESCE(b.is_active, true) = true
  ) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.employees e
    JOIN public.businesses b ON b.id = e.business_id
    WHERE e.business_id = p_business_id
      AND e.user_id = p_actor
      AND COALESCE(e.is_active, true) = true
      AND COALESCE(b.is_active, true) = true
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.can_access_business(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_business(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_access_business(uuid, uuid) TO authenticated;

COMMIT;
