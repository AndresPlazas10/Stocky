-- =====================================================
-- CREAR FUNCIÓN: generate_invoice_number
-- =====================================================
-- Fecha: 2026-01-20
-- Descripción: Genera números consecutivos de factura
-- Formato: FAC-000001, FAC-000002, etc.
-- =====================================================

-- PASO 1: ELIMINAR FUNCIÓN EXISTENTE (SI HAY CONFLICTOS)
DROP FUNCTION IF EXISTS generate_invoice_number(UUID);
DROP FUNCTION IF EXISTS generate_invoice_number(TEXT);
DROP FUNCTION IF EXISTS generate_invoice_number();

-- PASO 2: CREAR FUNCIÓN CORRECTA
CREATE OR REPLACE FUNCTION generate_invoice_number(p_business_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_number INTEGER;
  v_new_number TEXT;
BEGIN
  -- Validar que p_business_id no sea NULL
  IF p_business_id IS NULL THEN
    RAISE EXCEPTION 'business_id no puede ser NULL';
  END IF;

  -- Obtener el último número de factura para este negocio
  -- Usar alias de tabla (i) para evitar ambigüedad
  SELECT 
    COALESCE(
      MAX(
        CASE 
          WHEN i.invoice_number ~ '^FAC-[0-9]+$' 
          THEN CAST(SUBSTRING(i.invoice_number FROM 5) AS INTEGER)
          ELSE 0
        END
      ), 
      0
    )
  INTO v_last_number
  FROM invoices AS i
  WHERE i.business_id = p_business_id;
  
  -- Generar el nuevo número (incrementar + 1)
  -- Formato: FAC-000001, FAC-000002, etc.
  v_new_number := 'FAC-' || LPAD((v_last_number + 1)::TEXT, 6, '0');
  
  RETURN v_new_number;
END;
$$;

-- PASO 3: COMENTAR LA FUNCIÓN
COMMENT ON FUNCTION generate_invoice_number(UUID) IS 
  'Genera números consecutivos de factura por negocio. Formato: FAC-XXXXXX. Usado para comprobantes de pago (NO facturas electrónicas válidas ante DIAN).';

-- PASO 4: OTORGAR PERMISOS
GRANT EXECUTE ON FUNCTION generate_invoice_number(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_invoice_number(UUID) TO anon;

-- =====================================================
-- VERIFICACIÓN
-- =====================================================
-- Descomenta para verificar que se creó correctamente:
-- SELECT generate_invoice_number('00000000-0000-0000-0000-000000000000'::UUID);
