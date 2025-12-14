-- =====================================================
-- DESACTIVAR TODAS LAS RLS
-- =====================================================
-- ⚠️ ADVERTENCIA: Esto desactiva TODA la seguridad
-- Solo usar para debugging o desarrollo local
-- =====================================================

-- OPCIÓN 1: Desactivar RLS en todas las tablas principales
-- =====================================================
ALTER TABLE businesses DISABLE ROW LEVEL SECURITY;
ALTER TABLE employees DISABLE ROW LEVEL SECURITY;
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers DISABLE ROW LEVEL SECURITY;
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE sales DISABLE ROW LEVEL SECURITY;
ALTER TABLE sale_details DISABLE ROW LEVEL SECURITY;
ALTER TABLE purchases DISABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_details DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE tables DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE order_items DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- OPCIÓN 2: Script automático (desactiva TODAS)
-- =====================================================
DO $$
DECLARE
  tabla RECORD;
BEGIN
  FOR tabla IN 
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public'
      AND rowsecurity = true
  LOOP
    EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', tabla.tablename);
    RAISE NOTICE 'RLS desactivado en: %', tabla.tablename;
  END LOOP;
END $$;

-- =====================================================
-- VERIFICACIÓN
-- =====================================================
-- Ver qué tablas tienen RLS activo (debe estar vacío)
SELECT 
  tablename,
  rowsecurity as rls_activo
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = true;

-- =====================================================
-- PARA REACTIVAR DESPUÉS
-- =====================================================
/*
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
*/
