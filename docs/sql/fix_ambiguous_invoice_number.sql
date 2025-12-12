-- =====================================================
-- SOLUCIÓN: Error "invoice_number is ambiguous"
-- =====================================================
-- Este script corrige el RPC generate_invoice_number
-- Ejecutar en Supabase SQL Editor
-- =====================================================

-- PROBLEMA ORIGINAL:
-- Error: "column reference 'invoice_number' is ambiguous"
-- Causa: PostgreSQL no sabe si invoice_number se refiere a:
--   1. La columna de la tabla: invoices.invoice_number
--   2. Una variable local (si existe)
--
-- Solución: Usar SIEMPRE prefijos en las columnas de tabla

-- =====================================================
-- PASO 1: ELIMINAR VERSIÓN ANTIGUA
-- =====================================================
DROP FUNCTION IF EXISTS generate_invoice_number(UUID);

-- =====================================================
-- PASO 2: CREAR FUNCIÓN CORREGIDA
-- =====================================================
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

  -- ✅ SOLUCIÓN: Usar alias de tabla (i) y referencia explícita (i.invoice_number)
  -- Esto elimina la ambigüedad completamente
  SELECT 
    COALESCE(
      MAX(
        CASE 
          -- Validar que el número tenga formato FAC-XXXXXX
          WHEN i.invoice_number ~ '^FAC-[0-9]+$' 
          THEN CAST(SUBSTRING(i.invoice_number FROM 5) AS INTEGER)
          ELSE 0
        END
      ), 
      0
    )
  INTO v_last_number
  FROM invoices AS i  -- ✅ Alias de tabla
  WHERE i.business_id = p_business_id;  -- ✅ Referencia explícita con alias
  
  -- Generar nuevo número: FAC-000001, FAC-000002, etc.
  v_new_number := 'FAC-' || LPAD((v_last_number + 1)::TEXT, 6, '0');
  
  RETURN v_new_number;
END;
$$;

-- =====================================================
-- PASO 3: AGREGAR COMENTARIO DESCRIPTIVO
-- =====================================================
COMMENT ON FUNCTION generate_invoice_number(UUID) IS 
  'Genera números consecutivos de factura por negocio. Formato: FAC-XXXXXX. 
   Usa alias de tabla para evitar ambigüedad con variables locales.';

-- =====================================================
-- PASO 4: OTORGAR PERMISOS
-- =====================================================
GRANT EXECUTE ON FUNCTION generate_invoice_number(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_invoice_number(UUID) TO anon;

-- =====================================================
-- PASO 5: VERIFICAR CREACIÓN EXITOSA
-- =====================================================
SELECT 
  routine_name,
  routine_type,
  data_type as return_type,
  security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'generate_invoice_number';

-- =====================================================
-- PASO 6: TEST DE LA FUNCIÓN
-- =====================================================
DO $$
DECLARE
  test_business_id UUID;
  result TEXT;
BEGIN
  -- Obtener un business_id real
  SELECT id INTO test_business_id
  FROM businesses
  LIMIT 1;
  
  IF test_business_id IS NULL THEN
    RAISE NOTICE '⚠️  No hay businesses en la base de datos para testear';
    RETURN;
  END IF;
  
  -- Testear la función
  SELECT generate_invoice_number(test_business_id) INTO result;
  
  RAISE NOTICE '✅ Función ejecutada exitosamente!';
  RAISE NOTICE '   Business ID: %', test_business_id;
  RAISE NOTICE '   Número generado: %', result;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ ERROR: %', SQLERRM;
    RAISE NOTICE '   Código: %', SQLSTATE;
END $$;

-- =====================================================
-- EXPLICACIÓN TÉCNICA DEL ERROR Y LA SOLUCIÓN
-- =====================================================
/*
ERROR ORIGINAL:
{
  message: "column reference 'invoice_number' is ambiguous",
  details: "It could refer to either a PL/pgSQL variable or a table column.",
  code: "42702"
}

CAUSA:
En PostgreSQL, cuando tienes una columna en una tabla con el mismo nombre
que una variable local en una función PL/pgSQL, se produce ambigüedad.

Ejemplo INCORRECTO (causa ambigüedad):
  SELECT invoice_number INTO variable
  FROM invoices
  WHERE business_id = p_business_id;
  
  PostgreSQL no sabe si "invoice_number" se refiere a:
  - La columna: invoices.invoice_number
  - Una variable local: invoice_number

SOLUCIÓN APLICADA:
1. ✅ Usar ALIAS de tabla: FROM invoices AS i
2. ✅ Usar referencia EXPLÍCITA: i.invoice_number
3. ✅ Usar nombres DIFERENTES para variables: v_last_number, v_new_number

Código CORRECTO:
  SELECT i.invoice_number  -- ✅ Referencia explícita con alias
  INTO v_last_number       -- ✅ Variable con nombre diferente
  FROM invoices AS i       -- ✅ Alias de tabla
  WHERE i.business_id = p_business_id;

MEJORAS ADICIONALES:
1. ✅ Validación de NULL en p_business_id
2. ✅ Regex robusto: ^FAC-[0-9]+$ valida formato
3. ✅ SUBSTRING desde posición 5 (después de "FAC-")
4. ✅ SECURITY DEFINER para evitar problemas con RLS
5. ✅ SET search_path = public para evitar conflictos
6. ✅ Variables con prefijo v_ (convención PL/pgSQL)
7. ✅ Parámetro con prefijo p_ (convención PL/pgSQL)

VENTAJAS DE LA SOLUCIÓN:
- ✅ Elimina completamente la ambigüedad
- ✅ Código más legible y mantenible
- ✅ Sigue convenciones estándar de PL/pgSQL
- ✅ Performance optimizado (usa índice en business_id)
- ✅ Robusto ante datos corruptos (regex validation)
*/

-- =====================================================
-- COMPARACIÓN: ANTES vs DESPUÉS
-- =====================================================
/*
ANTES (con ambigüedad):
-------------------
SELECT SUBSTRING(invoice_number FROM '[0-9]+$')
FROM invoices
WHERE business_id = p_business_id;
-- ❌ PostgreSQL no sabe si invoice_number es columna o variable

DESPUÉS (sin ambigüedad):
-----------------------
SELECT SUBSTRING(i.invoice_number FROM '[0-9]+$')
FROM invoices AS i
WHERE i.business_id = p_business_id;
-- ✅ i.invoice_number es claramente la columna de la tabla

ALTERNATIVA (también válida):
---------------------------
SELECT SUBSTRING(invoices.invoice_number FROM '[0-9]+$')
FROM invoices
WHERE invoices.business_id = p_business_id;
-- ✅ invoices.invoice_number es explícito
-- Pero el alias (AS i) es más corto y limpio
*/

-- =====================================================
-- PRÓXIMOS PASOS
-- =====================================================
/*
1. ✅ Ejecutar este script en Supabase SQL Editor
2. ✅ Verificar que el PASO 5 muestra la función creada
3. ✅ Verificar que el PASO 6 muestra "Función ejecutada exitosamente"
4. ✅ Testear desde la aplicación React
5. ✅ Verificar logs en DevTools Console

CÓDIGO REACT (NO NECESITA CAMBIOS):
El código actual ya es correcto:

const { data: invNumber, error: numberError } = await supabase
  .rpc('generate_invoice_number', { p_business_id: businessId });

Los parámetros coinciden perfectamente.
*/
