-- ============================================
-- 📝 Migración: Campos de Facturación en Sales
-- ============================================
-- Archivo: supabase/migrations/20260115_sales_invoicing_fields.sql
-- 
-- Agrega campos para soportar facturación electrónica opcional
-- en la tabla de ventas

-- ============================================
-- 1. AGREGAR CAMPOS A TABLA SALES
-- ============================================

-- Tipo de documento generado
ALTER TABLE sales 
ADD COLUMN IF NOT EXISTS document_type TEXT DEFAULT 'receipt';

COMMENT ON COLUMN sales.document_type IS 'Tipo de documento: receipt (comprobante) o invoice (factura electrónica)';

-- Indicador de factura electrónica
ALTER TABLE sales 
ADD COLUMN IF NOT EXISTS is_electronic_invoice BOOLEAN DEFAULT false;

COMMENT ON COLUMN sales.is_electronic_invoice IS 'True si se generó factura electrónica DIAN';

-- Estado de la factura electrónica
ALTER TABLE sales 
ADD COLUMN IF NOT EXISTS invoice_status TEXT;

COMMENT ON COLUMN sales.invoice_status IS 'Estado: pending, success, failed';

-- CUFE (Código Único de Factura Electrónica)
ALTER TABLE sales 
ADD COLUMN IF NOT EXISTS cufe TEXT;

COMMENT ON COLUMN sales.cufe IS 'Código único de factura electrónica DIAN';

-- Número de factura Siigo
ALTER TABLE sales 
ADD COLUMN IF NOT EXISTS invoice_number TEXT;

COMMENT ON COLUMN sales.invoice_number IS 'Número de factura asignado por Siigo';

-- URL del PDF de la factura
ALTER TABLE sales 
ADD COLUMN IF NOT EXISTS invoice_pdf_url TEXT;

COMMENT ON COLUMN sales.invoice_pdf_url IS 'URL para descargar el PDF de la factura';

-- Código QR de verificación
ALTER TABLE sales 
ADD COLUMN IF NOT EXISTS invoice_qr_code TEXT;

COMMENT ON COLUMN sales.invoice_qr_code IS 'Código QR para verificación DIAN';

-- Error de facturación (si falló)
ALTER TABLE sales 
ADD COLUMN IF NOT EXISTS invoice_error TEXT;

COMMENT ON COLUMN sales.invoice_error IS 'Mensaje de error si la factura falló';

-- Fecha de emisión de la factura
ALTER TABLE sales 
ADD COLUMN IF NOT EXISTS invoice_date TIMESTAMPTZ;

COMMENT ON COLUMN sales.invoice_date IS 'Fecha/hora de emisión de la factura electrónica';

-- ID del cliente (para facturas que requieren datos fiscales)
ALTER TABLE sales 
ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id);

COMMENT ON COLUMN sales.customer_id IS 'Referencia al cliente si se generó factura con datos fiscales';

-- ============================================
-- 2. ÍNDICES PARA OPTIMIZACIÓN
-- ============================================

-- Índice para filtrar por tipo de documento
CREATE INDEX IF NOT EXISTS idx_sales_document_type 
ON sales(document_type);

-- Índice para filtrar solo facturas electrónicas
CREATE INDEX IF NOT EXISTS idx_sales_is_electronic_invoice 
ON sales(is_electronic_invoice) 
WHERE is_electronic_invoice = true;

-- Índice para buscar por CUFE
CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_cufe 
ON sales(cufe) 
WHERE cufe IS NOT NULL;

-- Índice para buscar por número de factura
CREATE INDEX IF NOT EXISTS idx_sales_invoice_number 
ON sales(invoice_number) 
WHERE invoice_number IS NOT NULL;

-- Índice para filtrar por estado de factura
CREATE INDEX IF NOT EXISTS idx_sales_invoice_status 
ON sales(invoice_status) 
WHERE invoice_status IS NOT NULL;

-- ============================================
-- 3. CREAR TABLA DE CLIENTES SI NO EXISTE
-- ============================================

-- Tabla de clientes para facturación
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  
  -- Datos de identificación
  id_type TEXT NOT NULL DEFAULT 'CC',
  identification TEXT NOT NULL,
  
  -- Datos personales/empresariales
  first_name TEXT NOT NULL,
  last_name TEXT,
  company_name TEXT,
  
  -- Contacto
  email TEXT,
  phone TEXT,
  
  -- Dirección
  address TEXT,
  city_code TEXT,
  city_name TEXT,
  
  -- Metadatos
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  
  -- Siigo customer ID (para reutilizar cliente en Siigo)
  siigo_customer_id TEXT,
  
  CONSTRAINT customers_business_identification_unique 
    UNIQUE(business_id, identification)
);

-- Comentarios
COMMENT ON TABLE customers IS 'Clientes del negocio para facturación electrónica';
COMMENT ON COLUMN customers.id_type IS 'Tipo de documento: CC, NIT, CE, PP, TI';
COMMENT ON COLUMN customers.siigo_customer_id IS 'ID del cliente en Siigo para no duplicar';

-- Índices para customers
CREATE INDEX IF NOT EXISTS idx_customers_business 
ON customers(business_id);

CREATE INDEX IF NOT EXISTS idx_customers_identification 
ON customers(business_id, identification);

CREATE INDEX IF NOT EXISTS idx_customers_email 
ON customers(business_id, email) 
WHERE email IS NOT NULL;

-- ============================================
-- 4. RLS PARA CUSTOMERS
-- ============================================

-- Habilitar RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Política: Empleados pueden ver clientes de su negocio
CREATE POLICY customers_select_policy ON customers
FOR SELECT
TO authenticated
USING (
  business_id IN (
    SELECT business_id FROM employees 
    WHERE user_id = auth.uid() 
    AND is_active = true
  )
  OR
  business_id IN (
    SELECT id FROM businesses 
    WHERE created_by = auth.uid()
  )
);

-- Política: Empleados pueden insertar clientes en su negocio
CREATE POLICY customers_insert_policy ON customers
FOR INSERT
TO authenticated
WITH CHECK (
  business_id IN (
    SELECT business_id FROM employees 
    WHERE user_id = auth.uid() 
    AND is_active = true
  )
  OR
  business_id IN (
    SELECT id FROM businesses 
    WHERE created_by = auth.uid()
  )
);

-- Política: Solo admins pueden actualizar clientes
CREATE POLICY customers_update_policy ON customers
FOR UPDATE
TO authenticated
USING (
  business_id IN (
    SELECT business_id FROM employees 
    WHERE user_id = auth.uid() 
    AND is_active = true
    AND role IN ('admin', 'owner')
  )
  OR
  business_id IN (
    SELECT id FROM businesses 
    WHERE created_by = auth.uid()
  )
);

-- ============================================
-- 5. TRIGGER PARA UPDATED_AT
-- ============================================

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_customers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger
DROP TRIGGER IF EXISTS trigger_customers_updated_at ON customers;
CREATE TRIGGER trigger_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION update_customers_updated_at();

-- ============================================
-- 6. VISTA PARA FACTURAS ELECTRÓNICAS (RESUMEN)
-- ============================================
-- NOTA: La tabla electronic_invoices está definida en 
-- 20260114_invoicing_managed_model.sql
-- Esta vista es un resumen de ventas con factura

CREATE OR REPLACE VIEW v_sales_with_invoices AS
SELECT 
  s.id,
  s.business_id,
  s.invoice_number,
  s.cufe,
  s.total,
  s.invoice_status,
  s.invoice_date,
  s.invoice_pdf_url,
  s.invoice_qr_code,
  s.payment_method,
  c.first_name || ' ' || COALESCE(c.last_name, '') AS customer_name,
  c.identification AS customer_identification,
  c.email AS customer_email,
  s.created_at,
  b.name AS business_name
FROM sales s
LEFT JOIN customers c ON s.customer_id = c.id
LEFT JOIN businesses b ON s.business_id = b.id
WHERE s.is_electronic_invoice = true
  AND s.invoice_status = 'success';

COMMENT ON VIEW v_sales_with_invoices IS 'Vista de ventas con factura electrónica exitosa';

-- ============================================
-- RESULTADO
-- ============================================
-- ✅ Campos de facturación agregados a sales
-- ✅ Tabla customers creada
-- ✅ Índices de optimización
-- ✅ Políticas RLS
-- ✅ Vista de facturas electrónicas
