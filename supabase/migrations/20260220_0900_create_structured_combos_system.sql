-- ============================================================
-- Sistema de combos estructurados
-- Fecha: 2026-02-20
-- Objetivo:
--   1) Separar combos de productos normales.
--   2) Permitir composición N:M combo <-> producto.
--   3) Soportar combos en órdenes/ventas sin duplicar inventario.
--   4) Validar stock de productos internos de combos al vender.
-- ============================================================

-- -----------------------------------------------------------------
-- 1) Nuevas tablas relacionales: combos + combo_items
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.combos (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  precio_venta numeric NOT NULL CHECK (precio_venta >= 0),
  descripcion text,
  estado text NOT NULL DEFAULT 'active' CHECK (lower(estado) IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.combo_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  combo_id uuid NOT NULL REFERENCES public.combos(id) ON DELETE CASCADE,
  producto_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  cantidad numeric NOT NULL CHECK (cantidad > 0),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT combo_items_unique_combo_product UNIQUE (combo_id, producto_id)
);

CREATE INDEX IF NOT EXISTS idx_combos_business_status
  ON public.combos(business_id, estado, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_combos_business_nombre
  ON public.combos(business_id, lower(nombre));

CREATE INDEX IF NOT EXISTS idx_combo_items_combo
  ON public.combo_items(combo_id);

CREATE INDEX IF NOT EXISTS idx_combo_items_producto
  ON public.combo_items(producto_id);

-- -----------------------------------------------------------------
-- 2) Extensión de order_items/sale_details para soportar líneas combo
-- -----------------------------------------------------------------
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS combo_id uuid REFERENCES public.combos(id) ON DELETE RESTRICT;

ALTER TABLE public.sale_details
  ADD COLUMN IF NOT EXISTS combo_id uuid REFERENCES public.combos(id) ON DELETE RESTRICT;

-- Compatibilidad: permitir NULL en product_id para líneas tipo combo.
ALTER TABLE public.order_items
  ALTER COLUMN product_id DROP NOT NULL;

ALTER TABLE public.sale_details
  ALTER COLUMN product_id DROP NOT NULL;

-- -----------------------------------------------------------------
-- 2.1) Saneamiento de datos legacy antes de constraints estrictos
-- -----------------------------------------------------------------
-- Bloquea escrituras concurrentes durante saneamiento + alta de constraints.
LOCK TABLE public.order_items IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE public.sale_details IN SHARE ROW EXCLUSIVE MODE;

-- Guarda evidencia de filas inconsistentes antes de corregir/eliminar.
CREATE TABLE IF NOT EXISTS public.combo_reference_data_issues (
  id bigserial PRIMARY KEY,
  source_table text NOT NULL,
  record_id uuid NOT NULL,
  issue_type text NOT NULL,
  row_data jsonb NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_combo_reference_data_issues_unique
  ON public.combo_reference_data_issues(source_table, record_id, issue_type);

-- Caso 1: ambas referencias llenas (legacy conflictivo). Se prioriza product_id para no romper historial.
INSERT INTO public.combo_reference_data_issues (source_table, record_id, issue_type, row_data)
SELECT 'order_items', oi.id, 'both_references_set', to_jsonb(oi)
FROM public.order_items oi
WHERE oi.product_id IS NOT NULL
  AND oi.combo_id IS NOT NULL
ON CONFLICT (source_table, record_id, issue_type) DO NOTHING;

UPDATE public.order_items
SET combo_id = NULL
WHERE product_id IS NOT NULL
  AND combo_id IS NOT NULL;

INSERT INTO public.combo_reference_data_issues (source_table, record_id, issue_type, row_data)
SELECT 'sale_details', sd.id, 'both_references_set', to_jsonb(sd)
FROM public.sale_details sd
WHERE sd.product_id IS NOT NULL
  AND sd.combo_id IS NOT NULL
ON CONFLICT (source_table, record_id, issue_type) DO NOTHING;

UPDATE public.sale_details
SET combo_id = NULL
WHERE product_id IS NOT NULL
  AND combo_id IS NOT NULL;

-- Caso 2: ambas referencias nulas. Son filas inválidas (sin item vendible). Se respaldan y eliminan.
INSERT INTO public.combo_reference_data_issues (source_table, record_id, issue_type, row_data)
SELECT 'order_items', oi.id, 'both_references_null', to_jsonb(oi)
FROM public.order_items oi
WHERE oi.product_id IS NULL
  AND oi.combo_id IS NULL
ON CONFLICT (source_table, record_id, issue_type) DO NOTHING;

DELETE FROM public.order_items
WHERE product_id IS NULL
  AND combo_id IS NULL;

INSERT INTO public.combo_reference_data_issues (source_table, record_id, issue_type, row_data)
SELECT 'sale_details', sd.id, 'both_references_null', to_jsonb(sd)
FROM public.sale_details sd
WHERE sd.product_id IS NULL
  AND sd.combo_id IS NULL
ON CONFLICT (source_table, record_id, issue_type) DO NOTHING;

DELETE FROM public.sale_details
WHERE product_id IS NULL
  AND combo_id IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'order_items_exactly_one_reference'
      AND conrelid = 'public.order_items'::regclass
  ) THEN
    ALTER TABLE public.order_items
      ADD CONSTRAINT order_items_exactly_one_reference
      CHECK ((product_id IS NOT NULL) <> (combo_id IS NOT NULL))
      NOT VALID;
  END IF;

  BEGIN
    ALTER TABLE public.order_items
      VALIDATE CONSTRAINT order_items_exactly_one_reference;
  EXCEPTION
    WHEN check_violation THEN
      RAISE NOTICE
        'order_items_exactly_one_reference quedó NOT VALID por datos legacy residuales; nuevas filas sí se validan.';
  END;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sale_details_exactly_one_reference'
      AND conrelid = 'public.sale_details'::regclass
  ) THEN
    ALTER TABLE public.sale_details
      ADD CONSTRAINT sale_details_exactly_one_reference
      CHECK ((product_id IS NOT NULL) <> (combo_id IS NOT NULL))
      NOT VALID;
  END IF;

  BEGIN
    ALTER TABLE public.sale_details
      VALIDATE CONSTRAINT sale_details_exactly_one_reference;
  EXCEPTION
    WHEN check_violation THEN
      RAISE NOTICE
        'sale_details_exactly_one_reference quedó NOT VALID por datos legacy residuales; nuevas filas sí se validan.';
  END;
END $$;

CREATE INDEX IF NOT EXISTS idx_order_items_combo_id
  ON public.order_items(combo_id)
  WHERE combo_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sale_details_combo_id
  ON public.sale_details(combo_id)
  WHERE combo_id IS NOT NULL;

-- -----------------------------------------------------------------
-- 3) Triggers de integridad multi-tenant
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_combo_item_business_consistency()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_combo_business uuid;
  v_product_business uuid;
BEGIN
  SELECT c.business_id
  INTO v_combo_business
  FROM public.combos c
  WHERE c.id = NEW.combo_id;

  IF v_combo_business IS NULL THEN
    RAISE EXCEPTION 'Combo % no encontrado', NEW.combo_id;
  END IF;

  SELECT p.business_id
  INTO v_product_business
  FROM public.products p
  WHERE p.id = NEW.producto_id;

  IF v_product_business IS NULL THEN
    RAISE EXCEPTION 'Producto % no encontrado', NEW.producto_id;
  END IF;

  IF v_combo_business <> v_product_business THEN
    RAISE EXCEPTION 'El producto % no pertenece al mismo negocio del combo %', NEW.producto_id, NEW.combo_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_combo_item_business ON public.combo_items;
CREATE TRIGGER trg_validate_combo_item_business
BEFORE INSERT OR UPDATE OF combo_id, producto_id
ON public.combo_items
FOR EACH ROW
EXECUTE FUNCTION public.validate_combo_item_business_consistency();

CREATE OR REPLACE FUNCTION public.validate_order_item_reference_consistency()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_order_business uuid;
  v_ref_business uuid;
  v_combo_status text;
BEGIN
  IF (NEW.product_id IS NULL) = (NEW.combo_id IS NULL) THEN
    RAISE EXCEPTION 'Cada order_item debe referenciar exactamente un product_id o combo_id';
  END IF;

  SELECT o.business_id
  INTO v_order_business
  FROM public.orders o
  WHERE o.id = NEW.order_id;

  IF v_order_business IS NULL THEN
    RAISE EXCEPTION 'Orden % no encontrada', NEW.order_id;
  END IF;

  IF NEW.product_id IS NOT NULL THEN
    SELECT p.business_id
    INTO v_ref_business
    FROM public.products p
    WHERE p.id = NEW.product_id;

    IF v_ref_business IS NULL THEN
      RAISE EXCEPTION 'Producto % no encontrado', NEW.product_id;
    END IF;

    IF v_ref_business <> v_order_business THEN
      RAISE EXCEPTION 'El producto % no pertenece al negocio de la orden %', NEW.product_id, NEW.order_id;
    END IF;
  END IF;

  IF NEW.combo_id IS NOT NULL THEN
    SELECT c.business_id, c.estado
    INTO v_ref_business, v_combo_status
    FROM public.combos c
    WHERE c.id = NEW.combo_id;

    IF v_ref_business IS NULL THEN
      RAISE EXCEPTION 'Combo % no encontrado', NEW.combo_id;
    END IF;

    IF v_ref_business <> v_order_business THEN
      RAISE EXCEPTION 'El combo % no pertenece al negocio de la orden %', NEW.combo_id, NEW.order_id;
    END IF;

    IF lower(coalesce(v_combo_status, '')) <> 'active' THEN
      RAISE EXCEPTION 'El combo % está inactivo', NEW.combo_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_order_item_reference_consistency ON public.order_items;
CREATE TRIGGER trg_validate_order_item_reference_consistency
BEFORE INSERT OR UPDATE OF order_id, product_id, combo_id
ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.validate_order_item_reference_consistency();

CREATE OR REPLACE FUNCTION public.validate_sale_detail_reference_consistency()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_sale_business uuid;
  v_ref_business uuid;
BEGIN
  IF (NEW.product_id IS NULL) = (NEW.combo_id IS NULL) THEN
    RAISE EXCEPTION 'Cada sale_detail debe referenciar exactamente un product_id o combo_id';
  END IF;

  SELECT s.business_id
  INTO v_sale_business
  FROM public.sales s
  WHERE s.id = NEW.sale_id;

  IF v_sale_business IS NULL THEN
    RAISE EXCEPTION 'Venta % no encontrada', NEW.sale_id;
  END IF;

  IF NEW.product_id IS NOT NULL THEN
    SELECT p.business_id
    INTO v_ref_business
    FROM public.products p
    WHERE p.id = NEW.product_id;

    IF v_ref_business IS NULL THEN
      RAISE EXCEPTION 'Producto % no encontrado', NEW.product_id;
    END IF;

    IF v_ref_business <> v_sale_business THEN
      RAISE EXCEPTION 'El producto % no pertenece al negocio de la venta %', NEW.product_id, NEW.sale_id;
    END IF;
  END IF;

  IF NEW.combo_id IS NOT NULL THEN
    SELECT c.business_id
    INTO v_ref_business
    FROM public.combos c
    WHERE c.id = NEW.combo_id;

    IF v_ref_business IS NULL THEN
      RAISE EXCEPTION 'Combo % no encontrado', NEW.combo_id;
    END IF;

    IF v_ref_business <> v_sale_business THEN
      RAISE EXCEPTION 'El combo % no pertenece al negocio de la venta %', NEW.combo_id, NEW.sale_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_sale_detail_reference_consistency ON public.sale_details;
CREATE TRIGGER trg_validate_sale_detail_reference_consistency
BEFORE INSERT OR UPDATE OF sale_id, product_id, combo_id
ON public.sale_details
FOR EACH ROW
EXECUTE FUNCTION public.validate_sale_detail_reference_consistency();

-- -----------------------------------------------------------------
-- 4) RLS para combos y combo_items
-- -----------------------------------------------------------------
ALTER TABLE public.combos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.combo_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS combos_access_policy ON public.combos;
CREATE POLICY combos_access_policy
ON public.combos
FOR ALL
TO authenticated
USING (public.can_access_business(business_id))
WITH CHECK (public.can_access_business(business_id));

DROP POLICY IF EXISTS combo_items_access_policy ON public.combo_items;
CREATE POLICY combo_items_access_policy
ON public.combo_items
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.combos c
    WHERE c.id = combo_items.combo_id
      AND public.can_access_business(c.business_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.combos c
    WHERE c.id = combo_items.combo_id
      AND public.can_access_business(c.business_id)
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.combos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.combo_items TO authenticated;

COMMENT ON TABLE public.combos IS 'Combos comerciales configurables por negocio';
COMMENT ON TABLE public.combo_items IS 'Componentes internos de inventario para cada combo';
COMMENT ON COLUMN public.combo_items.cantidad IS 'Cantidad del producto interno que consume el combo por unidad vendida';

-- -----------------------------------------------------------------
-- 5) RPC create_sale_complete con soporte nativo de combos
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
    timezone('utc', now())
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
