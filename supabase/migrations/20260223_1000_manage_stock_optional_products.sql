-- ============================================================
-- Stock opcional por producto
-- Fecha: 2026-02-23
-- Objetivo:
--   1) Permitir productos sin control de inventario.
--   2) Ajustar creación/venta/compra para respetar manage_stock.
--   3) Mantener compatibilidad con funciones existentes.
-- ============================================================

-- -----------------------------------------------------------------
-- 1) Columna manage_stock en products
-- -----------------------------------------------------------------
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS manage_stock boolean;

UPDATE public.products
SET manage_stock = true
WHERE manage_stock IS NULL;

ALTER TABLE public.products
  ALTER COLUMN manage_stock SET DEFAULT true;

ALTER TABLE public.products
  ALTER COLUMN manage_stock SET NOT NULL;

COMMENT ON COLUMN public.products.manage_stock
IS 'true: valida y descuenta inventario en ventas/compras. false: no valida ni actualiza stock.';

CREATE INDEX IF NOT EXISTS idx_products_low_stock_alert_managed
  ON public.products (business_id, stock, min_stock)
  WHERE is_active = true
    AND manage_stock = true
    AND stock <= min_stock;

-- -----------------------------------------------------------------
-- 2) create_product_with_generated_code con manage_stock
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_product_with_generated_code(
  p_business_id uuid,
  p_name text,
  p_category text,
  p_purchase_price numeric DEFAULT 0,
  p_sale_price numeric DEFAULT 0,
  p_stock integer DEFAULT 0,
  p_min_stock integer DEFAULT 5,
  p_unit text DEFAULT 'unit',
  p_supplier_id uuid DEFAULT NULL,
  p_is_active boolean DEFAULT true,
  p_manage_stock boolean DEFAULT true
)
RETURNS TABLE (
  id uuid,
  code text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_next_number integer;
  v_code text;
  v_product_id uuid;
  v_has_access boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sesión inválida: auth.uid() es NULL';
  END IF;

  IF p_business_id IS NULL THEN
    RAISE EXCEPTION 'p_business_id es obligatorio';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.businesses b
    WHERE b.id = p_business_id
      AND b.created_by = v_uid
  ) OR EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.business_id = p_business_id
      AND e.user_id = v_uid
      AND e.is_active = true
  )
  INTO v_has_access;

  IF NOT v_has_access THEN
    RAISE EXCEPTION 'No autorizado para operar en este negocio';
  END IF;

  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'El nombre del producto es obligatorio';
  END IF;

  IF p_category IS NULL OR btrim(p_category) = '' THEN
    RAISE EXCEPTION 'La categoría del producto es obligatoria';
  END IF;

  IF COALESCE(p_sale_price, 0) <= 0 THEN
    RAISE EXCEPTION 'El precio de venta debe ser mayor a 0';
  END IF;

  IF COALESCE(p_purchase_price, 0) < 0 THEN
    RAISE EXCEPTION 'El precio de compra no puede ser negativo';
  END IF;

  IF p_supplier_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.suppliers s
      WHERE s.id = p_supplier_id
        AND s.business_id = p_business_id
    ) THEN
      RAISE EXCEPTION 'Proveedor no válido para este negocio';
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_business_id::text));

  SELECT COALESCE(MAX(
    CASE
      WHEN p.code ~ '^PRD-[0-9]{4}$' THEN substring(p.code from 5)::integer
      ELSE NULL
    END
  ), 0) + 1
  INTO v_next_number
  FROM public.products p
  WHERE p.business_id = p_business_id;

  IF v_next_number > 9999 THEN
    RAISE EXCEPTION 'Se alcanzó el límite de códigos secuenciales PRD-9999 para este negocio';
  END IF;

  v_code := 'PRD-' || lpad(v_next_number::text, 4, '0');

  INSERT INTO public.products (
    business_id,
    name,
    code,
    category,
    purchase_price,
    sale_price,
    stock,
    min_stock,
    unit,
    supplier_id,
    is_active,
    manage_stock,
    created_at
  ) VALUES (
    p_business_id,
    btrim(p_name),
    v_code,
    btrim(p_category),
    COALESCE(p_purchase_price, 0),
    COALESCE(p_sale_price, 0),
    COALESCE(p_stock, 0),
    COALESCE(p_min_stock, 5),
    COALESCE(NULLIF(btrim(p_unit), ''), 'unit'),
    p_supplier_id,
    COALESCE(p_is_active, true),
    COALESCE(p_manage_stock, true),
    timezone('utc', now())
  )
  RETURNING products.id INTO v_product_id;

  RETURN QUERY SELECT v_product_id, v_code;
  RETURN;
END;
$$;

-- Compatibilidad con clientes antiguos (sin p_manage_stock).
CREATE OR REPLACE FUNCTION public.create_product_with_generated_code(
  p_business_id uuid,
  p_name text,
  p_category text,
  p_purchase_price numeric DEFAULT 0,
  p_sale_price numeric DEFAULT 0,
  p_stock integer DEFAULT 0,
  p_min_stock integer DEFAULT 5,
  p_unit text DEFAULT 'unit',
  p_supplier_id uuid DEFAULT NULL,
  p_is_active boolean DEFAULT true
)
RETURNS TABLE (
  id uuid,
  code text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT c.id, c.code
  FROM public.create_product_with_generated_code(
    p_business_id,
    p_name,
    p_category,
    p_purchase_price,
    p_sale_price,
    p_stock,
    p_min_stock,
    p_unit,
    p_supplier_id,
    p_is_active,
    true
  ) c;
END;
$$;

REVOKE ALL ON FUNCTION public.create_product_with_generated_code(uuid,text,text,numeric,numeric,integer,integer,text,uuid,boolean,boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_product_with_generated_code(uuid,text,text,numeric,numeric,integer,integer,text,uuid,boolean,boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_product_with_generated_code(uuid,text,text,numeric,numeric,integer,integer,text,uuid,boolean,boolean) TO authenticated;

REVOKE ALL ON FUNCTION public.create_product_with_generated_code(uuid,text,text,numeric,numeric,integer,integer,text,uuid,boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_product_with_generated_code(uuid,text,text,numeric,numeric,integer,integer,text,uuid,boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_product_with_generated_code(uuid,text,text,numeric,numeric,integer,integer,text,uuid,boolean) TO authenticated;

COMMENT ON FUNCTION public.create_product_with_generated_code(uuid,text,text,numeric,numeric,integer,integer,text,uuid,boolean,boolean)
IS 'Crea producto y genera code PRD-#### por negocio, incluyendo manage_stock.';

COMMENT ON FUNCTION public.create_product_with_generated_code(uuid,text,text,numeric,numeric,integer,integer,text,uuid,boolean)
IS 'Wrapper legacy de create_product_with_generated_code (manage_stock=true por defecto).';

-- -----------------------------------------------------------------
-- 3) create_sale_complete: validar y descontar stock solo si manage_stock=true
-- -----------------------------------------------------------------
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

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'La venta debe tener al menos un producto o combo';
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS tmp_sale_lines (
    line_type text NOT NULL,
    product_id uuid,
    combo_id uuid,
    quantity numeric NOT NULL,
    unit_price numeric NOT NULL
  ) ON COMMIT DROP;

  CREATE TEMP TABLE IF NOT EXISTS tmp_stock_updates (
    product_id uuid PRIMARY KEY,
    qty_total numeric NOT NULL
  ) ON COMMIT DROP;

  TRUNCATE tmp_sale_lines;
  TRUNCATE tmp_stock_updates;

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

      INSERT INTO tmp_stock_updates (product_id, qty_total)
      VALUES (v_product_id, v_quantity)
      ON CONFLICT (product_id)
      DO UPDATE SET
        qty_total = tmp_stock_updates.qty_total + EXCLUDED.qty_total;

      CONTINUE;
    END IF;

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

    INSERT INTO tmp_stock_updates (product_id, qty_total)
    SELECT
      ci.producto_id,
      (ci.cantidad * v_quantity) AS qty_total
    FROM public.combo_items ci
    WHERE ci.combo_id = v_combo_id
    ON CONFLICT (product_id)
    DO UPDATE SET
      qty_total = tmp_stock_updates.qty_total + EXCLUDED.qty_total;
  END LOOP;

  SELECT
    COALESCE(SUM(l.quantity * l.unit_price), 0),
    COUNT(*)
  INTO v_total_preview, v_item_count
  FROM tmp_sale_lines l;

  IF v_item_count <= 0 THEN
    RAISE EXCEPTION 'La venta debe tener al menos un item válido';
  END IF;

  SELECT COUNT(*)
  INTO v_expected_stock_products
  FROM tmp_stock_updates;

  SELECT COUNT(*)
  INTO v_found_stock_products
  FROM public.products p
  JOIN tmp_stock_updates su ON su.product_id = p.id
  WHERE p.business_id = p_business_id;

  IF v_expected_stock_products <> v_found_stock_products THEN
    RAISE EXCEPTION 'No se pudo resolver el inventario para todos los productos de la venta';
  END IF;

  FOR v_stock_row IN
    SELECT
      p.id AS product_id,
      p.name AS product_name,
      p.stock AS current_stock,
      p.is_active AS is_active,
      p.manage_stock AS manage_stock,
      su.qty_total AS qty_total
    FROM public.products p
    JOIN tmp_stock_updates su ON su.product_id = p.id
    WHERE p.business_id = p_business_id
    FOR UPDATE
  LOOP
    IF v_stock_row.is_active IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'Producto inactivo en inventario: %', v_stock_row.product_name;
    END IF;

    IF COALESCE(v_stock_row.manage_stock, true)
       AND COALESCE(v_stock_row.current_stock, 0) < COALESCE(v_stock_row.qty_total, 0) THEN
      RAISE EXCEPTION
        'Stock insuficiente para "%": disponibles %, requeridos %',
        v_stock_row.product_name,
        COALESCE(v_stock_row.current_stock, 0),
        COALESCE(v_stock_row.qty_total, 0);
    END IF;
  END LOOP;

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

  UPDATE public.products p
  SET stock = p.stock - su.qty_total
  FROM tmp_stock_updates su
  WHERE p.id = su.product_id
    AND p.business_id = p_business_id
    AND COALESCE(p.manage_stock, true) = true;

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
IS 'Crea venta completa con soporte de combos. Si manage_stock=true valida y descuenta inventario; si false no valida ni modifica stock.';

-- -----------------------------------------------------------------
-- 4) create_purchase_complete: no aumentar stock cuando manage_stock=false
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_purchase_complete(
  p_business_id uuid,
  p_user_id uuid,
  p_supplier_id uuid,
  p_payment_method text,
  p_notes text,
  p_items jsonb
)
RETURNS TABLE (
  purchase_id uuid,
  total_amount numeric,
  items_count integer,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_uid uuid;
  v_purchase_id uuid;
  v_total numeric := 0;
  v_item_count integer := 0;
  v_item jsonb;
  v_product_id uuid;
  v_quantity numeric;
  v_unit_cost numeric;
  v_expected_products integer := 0;
  v_found_products integer := 0;
BEGIN
  v_auth_uid := auth.uid();

  IF p_business_id IS NULL OR p_user_id IS NULL OR p_supplier_id IS NULL THEN
    RAISE EXCEPTION 'p_business_id, p_user_id y p_supplier_id son obligatorios';
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

  IF NOT EXISTS (
    SELECT 1
    FROM public.suppliers s
    WHERE s.id = p_supplier_id
      AND s.business_id = p_business_id
  ) THEN
    RAISE EXCEPTION 'Proveedor no encontrado para este negocio';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'La compra debe tener al menos un producto';
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS tmp_purchase_items (
    product_id uuid NOT NULL,
    quantity numeric NOT NULL,
    unit_cost numeric NOT NULL
  ) ON COMMIT DROP;

  TRUNCATE tmp_purchase_items;

  FOR v_item IN SELECT jsonb_array_elements(p_items)
  LOOP
    v_product_id := NULLIF(trim(coalesce(v_item->>'product_id', '')), '')::uuid;

    IF v_product_id IS NULL THEN
      RAISE EXCEPTION 'Cada item de compra requiere product_id válido';
    END IF;

    v_quantity := NULLIF(trim(coalesce(v_item->>'quantity', '')), '')::numeric;
    IF v_quantity IS NULL OR v_quantity <= 0 THEN
      RAISE EXCEPTION 'Cantidad inválida para producto %', v_product_id;
    END IF;

    v_unit_cost := NULLIF(trim(coalesce(v_item->>'unit_cost', '')), '')::numeric;
    IF v_unit_cost IS NULL THEN
      v_unit_cost := NULLIF(trim(coalesce(v_item->>'unit_price', '')), '')::numeric;
    END IF;

    IF v_unit_cost IS NULL OR v_unit_cost < 0 THEN
      RAISE EXCEPTION 'Costo unitario inválido para producto %', v_product_id;
    END IF;

    INSERT INTO tmp_purchase_items (product_id, quantity, unit_cost)
    VALUES (v_product_id, v_quantity, v_unit_cost);
  END LOOP;

  SELECT
    COUNT(*),
    COALESCE(SUM(t.quantity * t.unit_cost), 0)
  INTO v_item_count, v_total
  FROM tmp_purchase_items t;

  IF v_item_count <= 0 THEN
    RAISE EXCEPTION 'La compra debe tener al menos un item válido';
  END IF;

  SELECT COUNT(DISTINCT t.product_id)
  INTO v_expected_products
  FROM tmp_purchase_items t;

  SELECT COUNT(*)
  INTO v_found_products
  FROM public.products p
  JOIN (SELECT DISTINCT product_id FROM tmp_purchase_items) i
    ON i.product_id = p.id
  WHERE p.business_id = p_business_id;

  IF v_expected_products <> v_found_products THEN
    RAISE EXCEPTION 'Hay productos que no pertenecen al negocio o no existen';
  END IF;

  INSERT INTO public.purchases (
    business_id,
    user_id,
    supplier_id,
    payment_method,
    notes,
    total,
    created_at
  ) VALUES (
    p_business_id,
    p_user_id,
    p_supplier_id,
    COALESCE(p_payment_method, 'efectivo'),
    NULLIF(trim(coalesce(p_notes, '')), ''),
    v_total,
    timezone('utc', now())
  )
  RETURNING id INTO v_purchase_id;

  INSERT INTO public.purchase_details (
    purchase_id,
    product_id,
    quantity,
    unit_cost,
    subtotal
  )
  SELECT
    v_purchase_id,
    t.product_id,
    t.quantity,
    t.unit_cost,
    (t.quantity * t.unit_cost) AS subtotal
  FROM tmp_purchase_items t;

  UPDATE public.products p
  SET stock = CASE
                WHEN COALESCE(p.manage_stock, true) THEN COALESCE(p.stock, 0) + agg.qty_total
                ELSE p.stock
              END,
      purchase_price = agg.last_unit_cost
  FROM (
    SELECT
      t.product_id,
      SUM(t.quantity) AS qty_total,
      MAX(t.unit_cost) AS last_unit_cost
    FROM tmp_purchase_items t
    GROUP BY t.product_id
  ) agg
  WHERE p.id = agg.product_id
    AND p.business_id = p_business_id;

  RETURN QUERY
  SELECT
    v_purchase_id,
    v_total,
    v_item_count,
    'success'::text;

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Error al crear compra: %', SQLERRM;
END;
$$;

REVOKE ALL ON FUNCTION public.create_purchase_complete(uuid,uuid,uuid,text,text,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_purchase_complete(uuid,uuid,uuid,text,text,jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_purchase_complete(uuid,uuid,uuid,text,text,jsonb) TO authenticated;

COMMENT ON FUNCTION public.create_purchase_complete(uuid,uuid,uuid,text,text,jsonb)
IS 'Crea compra completa en una sola transacción. Actualiza stock solo para productos con manage_stock=true.';

-- -----------------------------------------------------------------
-- 5) Bajo stock: excluir productos sin control
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_low_stock_products(
  p_business_id uuid,
  p_threshold integer DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  name text,
  code text,
  current_stock integer,
  price numeric,
  category text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_business_id IS NULL THEN
    RAISE EXCEPTION 'p_business_id es obligatorio';
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sesión inválida: auth.uid() es NULL';
  END IF;

  IF NOT public.can_access_business(p_business_id) THEN
    RAISE EXCEPTION 'No autorizado para consultar productos de este negocio';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.code,
    p.stock::integer AS current_stock,
    COALESCE(p.sale_price, p.purchase_price, 0)::numeric AS price,
    p.category
  FROM public.products p
  WHERE p.business_id = p_business_id
    AND p.is_active = true
    AND COALESCE(p.manage_stock, true) = true
    AND p.stock <= GREATEST(COALESCE(p_threshold, 10), 0)
  ORDER BY p.stock ASC, p.name ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_low_stock_products(uuid,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_low_stock_products(uuid,integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_low_stock_products(uuid,integer) TO authenticated;

COMMENT ON FUNCTION public.get_low_stock_products(uuid,integer)
IS 'Retorna productos con stock bajo que manejan inventario (manage_stock=true).';
