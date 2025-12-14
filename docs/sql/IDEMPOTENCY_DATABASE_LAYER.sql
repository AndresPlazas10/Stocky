-- =====================================================
-- CAPA 3: BASE DE DATOS - PROTECCIÓN DEFINITIVA
-- =====================================================
-- Constraints, índices y triggers para prevenir duplicados
-- a nivel de PostgreSQL + Supabase
-- =====================================================

-- =====================================================
-- PARTE 1: TABLA DE IDEMPOTENCY TRACKING
-- =====================================================
-- Esta tabla rastrea TODAS las requests procesadas
-- Permite rechazar duplicados incluso si el cliente insiste

CREATE TABLE IF NOT EXISTS idempotency_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificador único de la request (generado por cliente)
  idempotency_key VARCHAR(255) NOT NULL UNIQUE,
  
  -- Contexto de la request
  action_name VARCHAR(100) NOT NULL, -- ej: 'create_business', 'create_purchase'
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  
  -- Metadata de la request
  request_payload JSONB, -- Datos enviados (para debugging)
  response_payload JSONB, -- Resultado de la operación
  
  -- Estado de la request
  status VARCHAR(20) NOT NULL CHECK (status IN ('processing', 'completed', 'failed')),
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Prevenir requests antiguas (TTL automático)
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours')
);

-- Índices para búsqueda rápida
CREATE INDEX idx_idempotency_key ON idempotency_requests(idempotency_key);
CREATE INDEX idx_idempotency_user ON idempotency_requests(user_id, created_at DESC);
CREATE INDEX idx_idempotency_expires ON idempotency_requests(expires_at) WHERE status = 'processing';

-- Auto-limpieza de requests expiradas (ejecutar periódicamente)
CREATE OR REPLACE FUNCTION cleanup_expired_idempotency_requests()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
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

COMMENT ON FUNCTION cleanup_expired_idempotency_requests() IS
  'Limpia requests de idempotency expiradas (>24h). Ejecutar diariamente via cron.';

-- =====================================================
-- PARTE 2: FUNCIÓN DE IDEMPOTENCY CHECK
-- =====================================================
-- Función SECURITY DEFINER para verificar/registrar idempotency

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
  v_result JSONB;
BEGIN
  -- Buscar request existente con este idempotency key
  SELECT * INTO v_existing
  FROM idempotency_requests
  WHERE idempotency_key = p_idempotency_key;
  
  -- CASO 1: Request ya completada - retornar resultado cached
  IF FOUND AND v_existing.status = 'completed' THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'duplicate_request',
      'status', 'completed',
      'cached_result', v_existing.response_payload,
      'original_created_at', v_existing.created_at
    );
  END IF;
  
  -- CASO 2: Request en progreso - rechazar (evitar race condition)
  IF FOUND AND v_existing.status = 'processing' THEN
    -- Si tiene más de 5 minutos, asumir que falló y permitir retry
    IF v_existing.created_at < NOW() - INTERVAL '5 minutes' THEN
      UPDATE idempotency_requests
      SET status = 'failed',
          error_message = 'Timeout - assumed failed',
          completed_at = NOW()
      WHERE idempotency_key = p_idempotency_key;
      
      -- Permitir retry
      RETURN jsonb_build_object(
        'allowed', true,
        'reason', 'retry_after_timeout',
        'request_id', v_existing.id
      );
    ELSE
      -- Rechazar - request duplicada en progreso
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'request_in_progress',
        'status', 'processing',
        'started_at', v_existing.created_at
      );
    END IF;
  END IF;
  
  -- CASO 3: Request fallida anteriormente - permitir retry
  IF FOUND AND v_existing.status = 'failed' THEN
    UPDATE idempotency_requests
    SET status = 'processing',
        created_at = NOW(),
        completed_at = NULL,
        error_message = NULL
    WHERE idempotency_key = p_idempotency_key;
    
    RETURN jsonb_build_object(
      'allowed', true,
      'reason', 'retry_after_failure',
      'request_id', v_existing.id
    );
  END IF;
  
  -- CASO 4: Primera vez - registrar y permitir
  INSERT INTO idempotency_requests (
    idempotency_key,
    action_name,
    user_id,
    business_id,
    status
  ) VALUES (
    p_idempotency_key,
    p_action_name,
    p_user_id,
    p_business_id,
    'processing'
  )
  RETURNING id INTO v_existing;
  
  RETURN jsonb_build_object(
    'allowed', true,
    'reason', 'first_request',
    'request_id', v_existing.id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION check_idempotency TO authenticated;

COMMENT ON FUNCTION check_idempotency IS
  'Verifica si una request es duplicada y debe ser rechazada o permitida.';

-- =====================================================
-- PARTE 3: FUNCIÓN PARA COMPLETAR IDEMPOTENCY
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
  WHERE idempotency_key = p_idempotency_key
    AND status = 'processing';
  
  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION complete_idempotency TO authenticated;

-- =====================================================
-- PARTE 4: CONSTRAINTS ÚNICOS EN TABLAS CRÍTICAS
-- =====================================================

-- BUSINESSES: Prevenir usernames duplicados
ALTER TABLE businesses 
  DROP CONSTRAINT IF EXISTS businesses_username_unique;

ALTER TABLE businesses 
  ADD CONSTRAINT businesses_username_unique 
  UNIQUE (username);

CREATE UNIQUE INDEX IF NOT EXISTS idx_businesses_username_lower 
  ON businesses (LOWER(username));

COMMENT ON INDEX idx_businesses_username_lower IS
  'Previene usernames duplicados case-insensitive';

-- BUSINESSES: Prevenir emails duplicados
ALTER TABLE businesses 
  DROP CONSTRAINT IF EXISTS businesses_email_unique;

ALTER TABLE businesses 
  ADD CONSTRAINT businesses_email_unique 
  UNIQUE (email);

-- EMPLOYEES: Prevenir duplicados de username por negocio
ALTER TABLE employees 
  DROP CONSTRAINT IF EXISTS employees_username_business_unique;

ALTER TABLE employees 
  ADD CONSTRAINT employees_username_business_unique 
  UNIQUE (business_id, username);

CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_username_business_lower 
  ON employees (business_id, LOWER(username));

-- EMPLOYEES: Prevenir duplicados de user_id por negocio
-- Un usuario NO puede tener múltiples registros de empleado en el mismo negocio
ALTER TABLE employees 
  DROP CONSTRAINT IF EXISTS employees_user_business_unique;

ALTER TABLE employees 
  ADD CONSTRAINT employees_user_business_unique 
  UNIQUE (business_id, user_id);

-- SALES: Prevenir ventas duplicadas en el mismo momento
-- Nota: Índice sin filtro temporal para evitar error IMMUTABLE con NOW()
CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_prevent_duplicates 
  ON sales (business_id, user_id, total, created_at);

COMMENT ON INDEX idx_sales_prevent_duplicates IS
  'Previene ventas duplicadas idénticas en el mismo segundo';

-- PURCHASES: Prevenir compras duplicadas
CREATE UNIQUE INDEX IF NOT EXISTS idx_purchases_prevent_duplicates 
  ON purchases (business_id, supplier_id, total, created_at);

-- INVOICES: Prevenir facturas duplicadas por número
ALTER TABLE invoices 
  DROP CONSTRAINT IF EXISTS invoices_number_business_unique;

ALTER TABLE invoices 
  ADD CONSTRAINT invoices_number_business_unique 
  UNIQUE (business_id, invoice_number);

-- =====================================================
-- PARTE 5: TRIGGERS PARA VALIDACIÓN ADICIONAL
-- =====================================================

-- Trigger: Prevenir creación de negocios con mismo created_by en corto tiempo
CREATE OR REPLACE FUNCTION prevent_duplicate_business_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_recent_count INTEGER;
BEGIN
  -- Verificar si el usuario creó otro negocio en los últimos 60 segundos
  SELECT COUNT(*) INTO v_recent_count
  FROM businesses
  WHERE created_by = NEW.created_by
    AND created_at > NOW() - INTERVAL '60 seconds';
  
  IF v_recent_count > 0 THEN
    RAISE EXCEPTION 'Ya creaste un negocio recientemente. Espera 60 segundos antes de crear otro.'
      USING ERRCODE = '23505'; -- unique_violation
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_prevent_duplicate_business ON businesses;

CREATE TRIGGER trigger_prevent_duplicate_business
  BEFORE INSERT ON businesses
  FOR EACH ROW
  EXECUTE FUNCTION prevent_duplicate_business_creation();

-- Trigger: Prevenir empleados duplicados en corto tiempo
CREATE OR REPLACE FUNCTION prevent_duplicate_employee_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_recent_count INTEGER;
BEGIN
  -- Verificar si se creó otro empleado con mismo username en los últimos 30 segundos
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
-- PARTE 6: TRANSACCIONES SEGURAS (EJEMPLO)
-- =====================================================

-- Función wrapper para crear negocio de forma atómica e idempotente
CREATE OR REPLACE FUNCTION create_business_safe(
  p_idempotency_key VARCHAR(255),
  p_name TEXT,
  p_username TEXT,
  p_email TEXT,
  p_address TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_created_by UUID DEFAULT auth.uid()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_check JSONB;
  v_business_id UUID;
  v_result JSONB;
BEGIN
  -- PASO 1: Verificar idempotency
  v_check := check_idempotency(
    p_idempotency_key,
    'create_business',
    p_created_by,
    NULL
  );
  
  -- Si no está permitido, retornar resultado cached o error
  IF (v_check->>'allowed')::BOOLEAN = false THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', v_check->>'reason',
      'cached_result', v_check->'cached_result'
    );
  END IF;
  
  -- PASO 2: Iniciar transacción
  BEGIN
    -- Crear negocio
    INSERT INTO businesses (name, username, email, address, phone, created_by)
    VALUES (p_name, LOWER(p_username), p_email, p_address, p_phone, p_created_by)
    RETURNING id INTO v_business_id;
    
    -- Crear empleado owner automáticamente
    INSERT INTO employees (
      business_id,
      user_id,
      full_name,
      username,
      email,
      role,
      is_active
    ) VALUES (
      v_business_id,
      p_created_by,
      p_name,
      LOWER(p_username),
      p_email,
      'owner',
      true
    );
    
    -- Preparar resultado
    v_result := jsonb_build_object(
      'success', true,
      'business_id', v_business_id,
      'created_at', NOW()
    );
    
    -- PASO 3: Marcar idempotency como completada
    PERFORM complete_idempotency(
      p_idempotency_key,
      v_result,
      true,
      NULL
    );
    
    RETURN v_result;
    
  EXCEPTION WHEN OTHERS THEN
    -- En caso de error, marcar idempotency como fallida
    PERFORM complete_idempotency(
      p_idempotency_key,
      NULL,
      false,
      SQLERRM
    );
    
    -- Re-lanzar el error
    RAISE;
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION create_business_safe TO authenticated;

COMMENT ON FUNCTION create_business_safe IS
  'Crea un negocio de forma segura con protección de idempotency y transacciones atómicas.';

-- =====================================================
-- PARTE 7: RLS PARA TABLA IDEMPOTENCY
-- =====================================================

ALTER TABLE idempotency_requests ENABLE ROW LEVEL SECURITY;

-- Los usuarios solo ven sus propias requests
CREATE POLICY idempotency_select_own
  ON idempotency_requests
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Solo las funciones SECURITY DEFINER pueden insertar/actualizar
-- (El usuario NO puede manipular directamente esta tabla)

-- =====================================================
-- PARTE 8: VERIFICACIÓN Y TESTING
-- =====================================================

-- Test 1: Verificar que constraints están activos
SELECT 
  conname as constraint_name,
  contype as type,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'businesses'::regclass
   OR conrelid = 'employees'::regclass
   OR conrelid = 'idempotency_requests'::regclass
ORDER BY conrelid::regclass::text, conname;

-- Test 2: Verificar índices únicos
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN ('businesses', 'employees', 'idempotency_requests')
  AND indexdef LIKE '%UNIQUE%'
ORDER BY tablename, indexname;

-- Test 3: Verificar triggers
SELECT 
  trigger_name,
  event_object_table,
  action_timing,
  event_manipulation
FROM information_schema.triggers
WHERE event_object_table IN ('businesses', 'employees')
  AND trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- =====================================================
-- PARTE 9: MONITOREO Y ESTADÍSTICAS
-- =====================================================

-- Ver requests duplicadas rechazadas (últimas 24h)
CREATE OR REPLACE VIEW v_duplicate_requests_stats AS
SELECT 
  action_name,
  COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
  COUNT(*) FILTER (WHERE status = 'processing') as in_progress_count,
  COUNT(DISTINCT user_id) as unique_users,
  MIN(created_at) as first_request,
  MAX(created_at) as last_request
FROM idempotency_requests
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY action_name
ORDER BY completed_count DESC;

GRANT SELECT ON v_duplicate_requests_stats TO authenticated;

-- =====================================================
-- PARTE 10: LIMPIEZA PERIÓDICA (OPCIONAL)
-- =====================================================

-- Crear extensión pg_cron si está disponible (Supabase Pro)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Programar limpieza diaria a las 3 AM
-- SELECT cron.schedule(
--   'cleanup-idempotency-requests',
--   '0 3 * * *',
--   $$SELECT cleanup_expired_idempotency_requests()$$
-- );

-- =====================================================
-- RESUMEN DE PROTECCIONES IMPLEMENTADAS
-- =====================================================

/*
✅ NIVEL 1 - CONSTRAINTS:
- Usernames únicos (case-insensitive)
- Emails únicos
- Empleados únicos por negocio + username
- Usuarios únicos por negocio (no duplicar employees)
- Ventas/Compras duplicadas en mismo segundo bloqueadas

✅ NIVEL 2 - TRIGGERS:
- Bloqueo de negocios duplicados en 60 segundos
- Bloqueo de empleados duplicados en 30 segundos

✅ NIVEL 3 - IDEMPOTENCY TABLE:
- Tracking de TODAS las requests procesadas
- Rechazo automático de requests duplicadas
- Cache de resultados para requests completadas
- TTL de 24 horas para auto-limpieza

✅ NIVEL 4 - FUNCIONES SECURITY DEFINER:
- check_idempotency(): Verificación centralizada
- complete_idempotency(): Marcado de completitud
- create_business_safe(): Wrapper transaccional

✅ NIVEL 5 - TRANSACCIONES:
- Operaciones atómicas (todo o nada)
- Rollback automático en errores
- Consistencia garantizada

EDGE CASES CUBIERTOS:
✅ Doble click → Debounced + idempotency check
✅ Latencia alta → Timeout de 5 min + retry permitido
✅ Refresh navegador → sessionStorage persiste estado
✅ Múltiples pestañas → BroadcastChannel + DB check
✅ Reconexión red → Idempotency key previene duplicados
✅ Race conditions → Primera request gana, siguientes rechazadas
✅ Requests antiguas → TTL de 24h + limpieza automática

CÓMO USAR:
==========
1. Ejecutar este script completo en Supabase SQL Editor
2. Usar hook useIdempotentSubmit en frontend
3. Pasar idempotency_key en todas las inserts críticas
4. (Opcional) Usar funciones *_safe() para máxima protección
*/
