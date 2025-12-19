-- =====================================================
-- 🔧 FIX CRÍTICO: TRIGGERS AUTOMÁTICOS DE STOCK
-- =====================================================
-- Ejecutar en Supabase SQL Editor
-- Implementa actualización automática y atómica de stock
-- =====================================================

-- =====================================================
-- PASO 1: ELIMINAR TRIGGERS EXISTENTES (si existen)
-- =====================================================

DROP TRIGGER IF EXISTS trigger_reduce_stock_on_sale ON sale_details CASCADE;
DROP TRIGGER IF EXISTS trigger_increase_stock_on_purchase ON purchase_details CASCADE;
DROP TRIGGER IF EXISTS trigger_restore_stock_on_sale_delete ON sale_details CASCADE;
DROP TRIGGER IF EXISTS trigger_reduce_stock_on_purchase_delete ON purchase_details CASCADE;

DROP FUNCTION IF EXISTS auto_reduce_stock_on_sale() CASCADE;
DROP FUNCTION IF EXISTS auto_increase_stock_on_purchase() CASCADE;
DROP FUNCTION IF EXISTS auto_restore_stock_on_sale_delete() CASCADE;
DROP FUNCTION IF EXISTS auto_restore_stock_on_purchase_delete() CASCADE;

-- =====================================================
-- PASO 2: CREAR FUNCIÓN - Reducir stock al crear venta
-- =====================================================

CREATE OR REPLACE FUNCTION auto_reduce_stock_on_sale()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_stock NUMERIC;
  v_product_name TEXT;
BEGIN
  -- Obtener stock actual y nombre del producto
  SELECT stock, name INTO v_current_stock, v_product_name
  FROM products
  WHERE id = NEW.product_id;
  
  -- Validar que el producto existe
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Producto % no existe', NEW.product_id;
  END IF;
  
  -- Validar stock suficiente ANTES de reducir
  IF v_current_stock < NEW.quantity THEN
    RAISE EXCEPTION 'Stock insuficiente para producto "%" (ID: %). Disponible: %, Requerido: %',
      v_product_name,
      NEW.product_id,
      v_current_stock,
      NEW.quantity;
  END IF;
  
  -- Reducir stock atómicamente
  UPDATE products
  SET 
    stock = stock - NEW.quantity,
    updated_at = NOW()
  WHERE id = NEW.product_id;
  
  -- Log opcional (comentar si no tienes tabla stock_movements)
  -- INSERT INTO stock_movements (product_id, type, quantity, stock_before, stock_after, reference_id)
  -- VALUES (NEW.product_id, 'sale', -NEW.quantity, v_current_stock, v_current_stock - NEW.quantity, NEW.sale_id);
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION auto_reduce_stock_on_sale IS 
  'Reduce stock automáticamente al insertar sale_detail. Valida stock suficiente.';

-- =====================================================
-- PASO 3: CREAR TRIGGER - Reducir stock en ventas
-- =====================================================

CREATE TRIGGER trigger_reduce_stock_on_sale
  AFTER INSERT ON sale_details
  FOR EACH ROW
  EXECUTE FUNCTION auto_reduce_stock_on_sale();

COMMENT ON TRIGGER trigger_reduce_stock_on_sale ON sale_details IS
  'Trigger automático: reduce stock al crear venta';

-- =====================================================
-- PASO 4: CREAR FUNCIÓN - Aumentar stock al crear compra
-- =====================================================

CREATE OR REPLACE FUNCTION auto_increase_stock_on_purchase()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_stock NUMERIC;
  v_product_name TEXT;
BEGIN
  -- Obtener stock actual y nombre
  SELECT stock, name INTO v_current_stock, v_product_name
  FROM products
  WHERE id = NEW.product_id;
  
  -- Validar que el producto existe
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Producto % no existe', NEW.product_id;
  END IF;
  
  -- Aumentar stock atómicamente
  UPDATE products
  SET 
    stock = stock + NEW.quantity,
    updated_at = NOW()
  WHERE id = NEW.product_id;
  
  -- Log opcional
  -- INSERT INTO stock_movements (product_id, type, quantity, stock_before, stock_after, reference_id)
  -- VALUES (NEW.product_id, 'purchase', NEW.quantity, v_current_stock, v_current_stock + NEW.quantity, NEW.purchase_id);
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION auto_increase_stock_on_purchase IS 
  'Aumenta stock automáticamente al insertar purchase_detail.';

-- =====================================================
-- PASO 5: CREAR TRIGGER - Aumentar stock en compras
-- =====================================================

CREATE TRIGGER trigger_increase_stock_on_purchase
  AFTER INSERT ON purchase_details
  FOR EACH ROW
  EXECUTE FUNCTION auto_increase_stock_on_purchase();

COMMENT ON TRIGGER trigger_increase_stock_on_purchase ON purchase_details IS
  'Trigger automático: aumenta stock al crear compra';

-- =====================================================
-- PASO 6: CREAR FUNCIÓN - Restaurar stock al eliminar venta
-- =====================================================

CREATE OR REPLACE FUNCTION auto_restore_stock_on_sale_delete()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_stock NUMERIC;
BEGIN
  -- Obtener stock actual
  SELECT stock INTO v_current_stock
  FROM products
  WHERE id = OLD.product_id;
  
  -- Restaurar stock (devolver unidades)
  UPDATE products
  SET 
    stock = stock + OLD.quantity,
    updated_at = NOW()
  WHERE id = OLD.product_id;
  
  -- Log opcional
  -- INSERT INTO stock_movements (product_id, type, quantity, stock_before, stock_after, reference_id)
  -- VALUES (OLD.product_id, 'sale_delete', OLD.quantity, v_current_stock, v_current_stock + OLD.quantity, OLD.sale_id);
  
  RETURN OLD;
END;
$$;

COMMENT ON FUNCTION auto_restore_stock_on_sale_delete IS 
  'Restaura stock automáticamente al eliminar sale_detail (rollback).';

-- =====================================================
-- PASO 7: CREAR TRIGGER - Restaurar stock al eliminar venta
-- =====================================================

CREATE TRIGGER trigger_restore_stock_on_sale_delete
  BEFORE DELETE ON sale_details
  FOR EACH ROW
  EXECUTE FUNCTION auto_restore_stock_on_sale_delete();

COMMENT ON TRIGGER trigger_restore_stock_on_sale_delete ON sale_details IS
  'Trigger automático: restaura stock al eliminar venta (ej: cancelación)';

-- =====================================================
-- PASO 8: CREAR FUNCIÓN - Restaurar stock al eliminar compra
-- =====================================================

CREATE OR REPLACE FUNCTION auto_restore_stock_on_purchase_delete()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_stock NUMERIC;
BEGIN
  -- Obtener stock actual
  SELECT stock INTO v_current_stock
  FROM products
  WHERE id = OLD.product_id;
  
  -- Validar que no dejará stock negativo
  IF v_current_stock < OLD.quantity THEN
    RAISE EXCEPTION 'No se puede eliminar compra: stock insuficiente (%, requerido %))',
      v_current_stock,
      OLD.quantity;
  END IF;
  
  -- Reducir stock (revertir la compra)
  UPDATE products
  SET 
    stock = stock - OLD.quantity,
    updated_at = NOW()
  WHERE id = OLD.product_id;
  
  RETURN OLD;
END;
$$;

COMMENT ON FUNCTION auto_restore_stock_on_purchase_delete IS 
  'Reduce stock automáticamente al eliminar purchase_detail (rollback).';

-- =====================================================
-- PASO 9: CREAR TRIGGER - Restaurar stock al eliminar compra
-- =====================================================

CREATE TRIGGER trigger_reduce_stock_on_purchase_delete
  BEFORE DELETE ON purchase_details
  FOR EACH ROW
  EXECUTE FUNCTION auto_restore_stock_on_purchase_delete();

COMMENT ON TRIGGER trigger_reduce_stock_on_purchase_delete ON purchase_details IS
  'Trigger automático: reduce stock al eliminar compra (ej: cancelación)';

-- =====================================================
-- PASO 10: VERIFICAR INSTALACIÓN
-- =====================================================

SELECT 
  '✅ VERIFICACIÓN: Triggers instalados' as resultado;

SELECT 
  trigger_name,
  event_object_table as tabla,
  event_manipulation as evento,
  action_timing as momento
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table IN ('sale_details', 'purchase_details')
  AND trigger_name LIKE 'trigger_%stock%'
ORDER BY event_object_table, trigger_name;

-- Resultado esperado: 4 triggers
-- 1. trigger_reduce_stock_on_sale (sale_details, INSERT, AFTER)
-- 2. trigger_restore_stock_on_sale_delete (sale_details, DELETE, BEFORE)
-- 3. trigger_increase_stock_on_purchase (purchase_details, INSERT, AFTER)
-- 4. trigger_reduce_stock_on_purchase_delete (purchase_details, DELETE, BEFORE)

-- =====================================================
-- PASO 11: TESTING
-- =====================================================

DO $$
DECLARE
  v_test_product_id UUID;
  v_test_sale_id UUID;
  v_test_purchase_id UUID;
  v_initial_stock NUMERIC;
  v_after_sale_stock NUMERIC;
  v_after_purchase_stock NUMERIC;
  v_final_stock NUMERIC;
BEGIN
  RAISE NOTICE '🧪 INICIANDO TESTS DE TRIGGERS...';
  RAISE NOTICE '';
  
  -- 1. Crear producto de prueba
  INSERT INTO products (business_id, name, code, category, stock, purchase_price, sale_price, is_active)
  VALUES (
    (SELECT id FROM businesses LIMIT 1),  -- Primer negocio
    'TEST-TRIGGER-PRODUCTO',
    'TEST-TRG-001',
    'Testing',
    100,  -- Stock inicial
    10,
    20,
    true
  )
  RETURNING id, stock INTO v_test_product_id, v_initial_stock;
  
  RAISE NOTICE '✅ Producto de prueba creado: %', v_test_product_id;
  RAISE NOTICE '   Stock inicial: %', v_initial_stock;
  RAISE NOTICE '';
  
  -- 2. TEST: Crear venta (debe reducir stock)
  INSERT INTO sales (business_id, user_id, total, payment_method)
  VALUES (
    (SELECT id FROM businesses LIMIT 1),
    auth.uid(),
    200,
    'cash'
  )
  RETURNING id INTO v_test_sale_id;
  
  -- Insertar detalle de venta (trigger debe activarse)
  INSERT INTO sale_details (sale_id, product_id, quantity, unit_price)
  VALUES (v_test_sale_id, v_test_product_id, 10, 20);
  
  SELECT stock INTO v_after_sale_stock FROM products WHERE id = v_test_product_id;
  
  IF v_after_sale_stock = v_initial_stock - 10 THEN
    RAISE NOTICE '✅ TEST VENTA: Stock reducido correctamente';
    RAISE NOTICE '   Stock antes: %, después: %', v_initial_stock, v_after_sale_stock;
  ELSE
    RAISE EXCEPTION '❌ TEST VENTA FALLÓ: Stock esperado %, obtenido %', 
      v_initial_stock - 10, v_after_sale_stock;
  END IF;
  RAISE NOTICE '';
  
  -- 3. TEST: Crear compra (debe aumentar stock)
  INSERT INTO purchases (business_id, user_id, total, payment_method, supplier_id)
  VALUES (
    (SELECT id FROM businesses LIMIT 1),
    auth.uid(),
    500,
    'cash',
    (SELECT id FROM suppliers LIMIT 1)
  )
  RETURNING id INTO v_test_purchase_id;
  
  -- Insertar detalle de compra (trigger debe activarse)
  INSERT INTO purchase_details (purchase_id, product_id, quantity, unit_cost, subtotal)
  VALUES (v_test_purchase_id, v_test_product_id, 50, 10, 500);
  
  SELECT stock INTO v_after_purchase_stock FROM products WHERE id = v_test_product_id;
  
  IF v_after_purchase_stock = v_after_sale_stock + 50 THEN
    RAISE NOTICE '✅ TEST COMPRA: Stock aumentado correctamente';
    RAISE NOTICE '   Stock antes: %, después: %', v_after_sale_stock, v_after_purchase_stock;
  ELSE
    RAISE EXCEPTION '❌ TEST COMPRA FALLÓ: Stock esperado %, obtenido %', 
      v_after_sale_stock + 50, v_after_purchase_stock;
  END IF;
  RAISE NOTICE '';
  
  -- 4. TEST: Eliminar venta (debe restaurar stock)
  DELETE FROM sale_details WHERE sale_id = v_test_sale_id;
  DELETE FROM sales WHERE id = v_test_sale_id;
  
  SELECT stock INTO v_final_stock FROM products WHERE id = v_test_product_id;
  
  IF v_final_stock = v_after_purchase_stock + 10 THEN
    RAISE NOTICE '✅ TEST DELETE VENTA: Stock restaurado correctamente';
    RAISE NOTICE '   Stock antes: %, después: %', v_after_purchase_stock, v_final_stock;
  ELSE
    RAISE EXCEPTION '❌ TEST DELETE VENTA FALLÓ: Stock esperado %, obtenido %', 
      v_after_purchase_stock + 10, v_final_stock;
  END IF;
  RAISE NOTICE '';
  
  -- 5. Limpieza
  DELETE FROM purchase_details WHERE purchase_id = v_test_purchase_id;
  DELETE FROM purchases WHERE id = v_test_purchase_id;
  DELETE FROM products WHERE id = v_test_product_id;
  
  RAISE NOTICE '✅ TODOS LOS TESTS PASARON EXITOSAMENTE';
  RAISE NOTICE '✅ Producto de prueba eliminado';
  RAISE NOTICE '';
  RAISE NOTICE '🎉 TRIGGERS FUNCIONAN CORRECTAMENTE';
  
EXCEPTION
  WHEN OTHERS THEN
    -- Limpieza en caso de error
    DELETE FROM sale_details WHERE sale_id = v_test_sale_id;
    DELETE FROM sales WHERE id = v_test_sale_id;
    DELETE FROM purchase_details WHERE purchase_id = v_test_purchase_id;
    DELETE FROM purchases WHERE id = v_test_purchase_id;
    DELETE FROM products WHERE id = v_test_product_id;
    
    RAISE EXCEPTION 'TEST FALLÓ: %', SQLERRM;
END $$;

-- =====================================================
-- NOTAS IMPORTANTES
-- =====================================================

/*
✅ VENTAJAS DE TRIGGERS AUTOMÁTICOS:
1. Atómicos y transaccionales (garantizado por PostgreSQL)
2. No requieren código frontend
3. Funcionan desde SQL Editor, API, o cualquier cliente
4. Imposible olvidarse de actualizar stock
5. Rollback automático en errores

⚠️ CONSIDERACIONES:
1. Los triggers NO se ejecutan en datos existentes (solo INSERT/DELETE nuevos)
2. Si tienes ventas/compras antiguas SIN actualización de stock, 
   debes corregir manualmente con script de migración
3. Eliminar venta restaura stock (puede no ser deseado si ya se vendió físicamente)

🔧 PRÓXIMOS PASOS:
1. Ejecutar script de diagnóstico: docs/sql/DIAGNOSTICO_VENTAS_INVENTARIO.sql
2. Si hay inconsistencias, ejecutar script de corrección manual
3. Eliminar código de actualización manual en:
   - src/components/Dashboard/Compras.jsx (líneas 350-357)
   - src/services/salesService.js (líneas 183-193)
4. Testing exhaustivo en staging antes de producción

📖 DOCUMENTACIÓN:
- Ver: docs/ANALISIS_CRITICO_VENTAS_INVENTARIO.md
- PostgreSQL Triggers: https://www.postgresql.org/docs/current/triggers.html
*/
