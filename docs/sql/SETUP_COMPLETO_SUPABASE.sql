-- =====================================================
-- � DIAGNÓSTICO Y SETUP BASE - STOCKLY
-- =====================================================
-- Script para obtener información de la base de datos
-- y crear estructura base (tablas, funciones, índices)
-- NO crea políticas RLS - solo información para análisis
-- Versión: 2.0 - Diciembre 2025
-- =====================================================

-- =====================================================
-- PARTE 1: ANÁLISIS DEL PROYECTO
-- =====================================================

/*
ESTRUCTURA DEL PROYECTO STOCKLY:
=================================

AUTENTICACIÓN:
- Supabase Auth maneja usuarios (auth.users)
- NO existe tabla 'users' en public schema
- user_id siempre referencia auth.users.id (UUID)

MODELO DE DATOS:
- 1 Usuario puede ser owner de N negocios
- 1 Usuario puede ser empleado en M negocios
- Cada negocio tiene productos, ventas, compras, clientes, etc.

JERARQUÍA DE ACCESO:
1. Owner (created_by en businesses) → Acceso total a SU negocio
2. Admin (role='admin' en employees) → Acceso total al negocio
3. Empleado regular (role='employee') → Acceso según permisos
4. Cajero (role='cashier') → Solo ventas

PROBLEMAS COMUNES RLS:
1. Recursión infinita (businesses → employees → businesses)
2. Subconsultas lentas en políticas
3. FK a auth.users (no permitido)
4. Políticas muy restrictivas que bloquean operaciones válidas
*/

-- =====================================================
-- PARTE 2: EXTENSIONES NECESARIAS
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- Para búsquedas con ILIKE

-- =====================================================
-- PARTE 3: TIPOS ENUM
-- =====================================================

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'employee_role') THEN
    CREATE TYPE employee_role AS ENUM ('owner', 'admin', 'employee', 'cashier');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_status') THEN
    CREATE TYPE invoice_status AS ENUM ('draft', 'sent', 'paid', 'cancelled', 'overdue');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
    CREATE TYPE order_status AS ENUM ('open', 'closed', 'cancelled');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'table_status') THEN
    CREATE TYPE table_status AS ENUM ('available', 'occupied', 'reserved');
  END IF;
END $$;

-- =====================================================
-- PARTE 4: CREAR TABLAS (SI NO EXISTEN)
-- =====================================================

-- TABLA: businesses
-- =====================================================
CREATE TABLE IF NOT EXISTS businesses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL, -- Para URL personalizada
  email TEXT UNIQUE NOT NULL,
  address TEXT,
  phone TEXT,
  logo_url TEXT,
  created_by UUID NOT NULL, -- auth.users.id (sin FK)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE businesses IS 'Negocios/empresas registrados en el sistema';
COMMENT ON COLUMN businesses.created_by IS 'Usuario owner del negocio (auth.users.id)';

-- TABLA: employees
-- =====================================================
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL, -- auth.users.id (sin FK)
  full_name TEXT NOT NULL,
  username TEXT NOT NULL,
  email TEXT NOT NULL,
  role employee_role DEFAULT 'employee',
  is_active BOOLEAN DEFAULT true,
  access_code TEXT, -- Código de acceso para empleados
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, user_id), -- Un usuario no puede duplicarse en el mismo negocio
  UNIQUE(business_id, username), -- Username único por negocio
  UNIQUE(business_id, email) -- Email único por negocio
);

COMMENT ON TABLE employees IS 'Empleados vinculados a negocios';
COMMENT ON COLUMN employees.user_id IS 'Usuario autenticado (auth.users.id)';
COMMENT ON COLUMN employees.access_code IS 'Código único para acceso de empleados';

-- TABLA: products
-- =====================================================
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  description TEXT,
  category TEXT,
  price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
  stock NUMERIC(12, 2) DEFAULT 0 CHECK (stock >= 0),
  min_stock NUMERIC(12, 2) DEFAULT 0,
  image_url TEXT,
  barcode TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, code) -- Código único por negocio
);

COMMENT ON TABLE products IS 'Catálogo de productos por negocio';

-- TABLA: suppliers
-- =====================================================
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  tax_id TEXT, -- NIT o RUT
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE suppliers IS 'Proveedores de productos';

-- TABLA: customers
-- =====================================================
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  id_number TEXT, -- Cédula o documento
  address TEXT,
  city TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE customers IS 'Clientes de los negocios';

-- TABLA: sales
-- =====================================================
CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL, -- auth.users.id (quien registró la venta)
  seller_name TEXT, -- Nombre del vendedor (admin o empleado)
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  payment_method TEXT DEFAULT 'cash',
  total NUMERIC(12, 2) NOT NULL CHECK (total >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE sales IS 'Registro de ventas realizadas';
COMMENT ON COLUMN sales.seller_name IS 'Nombre del vendedor ("Administrador" o nombre empleado)';

-- TABLA: sale_details
-- =====================================================
CREATE TABLE IF NOT EXISTS sale_details (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity NUMERIC(12, 2) NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
  subtotal NUMERIC(12, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE sale_details IS 'Detalle de productos vendidos por venta';

-- TABLA: purchases
-- =====================================================
CREATE TABLE IF NOT EXISTS purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL, -- auth.users.id (quien registró la compra)
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  payment_method TEXT DEFAULT 'efectivo',
  total NUMERIC(12, 2) NOT NULL CHECK (total >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE purchases IS 'Registro de compras a proveedores';
COMMENT ON COLUMN purchases.user_id IS 'Usuario que registró la compra (auth.users.id)';

-- TABLA: purchase_details
-- =====================================================
CREATE TABLE IF NOT EXISTS purchase_details (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity NUMERIC(12, 2) NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
  subtotal NUMERIC(12, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE purchase_details IS 'Detalle de productos comprados por compra';

-- TABLA: invoices
-- =====================================================
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  invoice_number TEXT NOT NULL,
  status invoice_status DEFAULT 'draft',
  subtotal NUMERIC(12, 2) DEFAULT 0 CHECK (subtotal >= 0),
  tax NUMERIC(12, 2) DEFAULT 0 CHECK (tax >= 0),
  total NUMERIC(12, 2) NOT NULL CHECK (total >= 0),
  issue_date DATE DEFAULT CURRENT_DATE,
  due_date DATE,
  notes TEXT,
  sent_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, invoice_number) -- Número único por negocio
);

COMMENT ON TABLE invoices IS 'Facturas emitidas a clientes';

-- TABLA: invoice_items
-- =====================================================
CREATE TABLE IF NOT EXISTS invoice_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity NUMERIC(12, 2) NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
  subtotal NUMERIC(12, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE invoice_items IS 'Detalle de items facturados';

-- TABLA: tables (mesas para restaurantes)
-- =====================================================
CREATE TABLE IF NOT EXISTS tables (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  table_number INTEGER NOT NULL,
  table_name TEXT,
  capacity INTEGER DEFAULT 4,
  status table_status DEFAULT 'available',
  current_order_id UUID, -- Referencia circular, se agrega FK después
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, table_number) -- Número único por negocio
);

COMMENT ON TABLE tables IS 'Mesas de restaurantes';

-- TABLA: orders (órdenes/comandas)
-- =====================================================
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  table_id UUID REFERENCES tables(id) ON DELETE SET NULL,
  user_id UUID NOT NULL, -- Quien abrió la orden
  customer_name TEXT,
  status order_status DEFAULT 'open',
  total NUMERIC(12, 2) DEFAULT 0 CHECK (total >= 0),
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE orders IS 'Órdenes/comandas de mesas';

-- Agregar FK circular tables → orders
ALTER TABLE tables 
  DROP CONSTRAINT IF EXISTS tables_current_order_fkey;

ALTER TABLE tables 
  ADD CONSTRAINT tables_current_order_fkey 
  FOREIGN KEY (current_order_id) 
  REFERENCES orders(id) 
  ON DELETE SET NULL;

-- TABLA: order_items
-- =====================================================
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity NUMERIC(12, 2) NOT NULL CHECK (quantity > 0),
  price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
  subtotal NUMERIC(12, 2) GENERATED ALWAYS AS (quantity * price) STORED,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE order_items IS 'Items de órdenes de mesas';

-- TABLA: idempotency_requests (prevención de duplicados)
-- =====================================================
CREATE TABLE IF NOT EXISTS idempotency_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  idempotency_key VARCHAR(255) NOT NULL UNIQUE,
  action_name VARCHAR(100) NOT NULL,
  user_id UUID, -- auth.users.id
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  request_payload JSONB,
  response_payload JSONB,
  status VARCHAR(20) NOT NULL CHECK (status IN ('processing', 'completed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
);

COMMENT ON TABLE idempotency_requests IS 'Tracking de requests para prevenir duplicados';

-- =====================================================
-- VERIFICAR Y AGREGAR COLUMNAS FALTANTES
-- =====================================================
-- IMPORTANTE: Esto debe ejecutarse ANTES de crear índices
-- para asegurar que las columnas existan

-- Agregar access_code a employees si no existe
DO $$ 
BEGIN
  -- Intentar agregar la columna
  BEGIN
    ALTER TABLE employees ADD COLUMN access_code TEXT;
    RAISE NOTICE '✅ Columna access_code agregada a employees';
  EXCEPTION
    WHEN duplicate_column THEN
      RAISE NOTICE 'ℹ️  Columna access_code ya existe en employees';
  END;
END $$;

-- Agregar seller_name a sales si no existe
DO $$ 
BEGIN
  -- Intentar agregar la columna
  BEGIN
    ALTER TABLE sales ADD COLUMN seller_name TEXT;
    RAISE NOTICE '✅ Columna seller_name agregada a sales';
  EXCEPTION
    WHEN duplicate_column THEN
      RAISE NOTICE 'ℹ️  Columna seller_name ya existe en sales';
  END;
END $$;

-- =====================================================
-- PARTE 5: ÍNDICES PARA PERFORMANCE
-- =====================================================

-- BUSINESSES
CREATE INDEX IF NOT EXISTS idx_businesses_created_by ON businesses(created_by);
CREATE INDEX IF NOT EXISTS idx_businesses_username ON businesses(LOWER(username));
CREATE INDEX IF NOT EXISTS idx_businesses_email ON businesses(LOWER(email));

-- EMPLOYEES
CREATE INDEX IF NOT EXISTS idx_employees_business_id ON employees(business_id);
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON employees(user_id);
CREATE INDEX IF NOT EXISTS idx_employees_business_user ON employees(business_id, user_id);
CREATE INDEX IF NOT EXISTS idx_employees_access_code ON employees(access_code) WHERE access_code IS NOT NULL;

-- PRODUCTS
CREATE INDEX IF NOT EXISTS idx_products_business_id ON products(business_id);
CREATE INDEX IF NOT EXISTS idx_products_code ON products(business_id, code);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(business_id, category);
CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode) WHERE barcode IS NOT NULL;

-- SALES
CREATE INDEX IF NOT EXISTS idx_sales_business_id ON sales(business_id);
CREATE INDEX IF NOT EXISTS idx_sales_user_id ON sales(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_business_date ON sales(business_id, created_at DESC);

-- SALE_DETAILS
CREATE INDEX IF NOT EXISTS idx_sale_details_sale_id ON sale_details(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_details_product_id ON sale_details(product_id);

-- PURCHASES
CREATE INDEX IF NOT EXISTS idx_purchases_business_id ON purchases(business_id);
CREATE INDEX IF NOT EXISTS idx_purchases_user_id ON purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier_id ON purchases(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchases_created_at ON purchases(created_at DESC);

-- PURCHASE_DETAILS
CREATE INDEX IF NOT EXISTS idx_purchase_details_purchase_id ON purchase_details(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_details_product_id ON purchase_details(product_id);

-- INVOICES
CREATE INDEX IF NOT EXISTS idx_invoices_business_id ON invoices(business_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(business_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(business_id, invoice_number);

-- INVOICE_ITEMS
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_product_id ON invoice_items(product_id);

-- TABLES
CREATE INDEX IF NOT EXISTS idx_tables_business_id ON tables(business_id);
CREATE INDEX IF NOT EXISTS idx_tables_status ON tables(business_id, status);

-- ORDERS
CREATE INDEX IF NOT EXISTS idx_orders_business_id ON orders(business_id);
CREATE INDEX IF NOT EXISTS idx_orders_table_id ON orders(table_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(business_id, status);

-- ORDER_ITEMS
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

-- IDEMPOTENCY
CREATE INDEX IF NOT EXISTS idx_idempotency_key ON idempotency_requests(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_idempotency_user ON idempotency_requests(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_idempotency_expires ON idempotency_requests(expires_at) WHERE status = 'processing';

-- =====================================================
-- PARTE 6: CONSTRAINTS ÚNICOS ADICIONALES
-- =====================================================

-- Prevenir ventas duplicadas idénticas en el mismo segundo
CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_prevent_duplicates 
  ON sales (business_id, user_id, total, created_at);

-- Prevenir compras duplicadas idénticas
CREATE UNIQUE INDEX IF NOT EXISTS idx_purchases_prevent_duplicates 
  ON purchases (business_id, user_id, total, created_at);

-- Username único (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS idx_businesses_username_lower 
  ON businesses (LOWER(username));

CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_username_business_lower 
  ON employees (business_id, LOWER(username));

-- =====================================================
-- PARTE 7: FUNCIONES HELPER (SIN RLS)
-- =====================================================

-- Función: Obtener IDs de negocios del usuario
-- =====================================================
CREATE OR REPLACE FUNCTION get_user_business_ids()
RETURNS TABLE(business_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Negocios donde soy owner
  SELECT id FROM businesses WHERE created_by = auth.uid()
  UNION
  -- Negocios donde soy empleado activo
  SELECT business_id FROM employees WHERE user_id = auth.uid() AND is_active = true;
$$;

COMMENT ON FUNCTION get_user_business_ids() IS 
  'Retorna IDs de negocios donde el usuario es owner o empleado activo. SECURITY DEFINER para evitar recursión RLS.';

GRANT EXECUTE ON FUNCTION get_user_business_ids() TO authenticated;

-- Función: Generar número de factura
-- =====================================================
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
  IF p_business_id IS NULL THEN
    RAISE EXCEPTION 'business_id no puede ser NULL';
  END IF;

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
  FROM invoices AS i
  WHERE i.business_id = p_business_id;
  
  v_new_number := 'FAC-' || LPAD((v_last_number + 1)::TEXT, 6, '0');
  
  RETURN v_new_number;
END;
$$;

COMMENT ON FUNCTION generate_invoice_number(UUID) IS 
  'Genera números consecutivos de factura. Formato: FAC-XXXXXX';

GRANT EXECUTE ON FUNCTION generate_invoice_number(UUID) TO authenticated;

-- Función: Limpiar idempotency expirado
-- =====================================================
CREATE OR REPLACE FUNCTION cleanup_expired_idempotency_requests()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM idempotency_requests WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION cleanup_expired_idempotency_requests() IS
  'Limpia requests de idempotency expiradas (>24h)';

-- Función: Verificar idempotency
-- =====================================================
CREATE OR REPLACE FUNCTION check_idempotency(
  p_idempotency_key VARCHAR(255),
  p_action_name VARCHAR(100),
  p_user_id UUID DEFAULT auth.uid(),
  p_business_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing RECORD;
BEGIN
  SELECT * INTO v_existing
  FROM idempotency_requests
  WHERE idempotency_key = p_idempotency_key;
  
  -- Request completada
  IF FOUND AND v_existing.status = 'completed' THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'duplicate_request',
      'cached_result', v_existing.response_payload
    );
  END IF;
  
  -- Request en progreso (timeout 5 min)
  IF FOUND AND v_existing.status = 'processing' THEN
    IF v_existing.created_at < NOW() - INTERVAL '5 minutes' THEN
      UPDATE idempotency_requests
      SET status = 'failed', error_message = 'Timeout'
      WHERE idempotency_key = p_idempotency_key;
      
      RETURN jsonb_build_object('allowed', true, 'reason', 'retry_after_timeout');
    ELSE
      RETURN jsonb_build_object('allowed', false, 'reason', 'request_in_progress');
    END IF;
  END IF;
  
  -- Request fallida (permitir retry)
  IF FOUND AND v_existing.status = 'failed' THEN
    UPDATE idempotency_requests
    SET status = 'processing', created_at = NOW()
    WHERE idempotency_key = p_idempotency_key;
    
    RETURN jsonb_build_object('allowed', true, 'reason', 'retry_after_failure');
  END IF;
  
  -- Primera vez
  INSERT INTO idempotency_requests (
    idempotency_key, action_name, user_id, business_id, status
  ) VALUES (
    p_idempotency_key, p_action_name, p_user_id, p_business_id, 'processing'
  );
  
  RETURN jsonb_build_object('allowed', true, 'reason', 'first_request');
END;
$$;

GRANT EXECUTE ON FUNCTION check_idempotency TO authenticated;

-- Función: Completar idempotency
-- =====================================================
CREATE OR REPLACE FUNCTION complete_idempotency(
  p_idempotency_key VARCHAR(255),
  p_response_payload JSONB DEFAULT NULL,
  p_success BOOLEAN DEFAULT true,
  p_error_message TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE idempotency_requests
  SET 
    status = CASE WHEN p_success THEN 'completed' ELSE 'failed' END,
    response_payload = p_response_payload,
    error_message = p_error_message,
    completed_at = NOW()
  WHERE idempotency_key = p_idempotency_key AND status = 'processing';
  
  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION complete_idempotency TO authenticated;

-- =====================================================
-- PARTE 8: HABILITAR ROW LEVEL SECURITY (SIN POLÍTICAS)
-- =====================================================
-- Solo habilitamos RLS para poder ver el estado
-- Las políticas se crearán después del análisis

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
ALTER TABLE idempotency_requests ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PARTE 9: INFORMACIÓN DE TABLAS Y ESTRUCTURA
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '=============================================';
  RAISE NOTICE '📊 INFORMACIÓN DE LA BASE DE DATOS';
  RAISE NOTICE '=============================================';
  RAISE NOTICE '';
  RAISE NOTICE '✅ RLS HABILITADO en todas las tablas';
  RAISE NOTICE '⚠️  NO se han creado políticas RLS aún';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Usa las queries de diagnóstico al final';
  RAISE NOTICE '   para analizar el estado actual';
  RAISE NOTICE '=============================================';
END $$;

-- =====================================================
-- PARTE 10: TRIGGERS PARA PREVENCIÓN DE DUPLICADOS
-- =====================================================

-- Trigger: Prevenir negocios duplicados en 60 segundos
CREATE OR REPLACE FUNCTION prevent_duplicate_business_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_recent_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_recent_count
  FROM businesses
  WHERE created_by = NEW.created_by
    AND created_at > NOW() - INTERVAL '60 seconds';
  
  IF v_recent_count > 0 THEN
    RAISE EXCEPTION 'Ya creaste un negocio recientemente. Espera 60 segundos.'
      USING ERRCODE = '23505';
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_prevent_duplicate_business ON businesses;
CREATE TRIGGER trigger_prevent_duplicate_business
  BEFORE INSERT ON businesses
  FOR EACH ROW
  EXECUTE FUNCTION prevent_duplicate_business_creation();

-- Trigger: Prevenir empleados duplicados en 30 segundos
CREATE OR REPLACE FUNCTION prevent_duplicate_employee_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_recent_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_recent_count
  FROM employees
  WHERE business_id = NEW.business_id
    AND LOWER(username) = LOWER(NEW.username)
    AND created_at > NOW() - INTERVAL '30 seconds';
  
  IF v_recent_count > 0 THEN
    RAISE EXCEPTION 'Ya existe un empleado con este username creado recientemente.'
      USING ERRCODE = '23505';
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_prevent_duplicate_employee ON employees;
CREATE TRIGGER trigger_prevent_duplicate_employee
  BEFORE INSERT ON employees
  FOR EACH ROW
  EXECUTE FUNCTION prevent_duplicate_employee_creation();

-- =====================================================
-- PARTE 11: GRANTS FINALES
-- =====================================================

-- Permitir acceso a tablas para authenticated
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- =====================================================
-- PARTE 12: VERIFICACIÓN Y DIAGNÓSTICO
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '=============================================';
  RAISE NOTICE '✅ SETUP BASE COMPLETO - STOCKLY';
  RAISE NOTICE '=============================================';
  RAISE NOTICE '';
  RAISE NOTICE '📊 TABLAS CREADAS:';
  RAISE NOTICE '   - businesses';
  RAISE NOTICE '   - employees';
  RAISE NOTICE '   - products';
  RAISE NOTICE '   - suppliers';
  RAISE NOTICE '   - customers';
  RAISE NOTICE '   - sales + sale_details';
  RAISE NOTICE '   - purchases + purchase_details';
  RAISE NOTICE '   - invoices + invoice_items';
  RAISE NOTICE '   - tables + orders + order_items';
  RAISE NOTICE '   - idempotency_requests';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 RLS HABILITADO (sin políticas aún)';
  RAISE NOTICE '';
  RAISE NOTICE '⚡ ÍNDICES Y FUNCIONES creados';
  RAISE NOTICE '';
  RAISE NOTICE '🛡️  PROTECCIONES ACTIVAS:';
  RAISE NOTICE '   - Prevención de duplicados (triggers)';
  RAISE NOTICE '   - Idempotency tracking (24h TTL)';
  RAISE NOTICE '   - Constraints únicos';
  RAISE NOTICE '';
  RAISE NOTICE '📋 SIGUIENTE PASO:';
  RAISE NOTICE '   Ejecuta las queries de diagnóstico';
  RAISE NOTICE '   para analizar el estado actual y';
  RAISE NOTICE '   crear políticas RLS apropiadas';
  RAISE NOTICE '';
  RAISE NOTICE '=============================================';
END $$;

-- =====================================================
-- QUERIES DE DIAGNÓSTICO - INFORMACIÓN COMPLETA
-- =====================================================

-- =====================================================
-- 1. RESUMEN DE TABLAS Y RLS
-- =====================================================

SELECT 
  '=== TABLAS CON RLS HABILITADO ===' AS info;

SELECT 
  tablename AS tabla,
  CASE 
    WHEN rowsecurity THEN '✅ HABILITADO'
    ELSE '❌ DESHABILITADO'
  END AS rls_status,
  (SELECT COUNT(*) FROM pg_policies p WHERE p.tablename = t.tablename) AS num_policies
FROM pg_tables t
WHERE schemaname = 'public'
  AND tablename NOT LIKE 'pg_%'
ORDER BY tablename;

-- =====================================================
-- 2. POLÍTICAS RLS EXISTENTES (SI HAY)
-- =====================================================

SELECT 
  '=== POLÍTICAS RLS ACTUALES ===' AS info;

SELECT 
  tablename AS tabla,
  policyname AS politica,
  cmd AS operacion,
  permissive AS tipo,
  roles,
  CASE 
    WHEN qual IS NOT NULL THEN 'Tiene USING'
    ELSE 'Sin USING'
  END AS using_clause,
  CASE 
    WHEN with_check IS NOT NULL THEN 'Tiene WITH CHECK'
    ELSE 'Sin WITH CHECK'
  END AS with_check_clause
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- =====================================================
-- 3. ESTRUCTURA DE CADA TABLA
-- =====================================================

SELECT 
  '=== ESTRUCTURA: BUSINESSES ===' AS info;

SELECT 
  column_name AS columna,
  data_type AS tipo,
  is_nullable AS nullable,
  column_default AS default_value
FROM information_schema.columns
WHERE table_name = 'businesses' AND table_schema = 'public'
ORDER BY ordinal_position;

SELECT 
  '=== ESTRUCTURA: EMPLOYEES ===' AS info;

SELECT 
  column_name AS columna,
  data_type AS tipo,
  is_nullable AS nullable,
  column_default AS default_value
FROM information_schema.columns
WHERE table_name = 'employees' AND table_schema = 'public'
ORDER BY ordinal_position;

SELECT 
  '=== ESTRUCTURA: PRODUCTS ===' AS info;

SELECT 
  column_name AS columna,
  data_type AS tipo,
  is_nullable AS nullable,
  column_default AS default_value
FROM information_schema.columns
WHERE table_name = 'products' AND table_schema = 'public'
ORDER BY ordinal_position;

SELECT 
  '=== ESTRUCTURA: SALES ===' AS info;

SELECT 
  column_name AS columna,
  data_type AS tipo,
  is_nullable AS nullable,
  column_default AS default_value
FROM information_schema.columns
WHERE table_name = 'sales' AND table_schema = 'public'
ORDER BY ordinal_position;

SELECT 
  '=== ESTRUCTURA: PURCHASES ===' AS info;

SELECT 
  column_name AS columna,
  data_type AS tipo,
  is_nullable AS nullable,
  column_default AS default_value
FROM information_schema.columns
WHERE table_name = 'purchases' AND table_schema = 'public'
ORDER BY ordinal_position;

SELECT 
  '=== ESTRUCTURA: INVOICES ===' AS info;

SELECT 
  column_name AS columna,
  data_type AS tipo,
  is_nullable AS nullable,
  column_default AS default_value
FROM information_schema.columns
WHERE table_name = 'invoices' AND table_schema = 'public'
ORDER BY ordinal_position;

-- =====================================================
-- 4. CONSTRAINTS Y FOREIGN KEYS
-- =====================================================

SELECT 
  '=== CONSTRAINTS (UNIQUE, CHECK, FK) ===' AS info;

SELECT 
  tc.table_name AS tabla,
  tc.constraint_name AS constraint,
  tc.constraint_type AS tipo,
  kcu.column_name AS columna,
  CASE 
    WHEN tc.constraint_type = 'FOREIGN KEY' THEN
      ccu.table_name || '.' || ccu.column_name
    ELSE NULL
  END AS referencia
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name
  AND tc.table_schema = ccu.table_schema
WHERE tc.table_schema = 'public'
  AND tc.table_name NOT LIKE 'pg_%'
ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name;

-- =====================================================
-- 5. ÍNDICES CREADOS
-- =====================================================

SELECT 
  '=== ÍNDICES PARA PERFORMANCE ===' AS info;

SELECT 
  schemaname,
  tablename AS tabla,
  indexname AS indice,
  CASE 
    WHEN indexdef LIKE '%UNIQUE%' THEN '🔑 UNIQUE'
    ELSE '📊 REGULAR'
  END AS tipo
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename NOT LIKE 'pg_%'
ORDER BY tablename, indexname;

-- =====================================================
-- 6. FUNCIONES CREADAS
-- =====================================================

SELECT 
  '=== FUNCIONES Y HELPERS ===' AS info;

SELECT 
  routine_name AS funcion,
  routine_type AS tipo,
  data_type AS retorna,
  security_type AS seguridad
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name LIKE '%user%' OR routine_name LIKE '%invoice%' OR routine_name LIKE '%idempotency%'
ORDER BY routine_name;

-- =====================================================
-- 7. TRIGGERS ACTIVOS
-- =====================================================

SELECT 
  '=== TRIGGERS DE VALIDACIÓN ===' AS info;

SELECT 
  trigger_name AS trigger,
  event_object_table AS tabla,
  action_timing AS momento,
  event_manipulation AS evento
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table NOT LIKE 'pg_%'
ORDER BY event_object_table, trigger_name;

-- =====================================================
-- 8. DATOS DE EJEMPLO (CONTEO)
-- =====================================================

SELECT 
  '=== CONTEO DE REGISTROS ACTUALES ===' AS info;

SELECT 
  'businesses' AS tabla,
  COUNT(*) AS registros
FROM businesses
UNION ALL
SELECT 
  'employees' AS tabla,
  COUNT(*) AS registros
FROM employees
UNION ALL
SELECT 
  'products' AS tabla,
  COUNT(*) AS registros
FROM products
UNION ALL
SELECT 
  'sales' AS tabla,
  COUNT(*) AS registros
FROM sales
UNION ALL
SELECT 
  'purchases' AS tabla,
  COUNT(*) AS registros
FROM purchases
UNION ALL
SELECT 
  'invoices' AS tabla,
  COUNT(*) AS registros
FROM invoices
ORDER BY tabla;

-- =====================================================
-- 9. VERIFICAR FUNCIÓN get_user_business_ids()
-- =====================================================

SELECT 
  '=== TEST: get_user_business_ids() ===' AS info;

-- Solo ejecutar si hay sesión autenticada
-- SELECT * FROM get_user_business_ids();

-- =====================================================
-- 10. ANÁLISIS DE DEPENDENCIAS
-- =====================================================

SELECT 
  '=== DEPENDENCIAS ENTRE TABLAS ===' AS info;

SELECT 
  tc.table_name AS tabla_origen,
  kcu.column_name AS columna,
  ccu.table_name AS tabla_destino,
  ccu.column_name AS columna_destino
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

-- =====================================================
-- RESUMEN FINAL
-- =====================================================

SELECT 
  '=== RESUMEN ===' AS info;

SELECT 
  '✅ Base de datos configurada' AS status,
  (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE 'pg_%') AS total_tablas,
  (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = true) AS tablas_con_rls,
  (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public') AS total_politicas,
  (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public') AS total_indices;
