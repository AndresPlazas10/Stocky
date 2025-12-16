-- 🔧 FIX: FECHAS NULL EN TABLAS PRINCIPALES
-- Este script actualiza todas las fechas NULL con valores por defecto

-- ⚠️ IMPORTANTE: Ejecuta este script COMPLETO en Supabase SQL Editor

BEGIN;

-- 1️⃣ SALES (ventas) - CRÍTICO
UPDATE sales 
SET created_at = NOW() - (RANDOM() * INTERVAL '30 days')
WHERE created_at IS NULL;

-- 2️⃣ PURCHASES (compras)
UPDATE purchases 
SET created_at = NOW() - (RANDOM() * INTERVAL '30 days')
WHERE created_at IS NULL;

-- 3️⃣ PRODUCTS (productos)
UPDATE products 
SET created_at = NOW() - (RANDOM() * INTERVAL '60 days')
WHERE created_at IS NULL;

-- 4️⃣ INVOICES (facturas)
UPDATE invoices 
SET created_at = NOW() - (RANDOM() * INTERVAL '30 days')
WHERE created_at IS NULL;

UPDATE invoices 
SET issued_at = NOW() - (RANDOM() * INTERVAL '30 days')
WHERE issued_at IS NULL;

-- 5️⃣ CUSTOMERS (clientes)
UPDATE customers 
SET created_at = NOW() - (RANDOM() * INTERVAL '90 days')
WHERE created_at IS NULL;

-- 6️⃣ SUPPLIERS (proveedores)
UPDATE suppliers 
SET created_at = NOW() - (RANDOM() * INTERVAL '90 days')
WHERE created_at IS NULL;

-- 7️⃣ EMPLOYEES (empleados)
UPDATE employees 
SET created_at = NOW() - (RANDOM() * INTERVAL '120 days')
WHERE created_at IS NULL;

-- 8️⃣ BUSINESSES (negocios)
UPDATE businesses 
SET created_at = NOW() - (RANDOM() * INTERVAL '180 days')
WHERE created_at IS NULL;

COMMIT;

-- ✅ VERIFICACIÓN FINAL
-- Ejecuta esto después del COMMIT para verificar que todo está correcto

SELECT 
  'sales' as tabla,
  COUNT(*) as total,
  COUNT(created_at) as con_fecha,
  COUNT(*) - COUNT(created_at) as sin_fecha
FROM sales
UNION ALL
SELECT 
  'purchases',
  COUNT(*),
  COUNT(created_at),
  COUNT(*) - COUNT(created_at)
FROM purchases
UNION ALL
SELECT 
  'products',
  COUNT(*),
  COUNT(created_at),
  COUNT(*) - COUNT(created_at)
FROM products
UNION ALL
SELECT 
  'invoices',
  COUNT(*),
  COUNT(created_at),
  COUNT(*) - COUNT(created_at)
FROM invoices
UNION ALL
SELECT 
  'customers',
  COUNT(*),
  COUNT(created_at),
  COUNT(*) - COUNT(created_at)
FROM customers
UNION ALL
SELECT 
  'suppliers',
  COUNT(*),
  COUNT(created_at),
  COUNT(*) - COUNT(created_at)
FROM suppliers
UNION ALL
SELECT 
  'employees',
  COUNT(*),
  COUNT(created_at),
  COUNT(*) - COUNT(created_at)
FROM employees
UNION ALL
SELECT 
  'businesses',
  COUNT(*),
  COUNT(created_at),
  COUNT(*) - COUNT(created_at)
FROM businesses;

-- ✅ Resultado esperado: Columna "sin_fecha" debe ser 0 en todas las tablas
