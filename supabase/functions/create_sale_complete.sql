-- ============================================================
-- FUNCIÓN RPC OPTIMIZADA: create_sale_complete
-- Crea venta + detalles + actualiza stock en UNA SOLA TRANSACCIÓN
-- ============================================================
-- Objetivo: Reducir ~1000ms a ~100-150ms

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
  -- Resolver rol/owner en servidor y forzar seller_name correcto para admins.
  -- Esto evita depender del valor enviado por el cliente.
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
    -- Determinar seller_name en servidor si el cliente no provee uno útil
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

  -- Precalcular total para insertar la venta con el monto correcto desde el inicio
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

    -- Validar cantidad
    IF v_quantity <= 0 THEN
      RAISE EXCEPTION 'Cantidad debe ser mayor a 0';
    END IF;

    -- Obtener stock actual y validar
    SELECT stock INTO v_current_stock
    FROM public.products
    WHERE id = v_product_id
      AND business_id = p_business_id
      AND is_active = true
    FOR UPDATE;  -- Lock para evitar race conditions

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Producto % no encontrado o no activo', v_product_id;
    END IF;

    IF v_current_stock < v_quantity THEN
      RAISE EXCEPTION 'Stock insuficiente para producto %. Disponible: %, solicitado: %',
        v_product_id, v_current_stock, v_quantity;
    END IF;

    -- Insertar detalle de venta
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

    -- Actualizar stock
    UPDATE public.products
    SET stock = stock - v_quantity
    WHERE id = v_product_id;

    -- Acumular total
    v_total := v_total + (v_quantity * v_unit_price);
    v_item_count := v_item_count + 1;
  END LOOP;

  -- ========== ACTUALIZAR TOTAL EN VENTA ==========
  UPDATE public.sales
  SET total = v_total
  WHERE id = v_sale_id;

  -- ========== CERRAR ORDEN Y LIBERAR MESA (si aplica) ==========
  IF p_order_id IS NOT NULL THEN
    UPDATE public.orders
    SET status = 'closed', closed_at = timezone('utc', now())
    WHERE id = p_order_id;
  END IF;

  IF p_table_id IS NOT NULL THEN
    UPDATE public.tables
    SET current_order_id = NULL, status = 'available'
    WHERE id = p_table_id;
  END IF;

  -- ========== RETORNAR RESULTADO ==========
  RETURN QUERY SELECT
    v_sale_id,
    v_total,
    v_item_count,
    'success'::text;

EXCEPTION WHEN OTHERS THEN
  -- Rollback automático por la transacción
  RAISE EXCEPTION 'Error al crear venta: %', SQLERRM;
END;
$$;

-- ============================================================
-- CONFIGURACIÓN DE SEGURIDAD
-- ============================================================
-- Ejecutar como superusuario:

-- ALTER FUNCTION public.create_sale_complete(uuid, uuid, text, text, jsonb) 
--   OWNER TO postgres;
-- ALTER FUNCTION public.create_sale_complete(uuid, uuid, text, text, jsonb) 
--   SET search_path = public;
-- GRANT EXECUTE ON FUNCTION public.create_sale_complete(uuid, uuid, text, text, jsonb) 
--   TO authenticated;

-- ============================================================
-- ÍNDICES PARA OPTIMIZACIÓN (si no existen)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_products_id_business_stock 
  ON public.products (id, business_id, stock);

CREATE INDEX IF NOT EXISTS idx_sale_details_sale_id 
  ON public.sale_details (sale_id);

CREATE INDEX IF NOT EXISTS idx_sales_business_created 
  ON public.sales (business_id, created_at DESC);
