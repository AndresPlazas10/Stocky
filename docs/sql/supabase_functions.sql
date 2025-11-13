-- =====================================================
-- FUNCIONES NECESARIAS PARA FACTURACIÓN EN SUPABASE
-- =====================================================
-- Ejecuta este script en el SQL Editor de Supabase
-- =====================================================

-- 1. Función para generar números de factura secuenciales
-- =====================================================
CREATE OR REPLACE FUNCTION generate_invoice_number(p_business_id UUID)
RETURNS TEXT AS $$
DECLARE
  last_number INTEGER;
  new_number TEXT;
BEGIN
  -- Obtener el último número de factura del negocio
  SELECT 
    COALESCE(
      MAX(CAST(SUBSTRING(invoice_number FROM '[0-9]+$') AS INTEGER)), 
      0
    )
  INTO last_number
  FROM invoices
  WHERE business_id = p_business_id;
  
  -- Generar el nuevo número (incrementar + 1)
  new_number := 'FAC-' || LPAD((last_number + 1)::TEXT, 6, '0');
  
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- 2. Función para reducir stock de productos
-- =====================================================
CREATE OR REPLACE FUNCTION reduce_stock(p_product_id UUID, p_quantity NUMERIC)
RETURNS VOID AS $$
BEGIN
  -- Verificar que hay suficiente stock
  IF (SELECT stock FROM products WHERE id = p_product_id) < p_quantity THEN
    RAISE EXCEPTION 'Stock insuficiente para el producto';
  END IF;
  
  -- Reducir el stock
  UPDATE products
  SET 
    stock = stock - p_quantity,
    updated_at = NOW()
  WHERE id = p_product_id;
  
  -- Registrar el movimiento (si existe tabla de movimientos)
  -- INSERT INTO inventory_movements (...) VALUES (...);
END;
$$ LANGUAGE plpgsql;

-- 3. Función para aumentar stock de productos
-- =====================================================
CREATE OR REPLACE FUNCTION increase_stock(p_product_id UUID, p_quantity NUMERIC)
RETURNS VOID AS $$
BEGIN
  -- Aumentar el stock
  UPDATE products
  SET 
    stock = stock + p_quantity,
    updated_at = NOW()
  WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql;

-- 4. Función para restaurar stock al cancelar factura
-- =====================================================
CREATE OR REPLACE FUNCTION restore_stock_from_invoice(p_invoice_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Restaurar stock de todos los items de la factura
  UPDATE products p
  SET 
    stock = stock + ii.quantity,
    updated_at = NOW()
  FROM invoice_items ii
  WHERE 
    ii.invoice_id = p_invoice_id 
    AND ii.product_id = p.id;
END;
$$ LANGUAGE plpgsql;

-- 5. Crear trigger para restaurar stock al cancelar factura (opcional)
-- =====================================================
CREATE OR REPLACE FUNCTION trigger_restore_stock_on_cancel()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo restaurar si el estado cambia a 'cancelled'
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    PERFORM restore_stock_from_invoice(NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear el trigger (eliminar si ya existe)
DROP TRIGGER IF EXISTS invoice_cancel_restore_stock ON invoices;

CREATE TRIGGER invoice_cancel_restore_stock
  AFTER UPDATE ON invoices
  FOR EACH ROW
  WHEN (NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled')
  EXECUTE FUNCTION trigger_restore_stock_on_cancel();

-- =====================================================
-- VERIFICAR QUE LAS TABLAS EXISTEN
-- =====================================================
-- Ejecuta estas consultas para verificar la estructura

-- Verificar tabla invoices
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'invoices'
ORDER BY ordinal_position;

-- Agregar columna sent_at si no existe (para registrar cuándo se envió la factura)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invoices' AND column_name = 'sent_at'
  ) THEN
    ALTER TABLE invoices ADD COLUMN sent_at TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- Agregar columna cancelled_at si no existe (para registrar cuándo se canceló)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invoices' AND column_name = 'cancelled_at'
  ) THEN
    ALTER TABLE invoices ADD COLUMN cancelled_at TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- Verificar tabla invoice_items
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'invoice_items'
ORDER BY ordinal_position;

-- Verificar tabla customers (puede no existir)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'customers'
ORDER BY ordinal_position;

-- =====================================================
-- SCRIPT PARA CREAR TABLA CUSTOMERS (si no existe)
-- =====================================================
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  id_number TEXT,
  address TEXT,
  city TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para optimizar búsquedas
CREATE INDEX IF NOT EXISTS idx_customers_business_id ON customers(business_id);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_id_number ON customers(id_number);

-- RLS (Row Level Security) para customers
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Policy para que los usuarios solo vean sus clientes (eliminar si ya existe)
DROP POLICY IF EXISTS customers_business_isolation ON customers;

CREATE POLICY customers_business_isolation ON customers
  USING (
    business_id IN (
      SELECT business_id FROM users WHERE id = auth.uid()
      UNION
      SELECT business_id FROM employees WHERE user_id = auth.uid()
    )
  );
