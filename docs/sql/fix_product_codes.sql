-- =====================================================
-- FIX: Códigos de Productos Inconsistentes
-- =====================================================
-- Problema: Producto con código PRD-897571 (timestamp)
-- Solución: Corregir a secuencia normal
-- =====================================================

-- PASO 1: DIAGNOSTICAR - Ver todos los códigos actuales
-- =====================================================
SELECT 
  id,
  name,
  code,
  created_at,
  CASE 
    WHEN code ~ '^PRD-[0-9]{4}$' THEN '✅ Secuencial (PRD-0001)'
    WHEN code ~ '^PRD-[0-9]{6}$' THEN '⚠️ Timestamp (PRD-897571)'
    ELSE '❓ Otro formato'
  END AS tipo_codigo,
  CASE 
    WHEN code ~ '^PRD-[0-9]+$' THEN CAST(SUBSTRING(code FROM 5) AS INTEGER)
    ELSE NULL
  END AS numero_extraido
FROM products
ORDER BY created_at DESC
LIMIT 20;

-- PASO 2: IDENTIFICAR el código secuencial más alto
-- =====================================================
SELECT 
  MAX(CAST(SUBSTRING(code FROM 5) AS INTEGER)) as max_secuencial
FROM products
WHERE code ~ '^PRD-[0-9]{4}$'; -- Solo códigos de 4 dígitos

-- PASO 3: IDENTIFICAR productos con timestamp
-- =====================================================
SELECT 
  id,
  name,
  code,
  created_at
FROM products
WHERE code ~ '^PRD-[0-9]{6}$' -- Códigos de 6 dígitos (timestamp)
ORDER BY created_at DESC;

-- =====================================================
-- SOLUCIÓN 1: CORREGIR MANUALMENTE UN PRODUCTO
-- =====================================================
-- ⚠️ REEMPLAZA estos valores con los datos reales de tu producto

-- Paso A: Obtener el siguiente código secuencial disponible
DO $$
DECLARE
  v_max_number INTEGER;
  v_next_code TEXT;
  v_product_id UUID; -- ⚠️ REEMPLAZAR con el ID real del producto PRD-897571
BEGIN
  -- Encontrar el número más alto en secuencia
  SELECT COALESCE(MAX(CAST(SUBSTRING(code FROM 5) AS INTEGER)), 0)
  INTO v_max_number
  FROM products
  WHERE code ~ '^PRD-[0-9]{4}$';
  
  -- Generar siguiente código
  v_next_code := 'PRD-' || LPAD((v_max_number + 1)::TEXT, 4, '0');
  
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Código secuencial más alto: PRD-%', LPAD(v_max_number::TEXT, 4, '0');
  RAISE NOTICE 'Siguiente código disponible: %', v_next_code;
  RAISE NOTICE '============================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Para corregir el producto, ejecuta:';
  RAISE NOTICE 'UPDATE products SET code = ''%'' WHERE id = ''TU-PRODUCT-ID-AQUI'';', v_next_code;
END $$;

-- =====================================================
-- SOLUCIÓN 2: SCRIPT INTERACTIVO
-- =====================================================
-- Ejecuta este query para ver el producto con timestamp y el código sugerido

WITH max_seq AS (
  SELECT COALESCE(MAX(CAST(SUBSTRING(code FROM 5) AS INTEGER)), 0) as max_num
  FROM products
  WHERE code ~ '^PRD-[0-9]{4}$'
),
timestamp_products AS (
  SELECT 
    id,
    name,
    code as codigo_actual,
    created_at
  FROM products
  WHERE code ~ '^PRD-[0-9]{6}$'
  ORDER BY created_at DESC
  LIMIT 1
)
SELECT 
  tp.id,
  tp.name,
  tp.codigo_actual,
  'PRD-' || LPAD((ms.max_num + 1)::TEXT, 4, '0') as codigo_sugerido,
  tp.created_at,
  '-- Ejecuta este UPDATE para corregir:' as instruccion,
  format(
    'UPDATE products SET code = ''PRD-%s'' WHERE id = ''%s'';',
    LPAD((ms.max_num + 1)::TEXT, 4, '0'),
    tp.id
  ) as comando_sql
FROM timestamp_products tp, max_seq ms;

-- =====================================================
-- SOLUCIÓN 3: CORRECCIÓN AUTOMÁTICA (⚠️ USAR CON CUIDADO)
-- =====================================================
-- Este script corrige AUTOMÁTICAMENTE todos los productos con timestamp
-- ⚠️ SOLO ejecutar después de verificar con SOLUCIÓN 2

/*
DO $$
DECLARE
  v_max_number INTEGER;
  v_next_number INTEGER;
  v_product RECORD;
BEGIN
  -- Obtener número secuencial más alto
  SELECT COALESCE(MAX(CAST(SUBSTRING(code FROM 5) AS INTEGER)), 0)
  INTO v_max_number
  FROM products
  WHERE code ~ '^PRD-[0-9]{4}$';
  
  v_next_number := v_max_number + 1;
  
  -- Actualizar cada producto con timestamp
  FOR v_product IN 
    SELECT id, name, code
    FROM products
    WHERE code ~ '^PRD-[0-9]{6}$'
    ORDER BY created_at ASC
  LOOP
    UPDATE products 
    SET code = 'PRD-' || LPAD(v_next_number::TEXT, 4, '0'),
        updated_at = NOW()
    WHERE id = v_product.id;
    
    RAISE NOTICE 'Corregido: % | % → PRD-%', 
                 v_product.name, 
                 v_product.code, 
                 LPAD(v_next_number::TEXT, 4, '0');
    
    v_next_number := v_next_number + 1;
  END LOOP;
  
  RAISE NOTICE '============================================';
  RAISE NOTICE '✅ Corrección completada';
  RAISE NOTICE 'Total productos corregidos: %', v_next_number - v_max_number - 1;
END $$;
*/

-- =====================================================
-- PASO 4: VERIFICAR DESPUÉS DE CORREGIR
-- =====================================================
SELECT 
  code,
  name,
  CASE 
    WHEN code ~ '^PRD-[0-9]{4}$' THEN '✅ Secuencial'
    WHEN code ~ '^PRD-[0-9]{6}$' THEN '❌ Timestamp'
    ELSE '❓ Otro'
  END AS estado,
  created_at
FROM products
ORDER BY 
  CASE 
    WHEN code ~ '^PRD-[0-9]{4}$' THEN CAST(SUBSTRING(code FROM 5) AS INTEGER)
    ELSE 999999
  END ASC;

-- =====================================================
-- MEJORA PREVENTIVA: Función para generar códigos
-- =====================================================
-- Esta función se puede usar desde la app en lugar del código JS

CREATE OR REPLACE FUNCTION generate_product_code(p_business_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_number INTEGER;
  v_new_code TEXT;
BEGIN
  -- Validar business_id
  IF p_business_id IS NULL THEN
    RAISE EXCEPTION 'business_id no puede ser NULL';
  END IF;
  
  -- Obtener el número más alto (solo códigos de 4 dígitos)
  SELECT COALESCE(
    MAX(
      CASE 
        WHEN code ~ '^PRD-[0-9]{4}$' 
        THEN CAST(SUBSTRING(code FROM 5) AS INTEGER)
        ELSE 0
      END
    ), 
    0
  )
  INTO v_max_number
  FROM products
  WHERE business_id = p_business_id;
  
  -- Generar siguiente código
  v_new_code := 'PRD-' || LPAD((v_max_number + 1)::TEXT, 4, '0');
  
  RETURN v_new_code;
END;
$$;

COMMENT ON FUNCTION generate_product_code(UUID) IS
  'Genera códigos secuenciales de productos. Formato: PRD-0001, PRD-0002, etc.';

GRANT EXECUTE ON FUNCTION generate_product_code(UUID) TO authenticated;

-- Probar la función
-- SELECT generate_product_code('tu-business-id-aqui');

-- =====================================================
-- RESUMEN DE PASOS
-- =====================================================
/*
1. Ejecutar PASO 1 para ver todos los códigos actuales
2. Ejecutar PASO 2 para identificar el máximo secuencial
3. Ejecutar PASO 3 para ver productos con timestamp
4. Ejecutar SOLUCIÓN 2 para ver el comando de corrección
5. Copiar y ejecutar el UPDATE generado
6. Ejecutar PASO 4 para verificar
7. (Opcional) Crear función generate_product_code para uso futuro

NOTA: La app ya tiene lógica correcta, pero el timestamp se usó
como fallback cuando hubo un error. Después de corregir los códigos
existentes, la secuencia debería funcionar correctamente.
*/
