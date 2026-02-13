-- ============================================================
-- BLOCK 3 - Wrappers idempotentes para ventas
-- Fecha: 2026-02-13
-- Objetivo: deduplicar cierres de orden/split sin alterar lógica core.
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_sale_complete_idempotent(
  p_business_id uuid,
  p_user_id uuid,
  p_seller_name text,
  p_payment_method text,
  p_items jsonb,
  p_order_id uuid DEFAULT NULL,
  p_table_id uuid DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS TABLE (
  sale_id uuid,
  total_amount numeric,
  items_count integer,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action_name constant text := 'create_sale_complete';
  v_inserted_count integer := 0;
  v_existing_status text;
  v_existing_response jsonb;
  v_sale_row record;
BEGIN
  IF p_idempotency_key IS NULL OR btrim(p_idempotency_key) = '' THEN
    RETURN QUERY
    SELECT *
    FROM public.create_sale_complete(
      p_business_id,
      p_user_id,
      p_seller_name,
      p_payment_method,
      p_items,
      p_order_id,
      p_table_id
    );
    RETURN;
  END IF;

  INSERT INTO public.idempotency_requests (
    idempotency_key,
    action_name,
    user_id,
    business_id,
    request_payload,
    status
  ) VALUES (
    p_idempotency_key,
    v_action_name,
    p_user_id,
    p_business_id,
    jsonb_build_object(
      'payment_method', p_payment_method,
      'order_id', p_order_id,
      'table_id', p_table_id,
      'items_count', COALESCE(jsonb_array_length(p_items), 0)
    ),
    'processing'
  )
  ON CONFLICT (idempotency_key) DO NOTHING;

  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;

  SELECT ir.status, ir.response_payload
  INTO v_existing_status, v_existing_response
  FROM public.idempotency_requests ir
  WHERE ir.idempotency_key = p_idempotency_key
    AND ir.action_name = v_action_name
    AND ir.user_id = p_user_id
    AND ir.business_id = p_business_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conflicto de idempotencia: clave no disponible para esta operación';
  END IF;

  IF v_inserted_count = 0 THEN
    IF v_existing_status = 'completed' AND v_existing_response IS NOT NULL THEN
      RETURN QUERY
      SELECT
        (v_existing_response->>'sale_id')::uuid,
        COALESCE((v_existing_response->>'total_amount')::numeric, 0),
        COALESCE((v_existing_response->>'items_count')::integer, 0),
        COALESCE(v_existing_response->>'status', 'success');
      RETURN;
    ELSIF v_existing_status = 'processing' THEN
      RAISE EXCEPTION 'La operación ya está en procesamiento para esta clave idempotente';
    ELSE
      UPDATE public.idempotency_requests
      SET status = 'processing',
          error_message = NULL,
          response_payload = NULL
      WHERE idempotency_key = p_idempotency_key;
    END IF;
  END IF;

  SELECT c.*
  INTO v_sale_row
  FROM public.create_sale_complete(
    p_business_id,
    p_user_id,
    p_seller_name,
    p_payment_method,
    p_items,
    p_order_id,
    p_table_id
  ) c
  LIMIT 1;

  UPDATE public.idempotency_requests
  SET status = 'completed',
      response_payload = jsonb_build_object(
        'sale_id', v_sale_row.sale_id,
        'total_amount', v_sale_row.total_amount,
        'items_count', v_sale_row.items_count,
        'status', v_sale_row.status
      ),
      error_message = NULL,
      completed_at = now()
  WHERE idempotency_key = p_idempotency_key;

  RETURN QUERY
  SELECT v_sale_row.sale_id, v_sale_row.total_amount, v_sale_row.items_count, v_sale_row.status;

EXCEPTION WHEN OTHERS THEN
  UPDATE public.idempotency_requests
  SET status = 'failed',
      error_message = SQLERRM,
      completed_at = now()
  WHERE idempotency_key = p_idempotency_key
    AND action_name = v_action_name
    AND user_id = p_user_id
    AND business_id = p_business_id;

  RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.create_sale_complete_idempotent(uuid,uuid,text,text,jsonb,uuid,uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_sale_complete_idempotent(uuid,uuid,text,text,jsonb,uuid,uuid,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_sale_complete_idempotent(uuid,uuid,text,text,jsonb,uuid,uuid,text) TO authenticated;

COMMENT ON FUNCTION public.create_sale_complete_idempotent(uuid,uuid,text,text,jsonb,uuid,uuid,text)
IS 'Wrapper idempotente de create_sale_complete. Reintentos con misma clave devuelven la misma respuesta.';

CREATE OR REPLACE FUNCTION public.create_split_sales_complete_idempotent(
  p_business_id uuid,
  p_user_id uuid,
  p_seller_name text,
  p_sub_accounts jsonb,
  p_order_id uuid,
  p_table_id uuid,
  p_idempotency_key text DEFAULT NULL
)
RETURNS TABLE (
  total_sold numeric,
  sales_count integer,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action_name constant text := 'create_split_sales_complete';
  v_inserted_count integer := 0;
  v_existing_status text;
  v_existing_response jsonb;
  v_split_row record;
BEGIN
  IF p_idempotency_key IS NULL OR btrim(p_idempotency_key) = '' THEN
    RETURN QUERY
    SELECT *
    FROM public.create_split_sales_complete(
      p_business_id,
      p_user_id,
      p_seller_name,
      p_sub_accounts,
      p_order_id,
      p_table_id
    );
    RETURN;
  END IF;

  INSERT INTO public.idempotency_requests (
    idempotency_key,
    action_name,
    user_id,
    business_id,
    request_payload,
    status
  ) VALUES (
    p_idempotency_key,
    v_action_name,
    p_user_id,
    p_business_id,
    jsonb_build_object(
      'order_id', p_order_id,
      'table_id', p_table_id,
      'sub_accounts_count', COALESCE(jsonb_array_length(p_sub_accounts), 0)
    ),
    'processing'
  )
  ON CONFLICT (idempotency_key) DO NOTHING;

  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;

  SELECT ir.status, ir.response_payload
  INTO v_existing_status, v_existing_response
  FROM public.idempotency_requests ir
  WHERE ir.idempotency_key = p_idempotency_key
    AND ir.action_name = v_action_name
    AND ir.user_id = p_user_id
    AND ir.business_id = p_business_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conflicto de idempotencia: clave no disponible para esta operación';
  END IF;

  IF v_inserted_count = 0 THEN
    IF v_existing_status = 'completed' AND v_existing_response IS NOT NULL THEN
      RETURN QUERY
      SELECT
        COALESCE((v_existing_response->>'total_sold')::numeric, 0),
        COALESCE((v_existing_response->>'sales_count')::integer, 0),
        COALESCE(v_existing_response->>'status', 'success');
      RETURN;
    ELSIF v_existing_status = 'processing' THEN
      RAISE EXCEPTION 'La operación ya está en procesamiento para esta clave idempotente';
    ELSE
      UPDATE public.idempotency_requests
      SET status = 'processing',
          error_message = NULL,
          response_payload = NULL
      WHERE idempotency_key = p_idempotency_key;
    END IF;
  END IF;

  SELECT c.*
  INTO v_split_row
  FROM public.create_split_sales_complete(
    p_business_id,
    p_user_id,
    p_seller_name,
    p_sub_accounts,
    p_order_id,
    p_table_id
  ) c
  LIMIT 1;

  UPDATE public.idempotency_requests
  SET status = 'completed',
      response_payload = jsonb_build_object(
        'total_sold', v_split_row.total_sold,
        'sales_count', v_split_row.sales_count,
        'status', v_split_row.status
      ),
      error_message = NULL,
      completed_at = now()
  WHERE idempotency_key = p_idempotency_key;

  RETURN QUERY
  SELECT v_split_row.total_sold, v_split_row.sales_count, v_split_row.status;

EXCEPTION WHEN OTHERS THEN
  UPDATE public.idempotency_requests
  SET status = 'failed',
      error_message = SQLERRM,
      completed_at = now()
  WHERE idempotency_key = p_idempotency_key
    AND action_name = v_action_name
    AND user_id = p_user_id
    AND business_id = p_business_id;

  RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.create_split_sales_complete_idempotent(uuid,uuid,text,jsonb,uuid,uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_split_sales_complete_idempotent(uuid,uuid,text,jsonb,uuid,uuid,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_split_sales_complete_idempotent(uuid,uuid,text,jsonb,uuid,uuid,text) TO authenticated;

COMMENT ON FUNCTION public.create_split_sales_complete_idempotent(uuid,uuid,text,jsonb,uuid,uuid,text)
IS 'Wrapper idempotente de create_split_sales_complete para evitar doble cierre por reintento.';
