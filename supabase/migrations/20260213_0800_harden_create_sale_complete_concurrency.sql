-- ============================================================
-- BLOCK 2 - Concurrencia en cierre simple
-- Fecha: 2026-02-13
-- Objetivo: evitar doble cierre concurrente de mesa/orden
-- en create_sale_complete mediante locks y estado esperado.
-- ============================================================

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
SET search_path = public
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

  v_auth_uid uuid;
  v_order_business uuid;
  v_order_status text;
  v_table_business uuid;
  v_table_current_order uuid;
BEGIN
  -- ========== AUTORIZACIÓN Y AISLAMIENTO TENANT ==========
  v_auth_uid := auth.uid();

  IF p_business_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_business_id y p_user_id son obligatorios';
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

  -- ========== LOCKS + CONSISTENCIA ORDER/TABLE ==========
  IF p_order_id IS NOT NULL THEN
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
  END IF;

  IF p_table_id IS NOT NULL THEN
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
  END IF;

  IF p_order_id IS NOT NULL AND p_table_id IS NOT NULL THEN
    IF v_table_current_order IS DISTINCT FROM p_order_id THEN
      RAISE EXCEPTION 'La mesa % no está asociada a la orden %', p_table_id, p_order_id;
    END IF;
  END IF;

  -- Resolver rol/owner en servidor y forzar seller_name correcto para admins.
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

  -- ========== VALIDACIONES ==========
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'La venta debe tener al menos un producto';
  END IF;

  SELECT COALESCE(SUM(
    ((item->>'quantity')::numeric) * ((item->>'unit_price')::numeric)
  ), 0)
  INTO v_total_preview
  FROM jsonb_array_elements(p_items) AS item;

  -- ========== CREAR VENTA ==========
  INSERT INTO public.sales (
    business_id,
    user_id,
    seller_name,
    payment_method,
    total,
    created_at
  ) VALUES (
    p_business_id,
    p_user_id,
    v_seller_name,
    COALESCE(p_payment_method, 'cash'),
    v_total_preview,
    timezone('utc', now())
  ) RETURNING id INTO v_sale_id;

  -- ========== PROCESAR CADA ITEM ==========
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

    IF v_current_stock < v_quantity THEN
      RAISE EXCEPTION 'Stock insuficiente para producto %. Disponible: %, solicitado: %',
        v_product_id, v_current_stock, v_quantity;
    END IF;

    INSERT INTO public.sale_details (
      sale_id,
      product_id,
      quantity,
      unit_price
    ) VALUES (
      v_sale_id,
      v_product_id,
      v_quantity,
      v_unit_price
    );

    UPDATE public.products
    SET stock = stock - v_quantity
    WHERE id = v_product_id
      AND business_id = p_business_id;

    v_total := v_total + (v_quantity * v_unit_price);
    v_item_count := v_item_count + 1;
  END LOOP;

  UPDATE public.sales
  SET total = v_total
  WHERE id = v_sale_id
    AND business_id = p_business_id;

  -- Cerrar orden/liberar mesa después de crear venta.
  IF p_order_id IS NOT NULL THEN
    UPDATE public.orders
    SET status = 'closed',
        closed_at = timezone('utc', now())
    WHERE id = p_order_id
      AND business_id = p_business_id
      AND lower(coalesce(status, '')) = 'open';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'La orden % cambió de estado durante el cierre', p_order_id;
    END IF;
  END IF;

  IF p_table_id IS NOT NULL THEN
    UPDATE public.tables
    SET current_order_id = NULL,
        status = 'available'
    WHERE id = p_table_id
      AND business_id = p_business_id
      AND (p_order_id IS NULL OR current_order_id = p_order_id);

    IF NOT FOUND THEN
      RAISE EXCEPTION 'La mesa % cambió durante el cierre', p_table_id;
    END IF;
  END IF;

  RETURN QUERY SELECT
    v_sale_id,
    v_total,
    v_item_count,
    'success'::text;

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Error al crear venta: %', SQLERRM;
END;
$$;

REVOKE ALL ON FUNCTION public.create_sale_complete(uuid,uuid,text,text,jsonb,uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_sale_complete(uuid,uuid,text,text,jsonb,uuid,uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_sale_complete(uuid,uuid,text,text,jsonb,uuid,uuid) TO authenticated;

COMMENT ON FUNCTION public.create_sale_complete(uuid,uuid,text,text,jsonb,uuid,uuid)
IS 'Crea venta completa con validación multi-tenant y locks de concurrencia para cierre de orden/mesa.';
