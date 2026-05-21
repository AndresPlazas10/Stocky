-- ============================================================
-- MIGRACIÓN: Permitir eliminación de productos con historial
-- Fecha: 2026-05-21
-- ============================================================

-- 1. order_items: ON DELETE SET NULL (pedidos antiguos no bloquean)
ALTER TABLE order_items 
  DROP CONSTRAINT IF EXISTS order_items_product_id_fkey;
ALTER TABLE order_items 
  ADD CONSTRAINT order_items_product_id_fkey 
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;

-- 2. combo_items: ON DELETE CASCADE (producto en combo se elimina)
ALTER TABLE combo_items 
  DROP CONSTRAINT IF EXISTS combo_items_producto_id_fkey;
ALTER TABLE combo_items 
  ADD CONSTRAINT combo_items_producto_id_fkey 
    FOREIGN KEY (producto_id) REFERENCES products(id) ON DELETE CASCADE;

-- 3. Limpiar order_items al cerrar mesa desde create_sale_complete
CREATE OR REPLACE FUNCTION public.create_sale_complete(
  p_business_id uuid,
  p_user_id uuid,
  p_seller_name text,
  p_payment_method text,
  p_items jsonb,
  p_order_id uuid DEFAULT NULL,
  p_table_id uuid DEFAULT NULL
)
RETURNS TABLE (
  sale_id uuid,
  total_amount numeric,
  items_count integer,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_sale_id uuid;
  v_total_preview numeric := 0;
  v_total numeric := 0;
  v_item jsonb;
  v_product_id uuid;
  v_quantity numeric;
  v_unit_price numeric;
  v_seller_name text;
  v_emp_full_name text;
  v_emp_role text;
  v_emp_role_norm text;
  v_business_owner uuid;
  v_current_stock numeric;
  v_item_count integer := 0;
BEGIN
  SELECT full_name, role INTO v_emp_full_name, v_emp_role
  FROM public.employees
  WHERE user_id = p_user_id
    AND business_id = p_business_id
  LIMIT 1;

  SELECT created_by INTO v_business_owner
  FROM public.businesses
  WHERE id = p_business_id
  LIMIT 1;

  v_emp_role_norm := lower(trim(coalesce(v_emp_role, '')));

  IF (p_user_id IS NOT NULL AND v_business_owner IS NOT NULL AND p_user_id = v_business_owner)
     OR v_emp_role_norm IN ('owner', 'admin', 'administrador', 'propietario')
     OR position('admin' in v_emp_role_norm) > 0 THEN
    v_seller_name := 'Administrador';
  ELSE
    v_seller_name := NULLIF(trim(coalesce(p_seller_name, '')), '');
    IF v_seller_name IS NULL OR lower(v_seller_name) IN ('empleado','vendedor','vendedor desconocido','usuario') THEN
      IF v_emp_full_name IS NOT NULL THEN
        v_seller_name := v_emp_full_name;
      ELSE
        v_seller_name := 'Empleado';
      END IF;
    END IF;
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'La venta debe tener al menos un producto';
  END IF;

  SELECT COALESCE(SUM(
    ((item->>'quantity')::numeric) * ((item->>'unit_price')::numeric)
  ), 0)
  INTO v_total_preview
  FROM jsonb_array_elements(p_items) AS item;

  INSERT INTO public.sales (
    business_id, user_id, seller_name, payment_method, total, created_at
  ) VALUES (
    p_business_id, p_user_id, v_seller_name,
    COALESCE(p_payment_method, 'cash'), v_total_preview,
    timezone('utc', now())
  ) RETURNING id INTO v_sale_id;

  FOR v_item IN SELECT jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_quantity := (v_item->>'quantity')::numeric;
    v_unit_price := (v_item->>'unit_price')::numeric;

    IF v_quantity <= 0 THEN
      RAISE EXCEPTION 'Cantidad debe ser mayor a 0';
    END IF;

    SELECT stock INTO v_current_stock
    FROM public.products
    WHERE id = v_product_id
      AND business_id = p_business_id
      AND is_active = true
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Producto % no encontrado o no activo', v_product_id;
    END IF;

    INSERT INTO public.sale_details (
      sale_id, product_id, quantity, unit_price
    ) VALUES (
      v_sale_id, v_product_id, v_quantity, v_unit_price
    );

    UPDATE public.products
    SET stock = stock - v_quantity
    WHERE id = v_product_id;

    v_total := v_total + (v_quantity * v_unit_price);
    v_item_count := v_item_count + 1;
  END LOOP;

  UPDATE public.sales SET total = v_total WHERE id = v_sale_id;

  -- Cerrar orden y LIMPIAR order_items para no bloquear futuros deletes
  IF p_order_id IS NOT NULL THEN
    UPDATE public.orders
    SET status = 'closed', closed_at = timezone('utc', now())
    WHERE id = p_order_id;

    DELETE FROM public.order_items
    WHERE order_id = p_order_id;
  END IF;

  IF p_table_id IS NOT NULL THEN
    UPDATE public.tables
    SET current_order_id = NULL, status = 'available'
    WHERE id = p_table_id;
  END IF;

  RETURN QUERY SELECT
    v_sale_id, v_total, v_item_count, 'success'::text;

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Error al crear venta: %', SQLERRM;
END;
$$;

-- 4. Limpiar order_items en create_split_sales_complete al cerrar orden
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
SET search_path = ''
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
  v_amount_received_raw text;
  v_amount_received numeric;
  v_change_breakdown jsonb;
  v_change_amount numeric;

  v_sale_row record;
  v_total_sold numeric := 0;
  v_sales_count integer := 0;
BEGIN
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

  FOR v_sub IN SELECT value FROM jsonb_array_elements(p_sub_accounts)
  LOOP
    v_items := COALESCE(v_sub->'items', '[]'::jsonb);

    IF jsonb_typeof(v_items) = 'array' AND jsonb_array_length(v_items) > 0 THEN
      v_payment_method := NULLIF(trim(COALESCE(v_sub->>'paymentMethod', v_sub->>'payment_method', 'cash')), '');
      IF v_payment_method IS NULL THEN
        v_payment_method := 'cash';
      END IF;

      v_amount_received := NULL;
      v_change_amount := NULL;
      v_change_breakdown := '[]'::jsonb;

      IF lower(v_payment_method) = 'cash' THEN
        v_amount_received_raw := NULLIF(trim(COALESCE(v_sub->>'amountReceived', v_sub->>'amount_received', '')), '');
        IF v_amount_received_raw IS NOT NULL
           AND v_amount_received_raw ~ '^-?\d+(\.\d+)?$' THEN
          v_amount_received := round(v_amount_received_raw::numeric, 2);
          IF v_amount_received < 0 THEN
            v_amount_received := NULL;
          END IF;
        END IF;

        IF jsonb_typeof(v_sub->'changeBreakdown') = 'array' THEN
          v_change_breakdown := v_sub->'changeBreakdown';
        ELSIF jsonb_typeof(v_sub->'change_breakdown') = 'array' THEN
          v_change_breakdown := v_sub->'change_breakdown';
        END IF;
      END IF;

      SELECT c.*
      INTO v_sale_row
      FROM public.create_sale_complete(
        p_business_id, p_user_id, p_seller_name,
        v_payment_method, v_items,
        NULL, NULL
      ) c
      LIMIT 1;

      IF lower(v_payment_method) = 'cash' THEN
        SELECT COALESCE(SUM(
          ((entry->>'denomination')::numeric) * ((entry->>'count')::numeric)
        ), 0)
        INTO v_change_amount
        FROM jsonb_array_elements(COALESCE(v_change_breakdown, '[]'::jsonb)) AS entry
        WHERE jsonb_typeof(entry) = 'object'
          AND (entry ? 'denomination')
          AND (entry ? 'count')
          AND (entry->>'denomination') ~ '^-?\d+(\.\d+)?$'
          AND (entry->>'count') ~ '^-?\d+(\.\d+)?$'
          AND (entry->>'count')::numeric > 0;

        IF v_amount_received IS NOT NULL AND COALESCE(v_change_amount, 0) <= 0 THEN
          v_change_amount := GREATEST(v_amount_received - COALESCE(v_sale_row.total_amount, 0), 0);
        END IF;

        UPDATE public.sales
        SET amount_received = v_amount_received,
            change_amount = COALESCE(v_change_amount, 0),
            change_breakdown = COALESCE(v_change_breakdown, '[]'::jsonb)
        WHERE id = v_sale_row.sale_id
          AND business_id = p_business_id;
      END IF;

      v_total_sold := v_total_sold + COALESCE(v_sale_row.total_amount, 0);
      v_sales_count := v_sales_count + 1;
    END IF;
  END LOOP;

  IF v_sales_count = 0 THEN
    RAISE EXCEPTION 'No hay subcuentas con items para cerrar';
  END IF;

  UPDATE public.orders
  SET status = 'closed', closed_at = timezone('utc', now())
  WHERE id = p_order_id AND business_id = p_business_id;

  -- Limpiar order_items para no bloquear futuros deletes de producto
  DELETE FROM public.order_items
  WHERE order_id = p_order_id;

  UPDATE public.tables
  SET current_order_id = NULL, status = 'available'
  WHERE id = p_table_id AND business_id = p_business_id AND current_order_id = p_order_id;

  RETURN QUERY SELECT v_total_sold, v_sales_count, 'success'::text;
END;
$$;

REVOKE ALL ON FUNCTION public.create_split_sales_complete(uuid,uuid,text,jsonb,uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_split_sales_complete(uuid,uuid,text,jsonb,uuid,uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_split_sales_complete(uuid,uuid,text,jsonb,uuid,uuid) TO authenticated;
