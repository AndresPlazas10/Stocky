-- ============================================================
-- BLOCK 11 - Creación atómica de productos con código secuencial
-- Fecha: 2026-02-13
-- Objetivo: evitar colisiones de code (PRD-####) por concurrencia
-- ============================================================

-- Asegurar unicidad por negocio (no global)
ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_code_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_business_code_unique
  ON public.products (business_id, UPPER(code))
  WHERE code IS NOT NULL;

CREATE OR REPLACE FUNCTION public.create_product_with_generated_code(
  p_business_id uuid,
  p_name text,
  p_category text,
  p_purchase_price numeric DEFAULT 0,
  p_sale_price numeric DEFAULT 0,
  p_stock integer DEFAULT 0,
  p_min_stock integer DEFAULT 5,
  p_unit text DEFAULT 'unit',
  p_supplier_id uuid DEFAULT NULL,
  p_is_active boolean DEFAULT true
)
RETURNS TABLE (
  id uuid,
  code text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_next_number integer;
  v_code text;
  v_product_id uuid;
  v_has_access boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sesión inválida: auth.uid() es NULL';
  END IF;

  IF p_business_id IS NULL THEN
    RAISE EXCEPTION 'p_business_id es obligatorio';
  END IF;

  -- Validación de acceso sin depender de can_access_business (compatibilidad entre entornos)
  SELECT EXISTS (
    SELECT 1
    FROM public.businesses b
    WHERE b.id = p_business_id
      AND b.created_by = v_uid
  ) OR EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.business_id = p_business_id
      AND e.user_id = v_uid
      AND e.is_active = true
  )
  INTO v_has_access;

  IF NOT v_has_access THEN
    RAISE EXCEPTION 'No autorizado para operar en este negocio';
  END IF;

  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'El nombre del producto es obligatorio';
  END IF;

  IF p_category IS NULL OR btrim(p_category) = '' THEN
    RAISE EXCEPTION 'La categoría del producto es obligatoria';
  END IF;

  IF COALESCE(p_sale_price, 0) <= 0 THEN
    RAISE EXCEPTION 'El precio de venta debe ser mayor a 0';
  END IF;

  IF COALESCE(p_purchase_price, 0) < 0 THEN
    RAISE EXCEPTION 'El precio de compra no puede ser negativo';
  END IF;

  IF p_supplier_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.suppliers s
      WHERE s.id = p_supplier_id
        AND s.business_id = p_business_id
    ) THEN
      RAISE EXCEPTION 'Proveedor no válido para este negocio';
    END IF;
  END IF;

  -- Lock transaccional por negocio para serializar la generación de código.
  PERFORM pg_advisory_xact_lock(hashtext(p_business_id::text));

  SELECT COALESCE(MAX(
    CASE
      WHEN p.code ~ '^PRD-[0-9]{4}$' THEN substring(p.code from 5)::integer
      ELSE NULL
    END
  ), 0) + 1
  INTO v_next_number
  FROM public.products p
  WHERE p.business_id = p_business_id;

  IF v_next_number > 9999 THEN
    RAISE EXCEPTION 'Se alcanzó el límite de códigos secuenciales PRD-9999 para este negocio';
  END IF;

  v_code := 'PRD-' || lpad(v_next_number::text, 4, '0');

  INSERT INTO public.products (
    business_id,
    name,
    code,
    category,
    purchase_price,
    sale_price,
    stock,
    min_stock,
    unit,
    supplier_id,
    is_active,
    created_at
  ) VALUES (
    p_business_id,
    btrim(p_name),
    v_code,
    btrim(p_category),
    COALESCE(p_purchase_price, 0),
    COALESCE(p_sale_price, 0),
    COALESCE(p_stock, 0),
    COALESCE(p_min_stock, 5),
    COALESCE(NULLIF(btrim(p_unit), ''), 'unit'),
    p_supplier_id,
    COALESCE(p_is_active, true),
    timezone('utc', now())
  )
  RETURNING products.id INTO v_product_id;

  RETURN QUERY SELECT v_product_id, v_code;
  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.create_product_with_generated_code(uuid,text,text,numeric,numeric,integer,integer,text,uuid,boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_product_with_generated_code(uuid,text,text,numeric,numeric,integer,integer,text,uuid,boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_product_with_generated_code(uuid,text,text,numeric,numeric,integer,integer,text,uuid,boolean) TO authenticated;

COMMENT ON FUNCTION public.create_product_with_generated_code(uuid,text,text,numeric,numeric,integer,integer,text,uuid,boolean)
IS 'Crea producto y genera code PRD-#### secuencial por negocio usando lock transaccional para evitar colisiones.';
