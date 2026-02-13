-- ============================================================
-- BLOCK 2 - Atomicidad de cierre con subcuentas
-- Fecha: 2026-02-13
-- Objetivo: evitar cierres parciales al dividir cuenta
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_split_sales_complete(
  p_business_id uuid,
  p_user_id uuid,
  p_seller_name text,
  p_sub_accounts jsonb,
  p_order_id uuid,
  p_table_id uuid
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
  v_auth_uid uuid := auth.uid();
  v_order_business uuid;
  v_order_status text;
  v_table_business uuid;
  v_table_current_order uuid;

  v_sub jsonb;
  v_items jsonb;
  v_payment_method text;

  v_sale_row record;
  v_total_sold numeric := 0;
  v_sales_count integer := 0;
BEGIN
  -- ---------- Validaciones de autorización ----------
  IF p_business_id IS NULL OR p_user_id IS NULL OR p_order_id IS NULL OR p_table_id IS NULL THEN
    RAISE EXCEPTION 'p_business_id, p_user_id, p_order_id y p_table_id son obligatorios';
  END IF;

  IF v_auth_uid IS NULL THEN
    RAISE EXCEPTION 'Sesión inválida: auth.uid() es NULL';
  END IF;

  IF v_auth_uid <> p_user_id THEN
    RAISE EXCEPTION 'No autorizado: p_user_id no coincide con auth.uid()';
  END IF;

  IF NOT public.can_access_business(p_business_id) THEN
    RAISE EXCEPTION 'No autorizado para operar en este negocio';
  END IF;

  IF p_sub_accounts IS NULL OR jsonb_typeof(p_sub_accounts) <> 'array' OR jsonb_array_length(p_sub_accounts) = 0 THEN
    RAISE EXCEPTION 'p_sub_accounts debe ser un arreglo JSON no vacío';
  END IF;

  -- ---------- Locks + consistencia order/table ----------
  SELECT o.business_id, o.status
  INTO v_order_business, v_order_status
  FROM public.orders o
  WHERE o.id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orden % no encontrada', p_order_id;
  END IF;

  IF v_order_business <> p_business_id THEN
    RAISE EXCEPTION 'Orden % no pertenece al negocio %', p_order_id, p_business_id;
  END IF;

  IF lower(coalesce(v_order_status, '')) <> 'open' THEN
    RAISE EXCEPTION 'La orden % no está abierta', p_order_id;
  END IF;

  SELECT t.business_id, t.current_order_id
  INTO v_table_business, v_table_current_order
  FROM public.tables t
  WHERE t.id = p_table_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mesa % no encontrada', p_table_id;
  END IF;

  IF v_table_business <> p_business_id THEN
    RAISE EXCEPTION 'Mesa % no pertenece al negocio %', p_table_id, p_business_id;
  END IF;

  IF v_table_current_order IS DISTINCT FROM p_order_id THEN
    RAISE EXCEPTION 'La mesa % no está asociada a la orden %', p_table_id, p_order_id;
  END IF;

  -- ---------- Crear ventas por subcuenta en una sola transacción ----------
  FOR v_sub IN SELECT value FROM jsonb_array_elements(p_sub_accounts)
  LOOP
    v_items := COALESCE(v_sub->'items', '[]'::jsonb);

    IF jsonb_typeof(v_items) = 'array' AND jsonb_array_length(v_items) > 0 THEN
      v_payment_method := NULLIF(trim(COALESCE(v_sub->>'paymentMethod', v_sub->>'payment_method', 'cash')), '');
      IF v_payment_method IS NULL THEN
        v_payment_method := 'cash';
      END IF;

      SELECT c.*
      INTO v_sale_row
      FROM public.create_sale_complete(
        p_business_id,
        p_user_id,
        p_seller_name,
        v_payment_method,
        v_items,
        NULL,
        NULL
      ) c
      LIMIT 1;

      v_total_sold := v_total_sold + COALESCE(v_sale_row.total_amount, 0);
      v_sales_count := v_sales_count + 1;
    END IF;
  END LOOP;

  IF v_sales_count = 0 THEN
    RAISE EXCEPTION 'No hay subcuentas con items para cerrar';
  END IF;

  -- ---------- Cerrar orden y liberar mesa (atómico al final) ----------
  UPDATE public.orders
  SET status = 'closed',
      closed_at = timezone('utc', now())
  WHERE id = p_order_id
    AND business_id = p_business_id;

  UPDATE public.tables
  SET current_order_id = NULL,
      status = 'available'
  WHERE id = p_table_id
    AND business_id = p_business_id
    AND current_order_id = p_order_id;

  RETURN QUERY SELECT v_total_sold, v_sales_count, 'success'::text;
END;
$$;

REVOKE ALL ON FUNCTION public.create_split_sales_complete(uuid,uuid,text,jsonb,uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_split_sales_complete(uuid,uuid,text,jsonb,uuid,uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_split_sales_complete(uuid,uuid,text,jsonb,uuid,uuid) TO authenticated;

COMMENT ON FUNCTION public.create_split_sales_complete(uuid,uuid,text,jsonb,uuid,uuid)
IS 'Cierra subcuentas de una orden en una sola transacción, evita cierres parciales y valida multi-tenant.';
