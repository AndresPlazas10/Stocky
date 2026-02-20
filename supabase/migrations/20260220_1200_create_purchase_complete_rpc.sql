-- ============================================================
-- RPC transaccional para registro de compras
-- Fecha: 2026-02-20
-- Objetivo:
--   1) Reducir roundtrips en frontend al registrar compras.
--   2) Garantizar atomicidad compra + detalles + actualización de stock.
-- ============================================================

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
  SET stock = COALESCE(p.stock, 0) + agg.qty_total,
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
IS 'Crea compra completa en una sola transacción: inserta purchase + details y actualiza stock/costo.';

