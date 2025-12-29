-- =====================================================
-- 🔧 PERMITIR VENTAS CON STOCK INSUFICIENTE
-- =====================================================
-- Ejecutar en Supabase SQL Editor
-- Modifica el trigger para permitir stock negativo
-- Útil para ventas bajo pedido y backorders
-- =====================================================
-- Fecha: 28 de diciembre de 2025
-- =====================================================

-- =====================================================
-- PASO 1: MODIFICAR FUNCIÓN - Permitir stock negativo
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
  v_new_stock NUMERIC;
BEGIN
  -- Obtener stock actual y nombre del producto
  SELECT stock, name INTO v_current_stock, v_product_name
  FROM products
  WHERE id = NEW.product_id;
  
  -- Validar que el producto existe
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Producto % no existe', NEW.product_id;
  END IF;
  
  -- Calcular nuevo stock (puede ser negativo)
  v_new_stock := v_current_stock - NEW.quantity;
  
  -- Reducir stock atómicamente (PERMITE stock negativo)
  UPDATE products
  SET 
    stock = stock - NEW.quantity,
    updated_at = NOW()
  WHERE id = NEW.product_id;
  
  -- Registrar advertencia en logs si stock queda negativo
  IF v_new_stock < 0 THEN
    RAISE WARNING 'ALERTA: Producto "%" (ID: %) quedó con stock negativo: % (Vendió % unidades, solo tenía %)', 
      v_product_name,
      NEW.product_id,
      v_new_stock,
      NEW.quantity,
      v_current_stock;
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION auto_reduce_stock_on_sale IS 
  'Reduce stock automáticamente al insertar sale_detail. PERMITE stock negativo para ventas bajo pedido.';

-- =====================================================
-- PASO 2: VERIFICAR QUE EL TRIGGER EXISTE
-- =====================================================

-- El trigger debería existir, pero lo recreamos por si acaso
DROP TRIGGER IF EXISTS trigger_reduce_stock_on_sale ON sale_details;

CREATE TRIGGER trigger_reduce_stock_on_sale
  AFTER INSERT ON sale_details
  FOR EACH ROW
  EXECUTE FUNCTION auto_reduce_stock_on_sale();

COMMENT ON TRIGGER trigger_reduce_stock_on_sale ON sale_details IS
  'Trigger automático: reduce stock al crear venta (permite stock negativo)';

-- =====================================================
-- PASO 3: OPCIONAL - Crear tabla de alertas de stock
-- =====================================================
-- Descomenta si quieres rastrear productos con stock negativo

/*
CREATE TABLE IF NOT EXISTS stock_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  stock_level NUMERIC NOT NULL,
  alert_type TEXT DEFAULT 'negative_stock',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  notes TEXT
);

-- Índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_stock_alerts_product 
  ON stock_alerts(product_id, created_at DESC);

-- RLS para stock_alerts
ALTER TABLE stock_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view stock alerts for their business" ON stock_alerts;
CREATE POLICY "Users can view stock alerts for their business"
  ON stock_alerts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = stock_alerts.product_id
      AND p.business_id IN (
        SELECT business_id FROM employees WHERE user_id = auth.uid()
        UNION
        SELECT id FROM businesses WHERE created_by = auth.uid()
      )
    )
  );

-- Función para registrar alertas automáticamente
CREATE OR REPLACE FUNCTION log_negative_stock()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.stock < 0 AND (OLD.stock IS NULL OR OLD.stock >= 0) THEN
    INSERT INTO stock_alerts (product_id, stock_level, alert_type, notes)
    VALUES (
      NEW.id, 
      NEW.stock, 
      'negative_stock',
      'Stock cayó a negativo desde ' || COALESCE(OLD.stock::TEXT, '0')
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_log_negative_stock ON products;
CREATE TRIGGER trigger_log_negative_stock
  AFTER UPDATE ON products
  FOR EACH ROW
  WHEN (NEW.stock < 0)
  EXECUTE FUNCTION log_negative_stock();
*/

-- =====================================================
-- VERIFICACIÓN FINAL
-- =====================================================

-- Verificar que el trigger está activo
SELECT 
  tgname as trigger_name,
  tgenabled as enabled,
  proname as function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgrelid = 'sale_details'::regclass
  AND tgname = 'trigger_reduce_stock_on_sale';

-- =====================================================
-- ✅ COMPLETADO
-- =====================================================
-- 
-- Ahora tu aplicación puede:
-- 
-- ✅ Vender productos aunque no haya stock suficiente
-- ✅ El stock puede quedar en negativo (ej: -5)
-- ✅ Los logs de Supabase mostrarán WARNING cuando 
--    un producto quede en negativo
-- ✅ Actualización atómica (sin race conditions)
-- 
-- PRÓXIMOS PASOS:
-- 1. Ejecuta este SQL en Supabase SQL Editor
-- 2. Prueba crear una venta sin stock suficiente
-- 3. Verifica que la venta se crea correctamente
-- 4. Opcional: Descomentar sección de stock_alerts
--    para rastrear productos con stock negativo
-- 
-- =====================================================
