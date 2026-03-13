BEGIN;

CREATE OR REPLACE FUNCTION public.list_open_order_snapshot(
  p_order_id uuid
)
RETURNS TABLE(
  order_id uuid,
  business_id uuid,
  total numeric,
  units integer,
  items jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_business_id uuid;
BEGIN
  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'p_order_id es obligatorio';
  END IF;

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sesion invalida: auth.uid() es NULL';
  END IF;

  SELECT o.business_id
  INTO v_business_id
  FROM public.orders o
  WHERE o.id = p_order_id
  LIMIT 1;

  IF v_business_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT public.can_access_business(v_business_id) THEN
    RAISE EXCEPTION 'No autorizado para acceder a esta orden';
  END IF;

  RETURN QUERY
  WITH selected_order AS (
    SELECT
      o.id,
      o.business_id,
      o.total AS stored_total
    FROM public.orders o
    WHERE o.id = p_order_id
    LIMIT 1
  ),
  order_items_base AS (
    SELECT
      oi.id,
      oi.order_id,
      oi.product_id,
      oi.combo_id,
      COALESCE(oi.quantity, 0)::numeric AS quantity,
      COALESCE(oi.price, 0)::numeric AS price,
      COALESCE(oi.subtotal, COALESCE(oi.quantity, 0) * COALESCE(oi.price, 0))::numeric AS subtotal,
      p.id AS product_ref_id,
      p.name AS product_name,
      c.id AS combo_ref_id,
      c.nombre AS combo_name
    FROM public.order_items oi
    LEFT JOIN public.products p ON p.id = oi.product_id
    LEFT JOIN public.combos c ON c.id = oi.combo_id
    WHERE oi.order_id = p_order_id
  )
  SELECT
    so.id AS order_id,
    so.business_id,
    COALESCE(SUM(oib.subtotal), so.stored_total, 0)::numeric AS total,
    COALESCE(SUM(oib.quantity), 0)::integer AS units,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', oib.id,
          'order_id', oib.order_id,
          'product_id', oib.product_id,
          'combo_id', oib.combo_id,
          'quantity', oib.quantity,
          'price', oib.price,
          'subtotal', oib.subtotal,
          'products', CASE
            WHEN oib.product_ref_id IS NULL THEN NULL
            ELSE jsonb_build_object(
              'id', oib.product_ref_id,
              'name', oib.product_name
            )
          END,
          'combos', CASE
            WHEN oib.combo_ref_id IS NULL THEN NULL
            ELSE jsonb_build_object(
              'id', oib.combo_ref_id,
              'nombre', oib.combo_name
            )
          END
        )
        ORDER BY oib.id
      ) FILTER (WHERE oib.id IS NOT NULL),
      '[]'::jsonb
    ) AS items
  FROM selected_order so
  LEFT JOIN order_items_base oib ON oib.order_id = so.id
  GROUP BY so.id, so.business_id, so.stored_total;
END;
$$;

COMMENT ON FUNCTION public.list_open_order_snapshot(uuid)
IS 'Devuelve snapshot de orden abierta (items + total + unidades) en una sola llamada para mobile.';

REVOKE ALL ON FUNCTION public.list_open_order_snapshot(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_open_order_snapshot(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.list_open_order_snapshot(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_open_order_snapshot(uuid) TO service_role;

COMMIT;
