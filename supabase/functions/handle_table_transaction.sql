-- SQL: handle_table_transaction
-- Ejecutar como role con privilegios (p. ej. postgres/service_role) para crear la funcion
-- Esta funcion realiza UPDATE en tables e INSERT en audit_log en una sola transaccion

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
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_name text;
  v_status text;
  v_last_updated_by uuid;
  v_updated_at timestamptz;
  v_table_business uuid;
BEGIN
  SELECT business_id INTO v_table_business FROM public.tables WHERE id = p_table_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'table with id % not found', p_table_id;
  END IF;

  IF NOT public.can_access_business(v_table_business) THEN
    RAISE EXCEPTION 'No autorizado para acceder a mesas de este negocio';
  END IF;

  IF lower(p_action_type) = 'open' THEN
    v_status := 'open';
  ELSIF lower(p_action_type) = 'close' THEN
    v_status := 'closed';
  ELSE
    RAISE EXCEPTION 'invalid action_type: %', p_action_type;
  END IF;

  UPDATE public.tables
  SET status = v_status,
      updated_at = timezone('utc', now()),
      last_updated_by = p_user_id
  WHERE id = p_table_id
  RETURNING id, name, status, last_updated_by, updated_at
  INTO v_id, v_name, v_status, v_last_updated_by, v_updated_at;

  INSERT INTO public.audit_log (table_name, record_id, action, user_id, business_id, new_data, created_at)
  VALUES ('tables', p_table_id, upper(p_action_type), p_user_id, v_table_business, 
          jsonb_build_object('status', v_status, 'notes', p_notes), timezone('utc', now()));

  RETURN QUERY SELECT v_id, v_name, v_status, v_last_updated_by, v_updated_at;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_tables_id_status ON public.tables (id, status);
