-- =====================================================
-- CORRECCIÓN: TOTAL EN 0 COP EN COMPRAS
-- =====================================================
-- Ejecutar en Supabase SQL Editor
-- =====================================================

-- PASO 1: VERIFICAR ESTRUCTURA ACTUAL DE TABLA PURCHASES
-- =====================================================
SELECT 
  column_name,
  data_type,
  numeric_precision,
  numeric_scale,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'purchases'
ORDER BY ordinal_position;

-- PASO 2: VERIFICAR ESTRUCTURA DE PURCHASE_DETAILS
-- =====================================================
SELECT 
  column_name,
  data_type,
  numeric_precision,
  numeric_scale,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'purchase_details'
ORDER BY ordinal_position;

-- PASO 3: VERIFICAR COMPRAS CON TOTAL EN 0
-- =====================================================
SELECT 
  id,
  business_id,
  supplier_id,
  total,
  created_at
FROM purchases
WHERE total = 0 OR total IS NULL
ORDER BY created_at DESC
LIMIT 20;

-- PASO 4: CORREGIR COLUMNA TOTAL EN PURCHASES
-- =====================================================
DO $$
BEGIN
  -- Asegurar que total es NUMERIC(12,2) NOT NULL
  ALTER TABLE purchases 
    ALTER COLUMN total TYPE NUMERIC(12, 2);
  
  ALTER TABLE purchases 
    ALTER COLUMN total SET NOT NULL;
  
  -- Remover default si existe
  ALTER TABLE purchases 
    ALTER COLUMN total DROP DEFAULT;
  
  RAISE NOTICE '✅ Columna total corregida: NUMERIC(12,2) NOT NULL sin default';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '⚠️  Error al modificar columna total: %', SQLERRM;
END $$;

-- PASO 5: AGREGAR COLUMNAS A PURCHASE_DETAILS SI NO EXISTEN
-- =====================================================
DO $$
BEGIN
  -- Agregar unit_cost si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'purchase_details'
      AND column_name = 'unit_cost'
  ) THEN
    ALTER TABLE purchase_details 
      ADD COLUMN unit_cost NUMERIC(12, 2) NOT NULL DEFAULT 0;
    RAISE NOTICE '✅ Columna unit_cost agregada';
  ELSE
    -- Asegurar tipo correcto
    ALTER TABLE purchase_details 
      ALTER COLUMN unit_cost TYPE NUMERIC(12, 2);
    ALTER TABLE purchase_details 
      ALTER COLUMN unit_cost SET NOT NULL;
    RAISE NOTICE 'ℹ️  Columna unit_cost ya existe - tipo verificado';
  END IF;

  -- Agregar subtotal si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'purchase_details'
      AND column_name = 'subtotal'
  ) THEN
    ALTER TABLE purchase_details 
      ADD COLUMN subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0;
    RAISE NOTICE '✅ Columna subtotal agregada';
  ELSE
    -- Asegurar tipo correcto
    ALTER TABLE purchase_details 
      ALTER COLUMN subtotal TYPE NUMERIC(12, 2);
    ALTER TABLE purchase_details 
      ALTER COLUMN subtotal SET NOT NULL;
    RAISE NOTICE 'ℹ️  Columna subtotal ya existe - tipo verificado';
  END IF;
END $$;

-- PASO 6: CREAR TRIGGER PARA CALCULAR TOTAL AUTOMÁTICAMENTE
-- =====================================================
-- Este trigger recalcula el total de la compra basado en purchase_details

CREATE OR REPLACE FUNCTION update_purchase_total()
RETURNS TRIGGER AS $$
BEGIN
  -- Recalcular total de la compra sumando todos los subtotales
  UPDATE purchases
  SET total = COALESCE((
    SELECT SUM(subtotal)
    FROM purchase_details
    WHERE purchase_id = NEW.purchase_id
  ), 0)
  WHERE id = NEW.purchase_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Eliminar trigger si existe
DROP TRIGGER IF EXISTS trigger_update_purchase_total ON purchase_details;

-- Crear trigger en INSERT, UPDATE, DELETE de purchase_details
CREATE TRIGGER trigger_update_purchase_total
AFTER INSERT OR UPDATE OR DELETE ON purchase_details
FOR EACH ROW
EXECUTE FUNCTION update_purchase_total();

COMMENT ON FUNCTION update_purchase_total IS 'Recalcula automáticamente el total de la compra cuando se modifican los detalles';

-- PASO 7: RECALCULAR TOTALES DE COMPRAS EXISTENTES
-- =====================================================
DO $$
DECLARE
  v_purchase RECORD;
  v_new_total NUMERIC(12, 2);
  v_count INTEGER := 0;
BEGIN
  -- Para cada compra con total en 0
  FOR v_purchase IN 
    SELECT id FROM purchases WHERE total = 0 OR total IS NULL
  LOOP
    -- Calcular total desde purchase_details
    SELECT COALESCE(SUM(quantity * unit_cost), 0)
    INTO v_new_total
    FROM purchase_details
    WHERE purchase_id = v_purchase.id;
    
    -- Actualizar total
    IF v_new_total > 0 THEN
      UPDATE purchases
      SET total = v_new_total
      WHERE id = v_purchase.id;
      
      v_count := v_count + 1;
    END IF;
  END LOOP;
  
  RAISE NOTICE '✅ % compras recalculadas', v_count;
END $$;

-- PASO 8: VERIFICAR ESTRUCTURA FINAL
-- =====================================================
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default,
  CASE 
    WHEN column_name = 'id' THEN '✅ PK auto-generado'
    WHEN column_name = 'business_id' THEN '✅ FK a businesses (requerido)'
    WHEN column_name = 'user_id' THEN '✅ FK a auth.users'
    WHEN column_name = 'supplier_id' THEN '✅ FK a suppliers'
    WHEN column_name = 'total' THEN '✅ Total de la compra (NUMERIC(12,2) NOT NULL)'
    WHEN column_name = 'payment_method' THEN '✅ Método de pago'
    WHEN column_name = 'notes' THEN '✅ Notas opcionales'
    WHEN column_name = 'created_at' THEN '✅ Timestamp'
    ELSE '⚠️  Columna adicional'
  END as nota
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'purchases'
ORDER BY ordinal_position;

-- PASO 9: VERIFICAR PURCHASE_DETAILS
-- =====================================================
SELECT 
  column_name,
  data_type,
  is_nullable,
  CASE 
    WHEN column_name = 'id' THEN '✅ PK'
    WHEN column_name = 'purchase_id' THEN '✅ FK a purchases'
    WHEN column_name = 'product_id' THEN '✅ FK a products'
    WHEN column_name = 'quantity' THEN '✅ Cantidad comprada'
    WHEN column_name = 'unit_cost' THEN '✅ Precio unitario (NUMERIC(12,2))'
    WHEN column_name = 'subtotal' THEN '✅ Subtotal (quantity × unit_cost)'
    ELSE '⚠️  Columna adicional'
  END as nota
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'purchase_details'
ORDER BY ordinal_position;

-- PASO 10: TEST DE INSERT
-- =====================================================
DO $$
DECLARE
  test_business_id UUID := '3f2b775e-a4dd-432a-9913-b73d50238975';
  test_user_id UUID := '3382bbb1-0477-4950-bec0-6fccb74c111c';
  test_supplier_id UUID;
  test_product_id UUID;
  test_purchase_id UUID;
BEGIN
  -- Obtener primer supplier
  SELECT id INTO test_supplier_id
  FROM suppliers
  WHERE business_id = test_business_id
  LIMIT 1;
  
  -- Obtener primer producto
  SELECT id INTO test_product_id
  FROM products
  WHERE business_id = test_business_id
  LIMIT 1;
  
  IF test_supplier_id IS NULL OR test_product_id IS NULL THEN
    RAISE NOTICE '⚠️  No hay suppliers o productos para testear';
    RETURN;
  END IF;

  -- Insertar compra de prueba CON total
  INSERT INTO purchases (
    business_id,
    user_id,
    supplier_id,
    payment_method,
    total
  ) VALUES (
    test_business_id,
    test_user_id,
    test_supplier_id,
    'efectivo',
    15000.00  -- ✅ Total explícito
  ) RETURNING id INTO test_purchase_id;

  -- Insertar detalles
  INSERT INTO purchase_details (
    purchase_id,
    product_id,
    quantity,
    unit_cost,
    subtotal
  ) VALUES (
    test_purchase_id,
    test_product_id,
    3,
    5000.00,
    15000.00
  );

  RAISE NOTICE '✅ INSERT exitoso! Purchase ID: % con total: 15000.00', test_purchase_id;

  -- Verificar
  DECLARE
    v_total NUMERIC(12, 2);
  BEGIN
    SELECT total INTO v_total
    FROM purchases
    WHERE id = test_purchase_id;
    
    IF v_total = 15000.00 THEN
      RAISE NOTICE '✅ Total verificado correctamente: %', v_total;
    ELSE
      RAISE NOTICE '❌ Total incorrecto: % (esperado: 15000.00)', v_total;
    END IF;
  END;

  -- Eliminar compra de prueba
  DELETE FROM purchase_details WHERE purchase_id = test_purchase_id;
  DELETE FROM purchases WHERE id = test_purchase_id;
  RAISE NOTICE '🧹 Compra de prueba eliminada';

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ ERROR en test: %', SQLERRM;
END $$;

-- PASO 11: VERIFICAR COMPRAS RECIENTES
-- =====================================================
SELECT 
  p.id,
  p.created_at,
  s.business_name as proveedor,
  p.total,
  COUNT(pd.id) as items,
  SUM(pd.subtotal) as total_calculado,
  CASE 
    WHEN p.total = COALESCE(SUM(pd.subtotal), 0) THEN '✅ OK'
    ELSE '❌ DIFERENCIA'
  END as status
FROM purchases p
LEFT JOIN suppliers s ON p.supplier_id = s.id
LEFT JOIN purchase_details pd ON p.id = pd.purchase_id
GROUP BY p.id, p.created_at, s.business_name, p.total
ORDER BY p.created_at DESC
LIMIT 10;

-- =====================================================
-- RESUMEN
-- =====================================================
/*
CAMBIOS REALIZADOS:

1. ✅ Columna total en purchases:
   - Tipo: NUMERIC(12, 2)
   - NOT NULL
   - Sin default (debe enviarse explícitamente)

2. ✅ purchase_details mejorado:
   - unit_cost: NUMERIC(12, 2) NOT NULL
   - subtotal: NUMERIC(12, 2) NOT NULL

3. ✅ Trigger automático:
   - Recalcula total al modificar purchase_details
   - Protección contra inconsistencias

4. ✅ Compras existentes recalculadas

ESTRUCTURA FINAL PURCHASES:
- id (UUID, PK)
- business_id (UUID, FK)
- user_id (UUID, FK)
- supplier_id (UUID, FK)
- total (NUMERIC(12,2), NOT NULL) ← CORREGIDO
- payment_method (TEXT)
- notes (TEXT, nullable)
- created_at (TIMESTAMPTZ)

ESTRUCTURA FINAL PURCHASE_DETAILS:
- id (BIGINT, PK)
- purchase_id (UUID, FK)
- product_id (UUID, FK)
- quantity (INTEGER, NOT NULL)
- unit_cost (NUMERIC(12,2), NOT NULL) ← AGREGADO
- subtotal (NUMERIC(12,2), NOT NULL) ← AGREGADO

CÓDIGO REACT CORRECTO:
const { data: purchase } = await supabase
  .from('purchases')
  .insert([{
    business_id: businessId,
    user_id: user.id,
    supplier_id: supplierId,
    payment_method: paymentMethod,
    total: total  // ✅ OBLIGATORIO
  }]);

const purchaseDetails = cart.map(item => ({
  purchase_id: purchase.id,
  product_id: item.product_id,
  quantity: item.quantity,
  unit_cost: item.unit_price,  // ✅ AGREGADO
  subtotal: item.quantity * item.unit_price  // ✅ AGREGADO
}));
*/
