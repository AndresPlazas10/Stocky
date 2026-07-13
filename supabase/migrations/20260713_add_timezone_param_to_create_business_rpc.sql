-- =====================================================
-- AGREGAR PARÁMETRO p_timezone AL RPC create_business_for_current_user
-- Fecha: 2026-07-13
-- Objetivo: Permitir que el frontend envíe una zona horaria
--           específica (ej: para países con múltiples zonas como US)
-- =====================================================

DROP FUNCTION IF EXISTS public.create_business_for_current_user(text, text, text, text, text, text, text);

CREATE FUNCTION public.create_business_for_current_user(
  p_name text,
  p_nit text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_username text DEFAULT NULL,
  p_country_code text DEFAULT 'CO',
  p_timezone text DEFAULT NULL
)
RETURNS public.businesses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_business public.businesses%ROWTYPE;
  v_timezone text;
  v_currency text;
  v_language text;
  v_tax_id_type text;
  v_tax_rate decimal;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No authenticated user';
  END IF;

  IF COALESCE(trim(p_name), '') = '' THEN
    RAISE EXCEPTION 'Business name is required';
  END IF;

  -- Configuración por país
  CASE p_country_code
    WHEN 'CO' THEN
      v_timezone := 'America/Bogota';
      v_currency := 'COP';
      v_language := 'es';
      v_tax_id_type := 'NIT';
      v_tax_rate := 19.00;
    WHEN 'EC' THEN
      v_timezone := 'America/Guayaquil';
      v_currency := 'USD';
      v_language := 'es';
      v_tax_id_type := 'RUC';
      v_tax_rate := 15.00;
    WHEN 'PE' THEN
      v_timezone := 'America/Lima';
      v_currency := 'PEN';
      v_language := 'es';
      v_tax_id_type := 'RUC';
      v_tax_rate := 18.00;
    WHEN 'MX' THEN
      v_timezone := 'America/Mexico_City';
      v_currency := 'MXN';
      v_language := 'es';
      v_tax_id_type := 'RFC';
      v_tax_rate := 16.00;
    WHEN 'AR' THEN
      v_timezone := 'America/Argentina/Buenos_Aires';
      v_currency := 'ARS';
      v_language := 'es';
      v_tax_id_type := 'CUIT';
      v_tax_rate := 21.00;
    WHEN 'US' THEN
      v_timezone := 'America/New_York';
      v_currency := 'USD';
      v_language := 'en';
      v_tax_id_type := 'EIN';
      v_tax_rate := 0.00;
    ELSE
      v_timezone := 'America/Bogota';
      v_currency := 'COP';
      v_language := 'es';
      v_tax_id_type := 'NIT';
      v_tax_rate := 19.00;
  END CASE;

  -- Si el frontend envió una zona horaria explícita, usarla
  IF p_timezone IS NOT NULL AND trim(p_timezone) <> '' THEN
    v_timezone := trim(p_timezone);
  END IF;

  INSERT INTO public.businesses (
    name,
    nit,
    address,
    phone,
    email,
    username,
    created_by,
    created_at,
    country_code,
    timezone,
    currency,
    language,
    tax_id_type,
    tax_rate
  )
  VALUES (
    trim(p_name),
    NULLIF(trim(COALESCE(p_nit, '')), ''),
    NULLIF(trim(COALESCE(p_address, '')), ''),
    NULLIF(trim(COALESCE(p_phone, '')), ''),
    NULLIF(lower(trim(COALESCE(p_email, ''))), ''),
    NULLIF(lower(trim(COALESCE(p_username, ''))), ''),
    v_uid,
    timezone('utc', now()),
    p_country_code,
    v_timezone,
    v_currency,
    v_language,
    v_tax_id_type,
    v_tax_rate
  )
  RETURNING * INTO v_business;

  RETURN v_business;
END;
$$;

REVOKE ALL ON FUNCTION public.create_business_for_current_user(text, text, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_business_for_current_user(text, text, text, text, text, text, text, text) TO authenticated;

-- =====================================================
-- Fin
-- =====================================================
