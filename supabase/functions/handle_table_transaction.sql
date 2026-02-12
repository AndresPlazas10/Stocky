-- SQL: handle_table_transaction
-- Ejecutar como role con privilegios (p. ej. postgres/service_role) para crear la función
-- Esta función realiza UPDATE en tables e INSERT en audit_log en una sola transacción

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
$$ SECURITY DEFINER;

-- Opciones de seguridad/owner/privilegios
-- Ajustar el owner al role de servicio que deba ejecutar la función (ejecutar como superusuario):
--   ALTER FUNCTION public.handle_table_transaction(uuid,text,uuid,text) OWNER TO postgres;
-- Fijar search_path explícito para evitar resolución ambigua de objetos (opcional):
--   ALTER FUNCTION public.handle_table_transaction(uuid,text,uuid,text) SET search_path = public;
-- Conceder ejecución únicamente al role 'authenticated' (o al role que uses en Supabase):
--   GRANT EXECUTE ON FUNCTION public.handle_table_transaction(uuid,text,uuid,text) TO authenticated;

-- Crear índice compuesto para acelerar filtros por id + status
CREATE INDEX IF NOT EXISTS idx_tables_id_status ON public.tables (id, status);

-- RECOMENDACIONES DE SEGURIDAD (ejecutar como superusuario o owner adecuado):
-- 1) Cambiar el owner de la función al role que deba ejecutar privilegios elevados (p. ej. postgres)
--    ALTER FUNCTION public.handle_table_transaction(uuid,text,uuid,text) OWNER TO postgres;
-- 2) Restringir quién puede ejecutar la función (dar solo al rol 'authenticated' si usas Supabase):
--    GRANT EXECUTE ON FUNCTION public.handle_table_transaction(uuid,text,uuid,text) TO authenticated;
-- 3) Asegurar search_path explícito si es necesario:
--    ALTER FUNCTION public.handle_table_transaction(uuid,text,uuid,text) SET search_path = public;

-- Nota: la función está marcada SECURITY DEFINER para que se ejecute con los permisos del owner
-- (esto evita que RLS sobre las tablas bloqueen la actualización si el owner tiene acceso).
-- Para mantener seguridad, la función debe validar permisos de entrada (p_user_id / tenant) antes
-- de realizar cambios, por ejemplo comprobando que p_user_id pertenece al tenant de la mesa.
