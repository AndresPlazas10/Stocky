-- =====================================================
-- MEJORAS OPCIONALES DE ESTRUCTURA - STOCKLY
-- =====================================================
-- Este script contiene mejoras opcionales para la estructura
-- de la base de datos que hacen el sistema más robusto,
-- seguro y mantenible.
--
-- ⚠️ ADVERTENCIA: Estas mejoras son OPCIONALES
-- Evaluar cada una antes de implementar en producción
-- =====================================================

SET search_path = public;

-- =====================================================
-- MEJORA 1: TIPO ENUM PARA EMPLOYEE ROLES
-- =====================================================
-- Problema: role es TEXT sin validación
-- Solución: Crear ENUM con valores permitidos

DO $$
BEGIN
  -- Crear tipo ENUM si no existe
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'employee_role') THEN
    CREATE TYPE employee_role AS ENUM ('owner', 'admin', 'employee', 'cashier');
    RAISE NOTICE '✅ Tipo employee_role creado';
  ELSE
    RAISE NOTICE '⚠️ Tipo employee_role ya existe';
  END IF;
END $$;

-- Migrar columna role a tipo ENUM
-- ⚠️ BACKUP ANTES DE EJECUTAR

DO $$
BEGIN
  -- Convertir columna existente
  ALTER TABLE employees 
    ALTER COLUMN role TYPE employee_role 
    USING role::employee_role;
  
  -- Agregar default
  ALTER TABLE employees 
    ALTER COLUMN role SET DEFAULT 'employee'::employee_role;
  
  RAISE NOTICE '✅ Columna employees.role migrada a ENUM';
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ Error al migrar role: %', SQLERRM;
    RAISE NOTICE 'Verifica que todos los valores actuales sean: owner, admin, employee, cashier';
END $$;

-- =====================================================
-- MEJORA 2: TIPO ENUM PARA INVOICE STATUS
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_status') THEN
    CREATE TYPE invoice_status AS ENUM ('draft', 'sent', 'paid', 'cancelled', 'overdue');
    RAISE NOTICE '✅ Tipo invoice_status creado';
  END IF;
END $$;

-- Migrar columna status en invoices
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'invoices') THEN
    ALTER TABLE invoices 
      ALTER COLUMN status TYPE invoice_status 
      USING status::invoice_status;
    
    ALTER TABLE invoices 
      ALTER COLUMN status SET DEFAULT 'draft'::invoice_status;
    
    RAISE NOTICE '✅ Columna invoices.status migrada a ENUM';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ Error al migrar status: %', SQLERRM;
END $$;

-- =====================================================
-- MEJORA 3: TABLA DE AUDITORÍA
-- =====================================================
-- Registra TODAS las modificaciones importantes

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  user_id UUID NOT NULL,
  business_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_table_record 
  ON audit_log(table_name, record_id);

CREATE INDEX IF NOT EXISTS idx_audit_log_user_created 
  ON audit_log(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_business_created 
  ON audit_log(business_id, created_at DESC);

COMMENT ON TABLE audit_log IS
  'Registro de auditoría de todas las operaciones críticas';

-- Función para registrar en audit_log
CREATE OR REPLACE FUNCTION log_audit()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_business_id UUID;
BEGIN
  -- Intentar obtener business_id del registro
  IF TG_OP = 'DELETE' THEN
    v_business_id := OLD.business_id;
  ELSE
    v_business_id := NEW.business_id;
  END IF;
  
  -- Insertar en audit_log
  IF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log (table_name, record_id, action, user_id, business_id, old_data)
    VALUES (TG_TABLE_NAME, OLD.id, TG_OP, auth.uid(), v_business_id, to_jsonb(OLD));
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log (table_name, record_id, action, user_id, business_id, old_data, new_data)
    VALUES (TG_TABLE_NAME, NEW.id, TG_OP, auth.uid(), v_business_id, to_jsonb(OLD), to_jsonb(NEW));
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (table_name, record_id, action, user_id, business_id, new_data)
    VALUES (TG_TABLE_NAME, NEW.id, TG_OP, auth.uid(), v_business_id, to_jsonb(NEW));
  END IF;
  
  RETURN NULL; -- AFTER trigger, retorno no importa
END;
$$;

-- Crear triggers de auditoría en tablas críticas
DO $$
DECLARE
  v_table TEXT;
BEGIN
  FOR v_table IN 
    SELECT unnest(ARRAY['sales', 'purchases', 'products', 'employees', 'invoices'])
  LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = v_table) THEN
      EXECUTE format('
        DROP TRIGGER IF EXISTS audit_%s ON %I;
        CREATE TRIGGER audit_%s
          AFTER INSERT OR UPDATE OR DELETE ON %I
          FOR EACH ROW EXECUTE FUNCTION log_audit();
      ', v_table, v_table, v_table, v_table);
      
      RAISE NOTICE '✅ Trigger de auditoría creado en tabla: %', v_table;
    END IF;
  END LOOP;
END $$;

-- =====================================================
-- MEJORA 4: SOFT DELETE CON COLUMNAS deleted_at/deleted_by
-- =====================================================

DO $$
DECLARE
  v_table TEXT;
BEGIN
  FOR v_table IN 
    SELECT unnest(ARRAY['products', 'suppliers', 'customers', 'employees'])
  LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = v_table) THEN
      -- Agregar columna deleted_at si no existe
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = v_table AND column_name = 'deleted_at'
      ) THEN
        EXECUTE format('ALTER TABLE %I ADD COLUMN deleted_at TIMESTAMPTZ', v_table);
        RAISE NOTICE '✅ Columna deleted_at agregada a: %', v_table;
      END IF;
      
      -- Agregar columna deleted_by si no existe
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = v_table AND column_name = 'deleted_by'
      ) THEN
        EXECUTE format('ALTER TABLE %I ADD COLUMN deleted_by UUID', v_table);
        RAISE NOTICE '✅ Columna deleted_by agregada a: %', v_table;
      END IF;
      
      -- Crear índice para filtrar registros no eliminados
      EXECUTE format('
        CREATE INDEX IF NOT EXISTS idx_%s_not_deleted 
        ON %I(business_id) WHERE deleted_at IS NULL
      ', v_table, v_table);
    END IF;
  END LOOP;
END $$;

-- Función para soft delete
CREATE OR REPLACE FUNCTION soft_delete_record(
  p_table_name TEXT,
  p_record_id UUID
)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  EXECUTE format('
    UPDATE %I 
    SET deleted_at = NOW(), deleted_by = auth.uid()
    WHERE id = $1 AND deleted_at IS NULL
  ', p_table_name)
  USING p_record_id;
  
  RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION soft_delete_record(TEXT, UUID) IS
  'Realiza soft delete de un registro (marca como eliminado sin borrar físicamente)';

-- =====================================================
-- MEJORA 5: CONSTRAINT DE LÍMITE DE EMPLEADOS
-- =====================================================

-- Función para validar límite de empleados
CREATE OR REPLACE FUNCTION check_max_employees()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_employee_count INTEGER;
  v_max_employees INTEGER := 50; -- Ajustar según plan del negocio
BEGIN
  -- Contar empleados activos del negocio
  SELECT COUNT(*) INTO v_employee_count
  FROM employees
  WHERE business_id = NEW.business_id
    AND is_active = true
    AND deleted_at IS NULL;
  
  IF v_employee_count >= v_max_employees THEN
    RAISE EXCEPTION 'Límite de empleados alcanzado (máximo: %)', v_max_employees
      USING HINT = 'Actualiza tu plan o desactiva empleados inactivos';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Crear trigger
DROP TRIGGER IF EXISTS trigger_check_max_employees ON employees;
CREATE TRIGGER trigger_check_max_employees
  BEFORE INSERT ON employees
  FOR EACH ROW
  EXECUTE FUNCTION check_max_employees();

-- =====================================================
-- MEJORA 6: VALIDACIÓN DE STOCK NO NEGATIVO
-- =====================================================

ALTER TABLE products 
  DROP CONSTRAINT IF EXISTS stock_non_negative;

ALTER TABLE products 
  ADD CONSTRAINT stock_non_negative 
  CHECK (stock >= 0);

COMMENT ON CONSTRAINT stock_non_negative ON products IS
  'Previene que el stock sea negativo';

-- =====================================================
-- MEJORA 7: ÍNDICES ADICIONALES DE PERFORMANCE
-- =====================================================

-- Índice para búsqueda de usuarios por email en employees
CREATE INDEX IF NOT EXISTS idx_employees_email 
  ON employees(email);

-- Índice para filtrar productos por categoría
CREATE INDEX IF NOT EXISTS idx_products_category 
  ON products(business_id, category) 
  WHERE is_active = true;

-- Índice para facturas por status
CREATE INDEX IF NOT EXISTS idx_invoices_status 
  ON invoices(business_id, status, created_at DESC);

-- Índice para ventas por método de pago y fecha
CREATE INDEX IF NOT EXISTS idx_sales_payment_date 
  ON sales(business_id, payment_method, created_at DESC);

-- Índice GIN para búsqueda de texto en productos
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_products_name_trgm 
  ON products USING GIN (name gin_trgm_ops);

COMMENT ON INDEX idx_products_name_trgm IS
  'Optimiza búsquedas con ILIKE en nombre de productos';

-- =====================================================
-- MEJORA 8: CONSTRAINT UNIQUE ADICIONALES
-- =====================================================

-- Email único por negocio en employees
ALTER TABLE employees 
  DROP CONSTRAINT IF EXISTS employees_email_business_unique;

ALTER TABLE employees 
  ADD CONSTRAINT employees_email_business_unique 
  UNIQUE (business_id, email);

-- Número de mesa único por negocio
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'tables') THEN
    EXECUTE '
      ALTER TABLE tables 
        DROP CONSTRAINT IF EXISTS tables_number_business_unique;
      
      ALTER TABLE tables 
        ADD CONSTRAINT tables_number_business_unique 
        UNIQUE (business_id, table_number);
    ';
    RAISE NOTICE '✅ Constraint único agregado a tables';
  END IF;
END $$;

-- Email opcional único en customers
ALTER TABLE customers 
  DROP CONSTRAINT IF EXISTS customers_email_business_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_email_business_unique 
  ON customers(business_id, email) 
  WHERE email IS NOT NULL AND email != '';

-- =====================================================
-- MEJORA 9: FUNCIONES DE REPORTES MEJORADAS
-- =====================================================

-- Función para obtener resumen de negocio
CREATE OR REPLACE FUNCTION get_business_summary(p_business_id UUID)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_summary JSONB;
BEGIN
  -- Validar acceso
  IF NOT check_business_access(p_business_id, auth.uid()) THEN
    RAISE EXCEPTION 'No tienes acceso a este negocio';
  END IF;
  
  SELECT jsonb_build_object(
    'total_products', (SELECT COUNT(*) FROM products WHERE business_id = p_business_id AND is_active = true),
    'low_stock_products', (SELECT COUNT(*) FROM products WHERE business_id = p_business_id AND is_active = true AND stock <= 10),
    'total_sales_today', (SELECT COALESCE(SUM(total), 0) FROM sales WHERE business_id = p_business_id AND DATE(created_at) = CURRENT_DATE),
    'total_sales_month', (SELECT COALESCE(SUM(total), 0) FROM sales WHERE business_id = p_business_id AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)),
    'total_customers', (SELECT COUNT(*) FROM customers WHERE business_id = p_business_id AND is_active = true),
    'total_employees', (SELECT COUNT(*) FROM employees WHERE business_id = p_business_id AND is_active = true),
    'pending_invoices', (SELECT COUNT(*) FROM invoices WHERE business_id = p_business_id AND status IN ('draft', 'sent')),
    'generated_at', NOW()
  ) INTO v_summary;
  
  RETURN v_summary;
END;
$$;

COMMENT ON FUNCTION get_business_summary(UUID) IS
  'Retorna resumen completo del negocio (productos, ventas, clientes, etc.)';

GRANT EXECUTE ON FUNCTION get_business_summary(UUID) TO authenticated;

-- =====================================================
-- MEJORA 10: POLÍTICAS RLS PARA AUDIT_LOG
-- =====================================================

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Solo owner/admin pueden ver audit_log
CREATE POLICY "audit_log_select"
  ON audit_log
  FOR SELECT
  TO authenticated
  USING (
    business_id IN (SELECT get_user_business_ids())
    AND
    check_is_admin_or_owner(business_id)
  );

-- Nadie puede INSERT/UPDATE/DELETE manualmente
CREATE POLICY "audit_log_no_manual_changes"
  ON audit_log
  FOR ALL
  TO authenticated
  USING (FALSE)
  WITH CHECK (FALSE);

COMMENT ON POLICY "audit_log_select" ON audit_log IS
  'Solo owner/admin pueden consultar el log de auditoría';

COMMENT ON POLICY "audit_log_no_manual_changes" ON audit_log IS
  'Previene modificaciones manuales (solo triggers pueden insertar)';

-- =====================================================
-- MEJORA 11: FUNCIÓN PARA RESTAURAR SOFT DELETES
-- =====================================================

CREATE OR REPLACE FUNCTION restore_deleted_record(
  p_table_name TEXT,
  p_record_id UUID
)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_business_id UUID;
BEGIN
  -- Obtener business_id del registro
  EXECUTE format('SELECT business_id FROM %I WHERE id = $1', p_table_name)
  INTO v_business_id
  USING p_record_id;
  
  -- Validar acceso
  IF NOT check_is_admin_or_owner(v_business_id) THEN
    RAISE EXCEPTION 'Solo owner/admin pueden restaurar registros';
  END IF;
  
  -- Restaurar registro
  EXECUTE format('
    UPDATE %I 
    SET deleted_at = NULL, deleted_by = NULL
    WHERE id = $1 AND deleted_at IS NOT NULL
  ', p_table_name)
  USING p_record_id;
  
  RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION restore_deleted_record(TEXT, UUID) IS
  'Restaura un registro soft-deleted (solo owner/admin)';

GRANT EXECUTE ON FUNCTION restore_deleted_record(TEXT, UUID) TO authenticated;

-- =====================================================
-- MEJORA 12: VALIDACIONES ADICIONALES CON CHECK CONSTRAINTS
-- =====================================================

-- Validar que price > 0 en products
ALTER TABLE products 
  DROP CONSTRAINT IF EXISTS price_positive;

ALTER TABLE products 
  ADD CONSTRAINT price_positive 
  CHECK (price > 0);

-- Validar que quantity > 0 en sale_details
ALTER TABLE sale_details 
  DROP CONSTRAINT IF EXISTS quantity_positive;

ALTER TABLE sale_details 
  ADD CONSTRAINT quantity_positive 
  CHECK (quantity > 0);

-- Validar que total >= 0 en sales
ALTER TABLE sales 
  DROP CONSTRAINT IF EXISTS total_non_negative;

ALTER TABLE sales 
  ADD CONSTRAINT total_non_negative 
  CHECK (total >= 0);

-- Validar formato de email en employees
ALTER TABLE employees 
  DROP CONSTRAINT IF EXISTS email_format;

ALTER TABLE employees 
  ADD CONSTRAINT email_format 
  CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$');

-- =====================================================
-- RESUMEN DE MEJORAS APLICADAS
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '=============================================';
  RAISE NOTICE '✅ MEJORAS OPCIONALES APLICADAS';
  RAISE NOTICE '=============================================';
  RAISE NOTICE '';
  RAISE NOTICE '1. ✅ Tipos ENUM creados (employee_role, invoice_status)';
  RAISE NOTICE '2. ✅ Tabla audit_log con triggers';
  RAISE NOTICE '3. ✅ Soft delete implementado (deleted_at, deleted_by)';
  RAISE NOTICE '4. ✅ Límite de empleados (máx: 50)';
  RAISE NOTICE '5. ✅ Validación stock no negativo';
  RAISE NOTICE '6. ✅ Índices adicionales de performance';
  RAISE NOTICE '7. ✅ Constraints UNIQUE adicionales';
  RAISE NOTICE '8. ✅ Función get_business_summary()';
  RAISE NOTICE '9. ✅ RLS en audit_log';
  RAISE NOTICE '10. ✅ Función restore_deleted_record()';
  RAISE NOTICE '11. ✅ Validaciones con CHECK constraints';
  RAISE NOTICE '';
  RAISE NOTICE '=============================================';
  RAISE NOTICE 'RECOMENDACIÓN: Probar en staging antes de producción';
  RAISE NOTICE '=============================================';
END $$;

-- =====================================================
-- SCRIPT DE ROLLBACK (OPCIONAL)
-- =====================================================

/*
-- DESCOMENTAR SOLO SI NECESITAS REVERTIR CAMBIOS

-- Eliminar tipos ENUM
DROP TYPE IF EXISTS employee_role CASCADE;
DROP TYPE IF EXISTS invoice_status CASCADE;

-- Eliminar tabla audit_log
DROP TABLE IF EXISTS audit_log CASCADE;

-- Eliminar columnas de soft delete
ALTER TABLE products DROP COLUMN IF EXISTS deleted_at, DROP COLUMN IF EXISTS deleted_by;
ALTER TABLE suppliers DROP COLUMN IF EXISTS deleted_at, DROP COLUMN IF EXISTS deleted_by;
ALTER TABLE customers DROP COLUMN IF EXISTS deleted_at, DROP COLUMN IF EXISTS deleted_by;
ALTER TABLE employees DROP COLUMN IF EXISTS deleted_at, DROP COLUMN IF EXISTS deleted_by;

-- Eliminar triggers
DROP TRIGGER IF EXISTS trigger_check_max_employees ON employees;
DROP TRIGGER IF EXISTS audit_sales ON sales;
DROP TRIGGER IF EXISTS audit_purchases ON purchases;
DROP TRIGGER IF EXISTS audit_products ON products;
DROP TRIGGER IF EXISTS audit_employees ON employees;
DROP TRIGGER IF EXISTS audit_invoices ON invoices;

-- Eliminar funciones
DROP FUNCTION IF EXISTS log_audit() CASCADE;
DROP FUNCTION IF EXISTS check_max_employees() CASCADE;
DROP FUNCTION IF EXISTS soft_delete_record(TEXT, UUID);
DROP FUNCTION IF EXISTS restore_deleted_record(TEXT, UUID);
DROP FUNCTION IF EXISTS get_business_summary(UUID);

-- Eliminar constraints
ALTER TABLE products DROP CONSTRAINT IF EXISTS stock_non_negative;
ALTER TABLE products DROP CONSTRAINT IF EXISTS price_positive;
ALTER TABLE sale_details DROP CONSTRAINT IF EXISTS quantity_positive;
ALTER TABLE sales DROP CONSTRAINT IF EXISTS total_non_negative;
ALTER TABLE employees DROP CONSTRAINT IF EXISTS email_format;
ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_email_business_unique;

RAISE NOTICE '✅ Rollback completado';
*/

-- =====================================================
-- FIN DEL SCRIPT
-- =====================================================
