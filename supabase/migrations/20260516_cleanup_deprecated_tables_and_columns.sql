-- ============================================================
-- LIMPIEZA DE BASE DE DATOS - Stocky
-- Fecha: 2026-05-16
-- Descripción: Elimina tablas/vistas/columnas deprecadas sin uso
-- ============================================================

-- ============================================================
-- BLOQUE 1A: Tablas/vistas de facturación electrónica deprecada
-- ============================================================
DROP TABLE IF EXISTS business_siigo_credentials CASCADE;
DROP TABLE IF EXISTS electronic_invoices CASCADE;
DROP TABLE IF EXISTS invoice_items CASCADE;
DROP TABLE IF EXISTS siigo_invoice_logs CASCADE;
DROP TABLE IF EXISTS invoicing_requests CASCADE;
DROP TABLE IF EXISTS deprecated_invoicing_summary CASCADE;
DROP VIEW IF EXISTS v_business_invoicing_status;
DROP VIEW IF EXISTS v_pending_invoicing_requests;
DROP VIEW IF EXISTS v_sales_with_invoices;

-- ============================================================
-- BLOQUE 1B: Tablas/vistas sin uso en código
-- ============================================================
DROP TABLE IF EXISTS activity_logs CASCADE;
DROP TABLE IF EXISTS combo_reference_data_issues CASCADE;
DROP VIEW IF EXISTS sales_receipts;

-- ============================================================
-- BLOQUE 1C: dane_cities (código muerto, sin consumidores)
-- ============================================================
DROP TABLE IF EXISTS dane_cities CASCADE;

-- ============================================================
-- BLOQUE 2A: Columnas deprecadas en sales
-- ============================================================
ALTER TABLE sales 
  DROP COLUMN IF EXISTS electronic_invoice_id,
  DROP COLUMN IF EXISTS is_electronic_invoice,
  DROP COLUMN IF EXISTS invoice_status,
  DROP COLUMN IF EXISTS cufe,
  DROP COLUMN IF EXISTS invoice_number,
  DROP COLUMN IF EXISTS invoice_pdf_url,
  DROP COLUMN IF EXISTS invoice_qr_code,
  DROP COLUMN IF EXISTS invoice_error,
  DROP COLUMN IF EXISTS invoice_date;

-- ============================================================
-- BLOQUE 2B: Columnas deprecadas en businesses
-- ============================================================
ALTER TABLE businesses
  DROP COLUMN IF EXISTS invoicing_enabled,
  DROP COLUMN IF EXISTS invoicing_provider,
  DROP COLUMN IF EXISTS invoicing_activated_at,
  DROP COLUMN IF EXISTS invoicing_activated_by,
  DROP COLUMN IF EXISTS razon_social;

-- ============================================================
-- BLOQUE 2C: siigo_customer_id en customers
-- ============================================================
ALTER TABLE customers
  DROP COLUMN IF EXISTS siigo_customer_id;

-- ============================================================
-- BLOQUE 3A: Eliminar tabla customers (sin código consumidor)
-- ============================================================
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_customer_id_fkey;
DROP TABLE IF EXISTS customers CASCADE;
