-- =====================================================
-- FIX: businesses.created_at obligatorio en creacion
-- Fecha: 2026-02-26
-- Objetivo:
--  1) Garantizar default y NOT NULL en businesses.created_at
--  2) Backfill de registros con created_at en NULL
--  3) Reforzar RPC create_business_for_current_user
-- =====================================================

-- -----------------------------------------------------
-- 1) Garantizar columna created_at consistente
-- -----------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'businesses'
      AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.businesses
      ALTER COLUMN created_at SET DEFAULT timezone('utc', now());

    UPDATE public.businesses
    SET created_at = timezone('utc', now())
    WHERE created_at IS NULL;

    ALTER TABLE public.businesses
      ALTER COLUMN created_at SET NOT NULL;
  END IF;
END
$$;

-- -----------------------------------------------------
-- 2) RPC de creacion de negocio robusto
-- -----------------------------------------------------
DROP FUNCTION IF EXISTS public.create_business_for_current_user(text, text, text, text, text, text);

CREATE FUNCTION public.create_business_for_current_user(
  p_name text,
  p_nit text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_username text DEFAULT NULL
)
RETURNS public.businesses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_business public.businesses%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No authenticated user';
  END IF;

  IF COALESCE(trim(p_name), '') = '' THEN
    RAISE EXCEPTION 'Business name is required';
  END IF;

  INSERT INTO public.businesses (
    name,
    nit,
    address,
    phone,
    email,
    username,
    created_by,
    created_at
  )
  VALUES (
    trim(p_name),
    NULLIF(trim(COALESCE(p_nit, '')), ''),
    NULLIF(trim(COALESCE(p_address, '')), ''),
    NULLIF(trim(COALESCE(p_phone, '')), ''),
    NULLIF(lower(trim(COALESCE(p_email, ''))), ''),
    NULLIF(lower(trim(COALESCE(p_username, ''))), ''),
    v_uid,
    timezone('utc', now())
  )
  RETURNING * INTO v_business;

  RETURN v_business;
END;
$$;

REVOKE ALL ON FUNCTION public.create_business_for_current_user(text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_business_for_current_user(text, text, text, text, text, text) TO authenticated;

-- =====================================================
-- Fin
-- =====================================================
