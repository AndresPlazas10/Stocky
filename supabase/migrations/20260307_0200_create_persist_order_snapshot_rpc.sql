-- Persistencia atomica del snapshot de items de una orden abierta.
-- Permite guardar desde mobile sin carreras entre updates/insert/delete.

CREATE OR REPLACE FUNCTION public.persist_order_snapshot(
  p_order_id uuid,
  p_items jsonb DEFAULT '[]'::jsonb
)
RETURNS TABLE(total numeric, items_count integer)
LANGUAGE plpgsql
AS $$
DECLARE
  v_items jsonb := COALESCE(p_items, '[]'::jsonb);
  v_has_subtotal boolean;
  v_has_order_total boolean;
  v_total numeric := 0;
  v_items_count integer := 0;
BEGIN
  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'p_order_id es obligatorio';
  END IF;

  IF jsonb_typeof(v_items) <> 'array' THEN
    RAISE EXCEPTION 'p_items debe ser un arreglo JSON';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'order_items'
      AND column_name = 'subtotal'
  ) INTO v_has_subtotal;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'orders'
      AND column_name = 'total'
  ) INTO v_has_order_total;

  CREATE TEMP TABLE tmp_snapshot_items (
    product_id uuid,
    combo_id uuid,
    quantity integer NOT NULL,
    price numeric NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO tmp_snapshot_items (product_id, combo_id, quantity, price)
  SELECT
    NULLIF(TRIM(COALESCE(item->>'product_id', '')), '')::uuid,
    NULLIF(TRIM(COALESCE(item->>'combo_id', '')), '')::uuid,
    GREATEST(0, FLOOR(COALESCE((item->>'quantity')::numeric, 0)))::integer,
    GREATEST(0, COALESCE((item->>'price')::numeric, 0))
  FROM jsonb_array_elements(v_items) AS item;

  -- Mantener solo filas validas (exactamente una referencia + qty positiva).
  DELETE FROM tmp_snapshot_items
  WHERE quantity <= 0
    OR (
      (product_id IS NULL AND combo_id IS NULL)
      OR (product_id IS NOT NULL AND combo_id IS NOT NULL)
    );

  CREATE TEMP TABLE tmp_snapshot_agg (
    product_id uuid,
    combo_id uuid,
    quantity integer NOT NULL,
    price numeric NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO tmp_snapshot_agg (product_id, combo_id, quantity, price)
  SELECT
    product_id,
    combo_id,
    SUM(quantity)::integer AS quantity,
    MAX(price) AS price
  FROM tmp_snapshot_items
  GROUP BY product_id, combo_id;

  IF v_has_subtotal THEN
    UPDATE public.order_items oi
    SET
      quantity = src.quantity,
      price = src.price,
      subtotal = src.quantity * src.price
    FROM tmp_snapshot_agg src
    WHERE oi.order_id = p_order_id
      AND (
        (src.product_id IS NOT NULL AND oi.product_id = src.product_id AND oi.combo_id IS NULL)
        OR
        (src.combo_id IS NOT NULL AND oi.combo_id = src.combo_id AND oi.product_id IS NULL)
      );
  ELSE
    UPDATE public.order_items oi
    SET
      quantity = src.quantity,
      price = src.price
    FROM tmp_snapshot_agg src
    WHERE oi.order_id = p_order_id
      AND (
        (src.product_id IS NOT NULL AND oi.product_id = src.product_id AND oi.combo_id IS NULL)
        OR
        (src.combo_id IS NOT NULL AND oi.combo_id = src.combo_id AND oi.product_id IS NULL)
      );
  END IF;

  IF v_has_subtotal THEN
    INSERT INTO public.order_items (order_id, product_id, combo_id, quantity, price, subtotal)
    SELECT
      p_order_id,
      src.product_id,
      src.combo_id,
      src.quantity,
      src.price,
      src.quantity * src.price
    FROM tmp_snapshot_agg src
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.order_items oi
      WHERE oi.order_id = p_order_id
        AND (
          (src.product_id IS NOT NULL AND oi.product_id = src.product_id AND oi.combo_id IS NULL)
          OR
          (src.combo_id IS NOT NULL AND oi.combo_id = src.combo_id AND oi.product_id IS NULL)
        )
    );
  ELSE
    INSERT INTO public.order_items (order_id, product_id, combo_id, quantity, price)
    SELECT
      p_order_id,
      src.product_id,
      src.combo_id,
      src.quantity,
      src.price
    FROM tmp_snapshot_agg src
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.order_items oi
      WHERE oi.order_id = p_order_id
        AND (
          (src.product_id IS NOT NULL AND oi.product_id = src.product_id AND oi.combo_id IS NULL)
          OR
          (src.combo_id IS NOT NULL AND oi.combo_id = src.combo_id AND oi.product_id IS NULL)
        )
    );
  END IF;

  DELETE FROM public.order_items oi
  WHERE oi.order_id = p_order_id
    AND NOT EXISTS (
      SELECT 1
      FROM tmp_snapshot_agg src
      WHERE
        (src.product_id IS NOT NULL AND oi.product_id = src.product_id AND oi.combo_id IS NULL)
        OR
        (src.combo_id IS NOT NULL AND oi.combo_id = src.combo_id AND oi.product_id IS NULL)
    );

  SELECT
    COALESCE(SUM(oi.quantity * oi.price), 0),
    COALESCE(SUM(oi.quantity), 0)::integer
  INTO v_total, v_items_count
  FROM public.order_items oi
  WHERE oi.order_id = p_order_id;

  IF v_has_order_total THEN
    UPDATE public.orders o
    SET total = v_total
    WHERE o.id = p_order_id;
  END IF;

  RETURN QUERY
  SELECT v_total, v_items_count;
END;
$$;

REVOKE ALL ON FUNCTION public.persist_order_snapshot(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.persist_order_snapshot(uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.persist_order_snapshot(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.persist_order_snapshot(uuid, jsonb) TO service_role;

COMMENT ON FUNCTION public.persist_order_snapshot(uuid, jsonb)
IS 'Persiste atomicamente el snapshot de order_items de una orden y recalcula total.';
