-- ============================================================
-- Fix: evitar falsos duplicados en split sales por created_at
-- Fecha: 2026-02-20
-- Objetivo:
--   Cuando create_split_sales_complete crea varias ventas dentro
--   de la misma transacción, now() devuelve el mismo timestamp.
--   Si dos subcuentas tienen el mismo total, choca con
--   idx_sales_prevent_duplicates (business_id,user_id,total,created_at).
--   Se cambia SOLO created_at de sales a clock_timestamp().
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
  v_combo_id uuid;
  v_quantity numeric;
  v_unit_price numeric;
  v_seller_name text;
  v_emp_full_name text;
  v_emp_role text;
  v_emp_role_norm text;
  v_business_owner uuid;
  v_item_count integer := 0;

  v_auth_uid uuid;
  v_order_business uuid;
  v_order_status text;
  v_table_business uuid;
  v_table_current_order uuid;

  v_product_name text;
  v_product_sale_price numeric;
  v_combo_name text;
  v_combo_sale_price numeric;
  v_combo_status text;

  v_expected_stock_products integer := 0;
  v_found_stock_products integer := 0;
  v_stock_row record;
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

  -- ========== VALIDACIONES BASE ==========
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'La venta debe tener al menos un producto o combo';
  END IF;

  -- Tablas temporales por transacción para procesar líneas + consumo de stock.
  CREATE TEMP TABLE IF NOT EXISTS tmp_sale_lines (
    line_type text NOT NULL,
    product_id uuid,
    combo_id uuid,
    quantity numeric NOT NULL,
    unit_price numeric NOT NULL
  ) ON COMMIT DROP;

  CREATE TEMP TABLE IF NOT EXISTS tmp_stock_updates (
    product_id uuid PRIMARY KEY,
    qty_total numeric NOT NULL,
    requires_stock_check boolean NOT NULL DEFAULT false
  ) ON COMMIT DROP;

  TRUNCATE tmp_sale_lines;
  TRUNCATE tmp_stock_updates;

  -- ========== NORMALIZAR ITEMS DE ENTRADA ==========
  FOR v_item IN SELECT jsonb_array_elements(p_items)
  LOOP
    v_product_id := NULLIF(trim(coalesce(v_item->>'product_id', '')), '')::uuid;
    v_combo_id := NULLIF(trim(coalesce(v_item->>'combo_id', '')), '')::uuid;

    IF (v_product_id IS NULL AND v_combo_id IS NULL)
       OR (v_product_id IS NOT NULL AND v_combo_id IS NOT NULL) THEN
      RAISE EXCEPTION 'Cada item debe tener exactamente un product_id o combo_id';
    END IF;

    v_quantity := (v_item->>'quantity')::numeric;
    IF v_quantity IS NULL OR v_quantity <= 0 THEN
      RAISE EXCEPTION 'Cantidad debe ser mayor a 0';
    END IF;

    v_unit_price := NULLIF(trim(coalesce(v_item->>'unit_price', '')), '')::numeric;

    -- ---- Línea tipo producto ----
    IF v_product_id IS NOT NULL THEN
      SELECT p.name, p.sale_price
      INTO v_product_name, v_product_sale_price
      FROM public.products p
      WHERE p.id = v_product_id
        AND p.business_id = p_business_id
        AND p.is_active = true
      LIMIT 1;

      IF v_product_name IS NULL THEN
        RAISE EXCEPTION 'Producto % no encontrado o no activo', v_product_id;
      END IF;

      IF v_unit_price IS NULL THEN
        v_unit_price := COALESCE(v_product_sale_price, 0);
      END IF;

      IF v_unit_price < 0 THEN
        RAISE EXCEPTION 'Precio inválido para producto %', v_product_name;
      END IF;

      INSERT INTO tmp_sale_lines (line_type, product_id, combo_id, quantity, unit_price)
      VALUES ('product', v_product_id, NULL, v_quantity, v_unit_price);

      INSERT INTO tmp_stock_updates (product_id, qty_total, requires_stock_check)
      VALUES (v_product_id, v_quantity, false)
      ON CONFLICT (product_id)
      DO UPDATE SET
        qty_total = tmp_stock_updates.qty_total + EXCLUDED.qty_total;

      CONTINUE;
    END IF;

    -- ---- Línea tipo combo ----
    SELECT c.nombre, c.precio_venta, c.estado
    INTO v_combo_name, v_combo_sale_price, v_combo_status
    FROM public.combos c
    WHERE c.id = v_combo_id
      AND c.business_id = p_business_id
    LIMIT 1;

    IF v_combo_name IS NULL THEN
      RAISE EXCEPTION 'Combo % no encontrado', v_combo_id;
    END IF;

    IF lower(coalesce(v_combo_status, '')) <> 'active' THEN
      RAISE EXCEPTION 'El combo "%" está inactivo', v_combo_name;
    END IF;

    IF v_unit_price IS NULL THEN
      v_unit_price := COALESCE(v_combo_sale_price, 0);
    END IF;

    IF v_unit_price < 0 THEN
      RAISE EXCEPTION 'Precio inválido para combo "%"', v_combo_name;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.combo_items ci
      WHERE ci.combo_id = v_combo_id
    ) THEN
      RAISE EXCEPTION 'El combo "%" no tiene productos configurados', v_combo_name;
    END IF;

    INSERT INTO tmp_sale_lines (line_type, product_id, combo_id, quantity, unit_price)
    VALUES ('combo', NULL, v_combo_id, v_quantity, v_unit_price);

    INSERT INTO tmp_stock_updates (product_id, qty_total, requires_stock_check)
    SELECT
      ci.producto_id,
      (ci.cantidad * v_quantity) AS qty_total,
      true
    FROM public.combo_items ci
    WHERE ci.combo_id = v_combo_id
    ON CONFLICT (product_id)
    DO UPDATE SET
      qty_total = tmp_stock_updates.qty_total + EXCLUDED.qty_total,
      requires_stock_check = (tmp_stock_updates.requires_stock_check OR EXCLUDED.requires_stock_check);
  END LOOP;

  SELECT
    COALESCE(SUM(l.quantity * l.unit_price), 0),
    COUNT(*)
  INTO v_total_preview, v_item_count
  FROM tmp_sale_lines l;

  IF v_item_count <= 0 THEN
    RAISE EXCEPTION 'La venta debe tener al menos un item válido';
  END IF;

  -- ========== VALIDACIÓN DE STOCK (solo productos internos de combos) ==========
  SELECT COUNT(*)
  INTO v_expected_stock_products
  FROM tmp_stock_updates;

  SELECT COUNT(*)
  INTO v_found_stock_products
  FROM public.products p
  JOIN tmp_stock_updates su ON su.product_id = p.id
  WHERE p.business_id = p_business_id;

  IF v_expected_stock_products <> v_found_stock_products THEN
    RAISE EXCEPTION 'No se pudo resolver el inventario para todos los productos internos del combo';
  END IF;

  FOR v_stock_row IN
    SELECT
      p.id AS product_id,
      p.name AS product_name,
      p.stock AS current_stock,
      p.is_active AS is_active,
      su.qty_total AS qty_total,
      su.requires_stock_check AS requires_stock_check
    FROM public.products p
    JOIN tmp_stock_updates su ON su.product_id = p.id
    WHERE p.business_id = p_business_id
    FOR UPDATE
  LOOP
    IF v_stock_row.is_active IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'Producto interno inactivo en inventario: %', v_stock_row.product_name;
    END IF;

    IF v_stock_row.requires_stock_check
       AND COALESCE(v_stock_row.current_stock, 0) < COALESCE(v_stock_row.qty_total, 0) THEN
      RAISE EXCEPTION
        'Stock insuficiente para "%": disponibles %, requeridos %',
        v_stock_row.product_name,
        COALESCE(v_stock_row.current_stock, 0),
        COALESCE(v_stock_row.qty_total, 0);
    END IF;
  END LOOP;

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
    timezone('utc', clock_timestamp())
  ) RETURNING id INTO v_sale_id;

  INSERT INTO public.sale_details (
    sale_id,
    product_id,
    combo_id,
    quantity,
    unit_price
  )
  SELECT
    v_sale_id,
    l.product_id,
    l.combo_id,
    l.quantity,
    l.unit_price
  FROM tmp_sale_lines l;

  -- Descuento de inventario consolidado (sin duplicar movimientos).
  UPDATE public.products p
  SET stock = p.stock - su.qty_total
  FROM tmp_stock_updates su
  WHERE p.id = su.product_id
    AND p.business_id = p_business_id;

  v_total := v_total_preview;

  UPDATE public.sales
  SET total = v_total
  WHERE id = v_sale_id
    AND business_id = p_business_id;

  IF p_order_id IS NOT NULL THEN
    UPDATE public.orders o
    SET status = 'closed',
        closed_at = timezone('utc', now())
    WHERE id = p_order_id
      AND business_id = p_business_id
      AND lower(coalesce(o.status, '')) = 'open';

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
IS 'Crea venta completa con soporte de combos estructurados. Valida stock de productos internos de combos y descuenta inventario consolidado.';
