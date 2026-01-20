-- =====================================================
-- FIX MANUAL: Funciones creadas fuera de migraciones
-- =====================================================
-- Ejecutar en Supabase SQL Editor
-- Estas funciones fueron creadas manualmente o por scripts
-- y necesitan SET search_path = public
-- =====================================================

-- NOTA: Algunas funciones tienen múltiples versiones (sobrecargadas)
-- Solo actualiza las que realmente uses

-- =====================================================
-- 1. cleanup_expired_idempotency_requests
-- =====================================================
CREATE OR REPLACE FUNCTION cleanup_expired_idempotency_requests()
RETURNS INTEGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM idempotency_requests
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- =====================================================
-- 2. prevent_duplicate_business_creation
-- =====================================================
CREATE OR REPLACE FUNCTION prevent_duplicate_business_creation()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_recent_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_recent_count
  FROM businesses
  WHERE created_by = NEW.created_by
    AND created_at > NOW() - INTERVAL '60 seconds';
  
  IF v_recent_count > 0 THEN
    RAISE EXCEPTION 'Ya creaste un negocio recientemente. Espera 60 segundos antes de crear otro.'
      USING ERRCODE = '23505';
  END IF;
  
  RETURN NEW;
END;
$$;

-- =====================================================
-- 3. prevent_duplicate_employee_creation
-- =====================================================
CREATE OR REPLACE FUNCTION prevent_duplicate_employee_creation()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
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

-- =====================================================
-- 4. update_purchase_total
-- =====================================================
CREATE OR REPLACE FUNCTION update_purchase_total()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE purchases
  SET total = COALESCE((
    SELECT SUM(subtotal)
    FROM purchase_details
    WHERE purchase_id = NEW.purchase_id
  ), 0)
  WHERE id = NEW.purchase_id;
  
  RETURN NEW;
END;
$$;

-- =====================================================
-- 5. reduce_stock (versión simple)
-- =====================================================
CREATE OR REPLACE FUNCTION reduce_stock(p_product_id UUID, p_quantity NUMERIC)
RETURNS VOID 
LANGUAGE plpgsql
SET search_path = public
AS $$
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
END;
$$;

-- =====================================================
-- 6. increase_stock (versión simple)
-- =====================================================
CREATE OR REPLACE FUNCTION increase_stock(p_product_id UUID, p_quantity NUMERIC)
RETURNS VOID 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE products
  SET 
    stock = stock + p_quantity,
    updated_at = NOW()
  WHERE id = p_product_id;
END;
$$;

-- =====================================================
-- 7. check_email_has_access (versión con business_id)
-- =====================================================
CREATE OR REPLACE FUNCTION check_email_has_access(p_email TEXT, p_business_id UUID)
RETURNS BOOLEAN 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_access boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM employees e
    INNER JOIN auth.users u ON e.user_id = u.id
    WHERE u.email = p_email AND e.business_id = p_business_id
  ) INTO has_access;
  
  RETURN has_access;
END;
$$;

-- =====================================================
-- 8. user_has_business_access (versión con parámetros)
-- =====================================================
CREATE OR REPLACE FUNCTION user_has_business_access(
  business_uuid UUID,
  business_created_by UUID,
  business_email TEXT
)
RETURNS BOOLEAN 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar si el usuario creó el negocio
  IF business_created_by = auth.uid() THEN
    RETURN TRUE;
  END IF;
  
  -- Verificar si el email del negocio coincide
  IF business_email = auth.jwt()->>'email' THEN
    RETURN TRUE;
  END IF;
  
  -- Verificar si el usuario es empleado
  IF EXISTS (
    SELECT 1 FROM employees 
    WHERE business_id = business_uuid 
    AND user_id = auth.uid()
  ) THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$;

-- =====================================================
-- VERIFICACIÓN
-- =====================================================
-- Ejecuta esto para confirmar que todas tienen search_path

SELECT 
  routine_name,
  routine_type,
  CASE 
    WHEN prosrc LIKE '%SET search_path%' THEN '✅ CORRECTO'
    ELSE '❌ FALTA search_path'
  END as estado
FROM information_schema.routines r
LEFT JOIN pg_proc p ON p.proname = r.routine_name
WHERE routine_schema = 'public'
  AND routine_type = 'FUNCTION'
  AND routine_name IN (
    'reduce_stock',
    'increase_stock', 
    'update_purchase_total',
    'cleanup_expired_idempotency_requests',
    'prevent_duplicate_business_creation',
    'prevent_duplicate_employee_creation',
    'check_email_has_access',
    'user_has_business_access',
    'update_stock_batch',
    'restore_stock_batch',
    'update_updated_at_column',
    'is_stocky_admin',
    'activate_business_invoicing',
    'deactivate_business_invoicing'
  )
ORDER BY routine_name;
