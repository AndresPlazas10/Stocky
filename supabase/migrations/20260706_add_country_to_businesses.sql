-- =====================================================
-- AGREGAR SOPORTE MULTI-PAÍS A TABLA BUSINESSES
-- Fecha: 2026-07-06
-- Objetivo: Permitir configuración por país al registro
-- =====================================================

-- 1) Agregar columnas de configuración de país
ALTER TABLE public.businesses 
ADD COLUMN IF NOT EXISTS country_code VARCHAR(2) DEFAULT 'CO';

ALTER TABLE public.businesses 
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'America/Bogota';

ALTER TABLE public.businesses 
ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'COP';

ALTER TABLE public.businesses 
ADD COLUMN IF NOT EXISTS language VARCHAR(5) DEFAULT 'es';

ALTER TABLE public.businesses 
ADD COLUMN IF NOT EXISTS tax_id_type VARCHAR(20) DEFAULT 'NIT';

ALTER TABLE public.businesses 
ADD COLUMN IF NOT EXISTS tax_rate DECIMAL(5,2) DEFAULT 19.00;

-- 2) Crear índice para búsquedas por país
CREATE INDEX IF NOT EXISTS idx_businesses_country_code 
ON public.businesses (country_code);

-- 3) Comentarios en columnas
COMMENT ON COLUMN public.businesses.country_code IS 'Código ISO del país (CO, MX, US, etc.)';
COMMENT ON COLUMN public.businesses.timezone IS 'Zona horaria del negocio';
COMMENT ON COLUMN public.businesses.currency IS 'Código de moneda ISO (COP, MXN, USD)';
COMMENT ON COLUMN public.businesses.language IS 'Idioma de la interfaz (es, en)';
COMMENT ON COLUMN public.businesses.tax_id_type IS 'Tipo de identificación fiscal (NIT, RFC, EIN)';
COMMENT ON COLUMN public.businesses.tax_rate IS 'Tasa de impuesto por defecto';

-- 4) Actualizar RPC create_business_for_current_user
DROP FUNCTION IF EXISTS public.create_business_for_current_user(text, text, text, text, text, text);

CREATE FUNCTION public.create_business_for_current_user(
  p_name text,
  p_nit text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_username text DEFAULT NULL,
  p_country_code text DEFAULT 'CO'
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

REVOKE ALL ON FUNCTION public.create_business_for_current_user(text, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_business_for_current_user(text, text, text, text, text, text, text) TO authenticated;

-- =====================================================
-- Fin
-- =====================================================
