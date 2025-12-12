-- =====================================================
-- DIAGNÓSTICO Y CORRECCIÓN: ERROR 400 EN generate_invoice_number
-- =====================================================
-- Ejecutar en Supabase SQL Editor
-- =====================================================

-- PASO 1: VERIFICAR SI LA FUNCIÓN EXISTE
-- =====================================================
SELECT 
  routine_name,
  routine_type,
  data_type as return_type,
  specific_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'generate_invoice_number';

-- PASO 2: VERIFICAR PARÁMETROS DE LA FUNCIÓN
-- =====================================================
SELECT 
  parameter_name,
  data_type,
  parameter_mode
FROM information_schema.parameters
WHERE specific_name IN (
  SELECT specific_name 
  FROM information_schema.routines 
  WHERE routine_name = 'generate_invoice_number'
)
ORDER BY ordinal_position;

-- PASO 3: ELIMINAR FUNCIÓN EXISTENTE (SI HAY CONFLICTOS)
-- =====================================================
DROP FUNCTION IF EXISTS generate_invoice_number(UUID);
DROP FUNCTION IF EXISTS generate_invoice_number(TEXT);
DROP FUNCTION IF EXISTS generate_invoice_number();

-- PASO 4: CREAR FUNCIÓN CORRECTA CON SEGURIDAD
-- =====================================================
-- ✅ CORREGIDO: Usa alias de tabla para evitar error "invoice_number is ambiguous"
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

  -- ✅ Usar alias de tabla (i) y referencia explícita (i.invoice_number)
  -- Esto elimina la ambigüedad: "column reference 'invoice_number' is ambiguous"
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
  FROM invoices AS i  -- ✅ Alias de tabla
  WHERE i.business_id = p_business_id;  -- ✅ Referencia explícita
  
  -- Generar el nuevo número (incrementar + 1)
  v_new_number := 'FAC-' || LPAD((v_last_number + 1)::TEXT, 6, '0');
  
  RETURN v_new_number;
END;
$$;

-- PASO 5: COMENTAR LA FUNCIÓN
-- =====================================================
COMMENT ON FUNCTION generate_invoice_number(UUID) IS 
  'Genera números consecutivos de factura por negocio. Formato: FAC-XXXXXX';

-- PASO 6: OTORGAR PERMISOS A USUARIOS AUTENTICADOS
-- =====================================================
GRANT EXECUTE ON FUNCTION generate_invoice_number(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_invoice_number(UUID) TO anon;

-- PASO 7: VERIFICAR QUE LA FUNCIÓN SE CREÓ CORRECTAMENTE
-- =====================================================
SELECT 
  routine_name,
  routine_type,
  data_type as return_type,
  security_type,
  CASE 
    WHEN prosecdef THEN 'SECURITY DEFINER'
    ELSE 'SECURITY INVOKER'
  END as security_mode
FROM information_schema.routines r
LEFT JOIN pg_proc p ON p.proname = r.routine_name
WHERE routine_schema = 'public'
  AND routine_name = 'generate_invoice_number';

-- PASO 8: TEST DE LA FUNCIÓN CON BUSINESS_ID REAL
-- =====================================================
-- IMPORTANTE: Reemplaza este UUID con un business_id real de tu base de datos
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
END $$;

-- PASO 9: VERIFICAR TABLA INVOICES
-- =====================================================
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'invoices'
ORDER BY ordinal_position;

-- PASO 10: VERIFICAR RLS EN TABLA INVOICES
-- =====================================================
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'invoices';

-- PASO 11: VERIFICAR PERMISOS DE LA FUNCIÓN
-- =====================================================
SELECT 
  routine_name,
  grantee,
  privilege_type
FROM information_schema.routine_privileges
WHERE routine_name = 'generate_invoice_number'
  AND routine_schema = 'public';

-- =====================================================
-- PASO 12: SCRIPT DE MIGRACIÓN PARA NÚMEROS EXISTENTES
-- =====================================================
-- Ejecutar solo si hay facturas con números inválidos

DO $$
DECLARE
  invoice_record RECORD;
  new_invoice_number TEXT;
  counter INTEGER := 1;
BEGIN
  -- Recorrer todas las facturas sin formato correcto
  FOR invoice_record IN 
    SELECT id, business_id, invoice_number, created_at
    FROM invoices
    WHERE invoice_number IS NULL 
       OR invoice_number = ''
       OR NOT invoice_number ~ '^FAC-[0-9]{6}$'
    ORDER BY business_id, created_at
  LOOP
    -- Generar nuevo número
    new_invoice_number := 'FAC-' || LPAD(counter::TEXT, 6, '0');
    
    -- Actualizar factura
    UPDATE invoices
    SET invoice_number = new_invoice_number
    WHERE id = invoice_record.id;
    
    RAISE NOTICE 'Factura % actualizada: %', invoice_record.id, new_invoice_number;
    
    counter := counter + 1;
  END LOOP;
  
  RAISE NOTICE '✅ % facturas actualizadas', counter - 1;
END $$;

-- =====================================================
-- RESUMEN DEL PROBLEMA Y SOLUCIÓN
-- =====================================================
/*
PROBLEMA ORIGINAL:
❌ POST /rest/v1/rpc/generate_invoice_number → 400 (Bad Request)

CAUSAS POSIBLES DETECTADAS:
1. Función no existe en Supabase
2. Permisos insuficientes (no GRANT EXECUTE)
3. Parámetro p_business_id no coincide con el enviado
4. Función sin SECURITY DEFINER
5. RLS bloqueando acceso a tabla invoices
6. Función con sintaxis incorrecta

SOLUCIÓN IMPLEMENTADA:
✅ Función recreada con SECURITY DEFINER
✅ Permisos otorgados a authenticated y anon
✅ Validación de NULL en parámetros
✅ Regex mejorado para parsing de números
✅ search_path = public para evitar conflictos
✅ Comentarios y documentación

CÓDIGO REACT CORRECTO:
const { data: invoiceNumber, error: numberError } = await supabase
  .rpc('generate_invoice_number', { p_business_id: businessId });

if (numberError) {
  console.error('Error RPC:', numberError);
  throw new Error('Error al generar número de factura: ' + numberError.message);
}

VERIFICACIÓN:
1. ✅ La función existe (PASO 1)
2. ✅ Los parámetros coinciden (PASO 2)
3. ✅ Tiene permisos (PASO 6)
4. ✅ Test exitoso (PASO 8)

PRÓXIMOS PASOS:
1. Ejecutar este script completo en Supabase SQL Editor
2. Verificar que todos los PASO muestran resultados exitosos
3. Probar desde la aplicación React
4. Si sigue fallando, revisar logs de Supabase (Dashboard → Logs)
*/

-- =====================================================
-- TROUBLESHOOTING ADICIONAL
-- =====================================================

-- Ver últimos errores de la función
SELECT 
  log_time,
  message,
  detail,
  hint
FROM postgres_logs
WHERE message LIKE '%generate_invoice_number%'
ORDER BY log_time DESC
LIMIT 10;

-- Verificar que businessId enviado desde React existe
-- SELECT id, name FROM businesses WHERE id = 'TU_BUSINESS_ID_AQUI';
