-- ============================================================
-- SETUP COMPLETO: handle_table_transaction RPC + RLS
-- ============================================================
-- Ejecutar este archivo en el SQL Editor de Supabase como superusuario
-- para crear la tabla audit_log (si no existe), la función RPC y
-- las políticas RLS necesarias.

-- ============================================================
-- 1. CREAR TABLA audit_log (si no existe)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_log (
  id BIGSERIAL PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE', 'OPEN', 'CLOSE')),
  user_id UUID NOT NULL,
  business_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Crear índices para audit_log
CREATE INDEX IF NOT EXISTS idx_audit_log_table_record 
  ON public.audit_log(table_name, record_id);

CREATE INDEX IF NOT EXISTS idx_audit_log_user_created 
  ON public.audit_log(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_business_created 
  ON public.audit_log(business_id, created_at DESC);

-- ============================================================
-- 2. CREAR FUNCIÓN RPC: handle_table_transaction
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_table_transaction(
  p_table_id uuid,
  p_action_type text,
  p_user_id uuid,
  p_notes text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  name text,
  status text,
  last_updated_by uuid,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id uuid;
  v_name text;
  v_status text;
  v_last_updated_by uuid;
  v_updated_at timestamptz;
  v_table_business uuid;
  v_jwt_business uuid;
BEGIN
  -- Business-aware checks: obtener business_id de la mesa
  SELECT business_id INTO v_table_business FROM public.tables WHERE id = p_table_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'table with id % not found', p_table_id;
  END IF;

  -- Obtener business desde los claims JWT de la sesión (Supabase sets jwt.claims)
  BEGIN
    v_jwt_business := (current_setting('jwt.claims', true)::json->>'business')::uuid;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'missing or invalid jwt.claims business claim';
  END;

  -- Comprobaciones de seguridad: el caller (JWT) debe pertenecer al mismo business que la mesa
  IF v_jwt_business IS NULL OR v_jwt_business <> v_table_business THEN
    RAISE EXCEPTION 'permission denied: caller business does not match table business';
  END IF;

  -- Validar acción
  IF lower(p_action_type) = 'open' THEN
    v_status := 'open';
  ELSIF lower(p_action_type) = 'close' THEN
    v_status := 'closed';
  ELSE
    RAISE EXCEPTION 'invalid action_type: %', p_action_type;
  END IF;

  -- Actualizar la mesa y capturar fila actualizada
  UPDATE public.tables
  SET status = v_status,
      updated_at = timezone('utc', now()),
      last_updated_by = p_user_id
  WHERE id = p_table_id
  RETURNING id, name, status, last_updated_by, updated_at
  INTO v_id, v_name, v_status, v_last_updated_by, v_updated_at;

  -- Insertar registro de auditoría
  INSERT INTO public.audit_log (table_name, record_id, action, user_id, business_id, new_data, created_at)
  VALUES ('tables', p_table_id, upper(p_action_type), p_user_id, v_table_business, 
          jsonb_build_object('status', v_status, 'notes', p_notes), timezone('utc', now()));

  -- Devolver la fila actualizada (single-row result)
  RETURN QUERY SELECT v_id, v_name, v_status, v_last_updated_by, v_updated_at;
END;
$$;

-- ============================================================
-- 3. CREAR ÍNDICE COMPUESTO PARA OPTIMIZACIÓN
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_tables_id_status ON public.tables (id, status);

-- ============================================================
-- 4. CONFIGURAR RLS Y POLÍTICAS
-- ============================================================
-- Habilitar RLS
ALTER TABLE IF EXISTS public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_log ENABLE ROW LEVEL SECURITY;

-- Política para `tables`: permitir SELECT/UPDATE sólo si business_id coincide con el claim JWT
DROP POLICY IF EXISTS tables_business_policy ON public.tables CASCADE;
CREATE POLICY tables_business_policy ON public.tables
  USING (
    business_id = (current_setting('jwt.claims', true)::json->>'business')::uuid
  )
  WITH CHECK (
    business_id = (current_setting('jwt.claims', true)::json->>'business')::uuid
  );

-- Política para `audit_log`: permitir SELECT sólo a usuarios del mismo business
DROP POLICY IF EXISTS audit_log_business_policy ON public.audit_log CASCADE;
CREATE POLICY audit_log_business_policy ON public.audit_log
  USING (
    business_id = (current_setting('jwt.claims', true)::json->>'business')::uuid
  );

-- ============================================================
-- 5. SEGURIDAD: FIJAR OWNER Y PERMISOS (EJECUTAR COMO SUPERUSER)
-- ============================================================
-- Descomentar y ejecutar como superuser (postgres) si deseas fijar owner:
-- ALTER FUNCTION public.handle_table_transaction(uuid,text,uuid,text) OWNER TO postgres;
-- ALTER FUNCTION public.handle_table_transaction(uuid,text,uuid,text) SET search_path = public;
-- GRANT EXECUTE ON FUNCTION public.handle_table_transaction(uuid,text,uuid,text) TO authenticated;

-- ============================================================
-- NOTAS DE SEGURIDAD Y USO
-- ============================================================
-- 1. La función está marcada SECURITY DEFINER para ejecutarse con privilegios elevados.
-- 2. Valida el claim JWT 'business' para asegurar que el caller pertenece al mismo business.
-- 3. Usa índice compuesto (id, status) para acelerar lookups en la tabla tables.
-- 4. Todas las operaciones (UPDATE + INSERT) ocurren en una SOLA transacción = 1 round-trip.
-- 
-- INVOCACIÓN DESDE CLIENTE:
-- const { data, error } = await supabase.rpc('handle_table_transaction', {
--   p_table_id: '<uuid>',
--   p_action_type: 'open' | 'close',
--   p_user_id: '<uuid>',
--   p_notes: 'notas opcionales'
-- });
