-- =====================================================
-- Fix acceso realtime en producción (empleados históricos)
-- Fecha: 2026-02-26
-- Objetivo:
--   1) Evitar falsos negativos cuando employees.is_active es NULL
--   2) Backfill defensivo de registros antiguos con is_active NULL
-- =====================================================

BEGIN;

-- Normalizar datos históricos para evitar diferencias entre entornos.
UPDATE public.employees
SET is_active = true
WHERE is_active IS NULL;

-- Reafirmar helper compartido por políticas RLS/realtime.
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
  ) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.business_id = p_business_id
      AND e.user_id = v_uid
      AND COALESCE(e.is_active, true) = true
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.can_access_business(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_business(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_access_business(uuid) TO authenticated;

COMMIT;
