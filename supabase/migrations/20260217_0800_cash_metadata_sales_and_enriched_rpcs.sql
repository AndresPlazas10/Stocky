-- ============================================================
-- Cash metadata in sales + enriched sales listing
-- Fecha: 2026-02-17
-- Objetivo:
--   1) Persistir monto recibido/cambio en ventas (cash).
--   2) Propagar metadatos cash en cierre de cuenta dividida.
--   3) Exponer campos cash en get_sales_enriched.
-- ============================================================

-- -----------------------------------------------------------------
-- 1) Campos de metadatos de efectivo en sales
-- -----------------------------------------------------------------
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS amount_received numeric;

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS change_amount numeric;

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS change_breakdown jsonb;

UPDATE public.sales
SET change_breakdown = '[]'::jsonb
WHERE change_breakdown IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sales_amount_received_non_negative'
      AND conrelid = 'public.sales'::regclass
  ) THEN
    ALTER TABLE public.sales
      ADD CONSTRAINT sales_amount_received_non_negative
      CHECK (amount_received IS NULL OR amount_received >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sales_change_amount_non_negative'
      AND conrelid = 'public.sales'::regclass
  ) THEN
    ALTER TABLE public.sales
      ADD CONSTRAINT sales_change_amount_non_negative
      CHECK (change_amount IS NULL OR change_amount >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sales_change_breakdown_is_array'
      AND conrelid = 'public.sales'::regclass
  ) THEN
    ALTER TABLE public.sales
      ADD CONSTRAINT sales_change_breakdown_is_array
      CHECK (change_breakdown IS NULL OR jsonb_typeof(change_breakdown) = 'array');
  END IF;
END $$;

COMMENT ON COLUMN public.sales.amount_received IS 'Monto recibido al pagar en efectivo';
COMMENT ON COLUMN public.sales.change_amount IS 'Cambio total devuelto en efectivo';
COMMENT ON COLUMN public.sales.change_breakdown IS 'Desglose del cambio [{denomination,count}]';

-- -----------------------------------------------------------------
-- 2) Split close: persistir metadata cash por subcuenta
-- -----------------------------------------------------------------
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
  v_amount_received_raw text;
  v_amount_received numeric;
  v_change_breakdown jsonb;
  v_change_amount numeric;

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
        p_business_id,
        p_user_id,
        p_seller_name,
        v_payment_method,
        v_items,
        NULL,
        NULL
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
IS 'Cierra subcuentas de una orden en una sola transacción y persiste metadatos de efectivo por venta.';

-- -----------------------------------------------------------------
-- 3) get_sales_enriched con metadatos cash
-- -----------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_sales_enriched(
  uuid,
  integer,
  integer,
  timestamptz,
  timestamptz,
  text,
  uuid,
  uuid,
  numeric,
  numeric,
  boolean
);

CREATE OR REPLACE FUNCTION public.get_sales_enriched(
  p_business_id uuid,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_from_date timestamptz DEFAULT NULL,
  p_to_date timestamptz DEFAULT NULL,
  p_payment_method text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_customer_id uuid DEFAULT NULL,
  p_min_amount numeric DEFAULT NULL,
  p_max_amount numeric DEFAULT NULL,
  p_include_count boolean DEFAULT true
)
RETURNS TABLE (
  id uuid,
  business_id uuid,
  user_id uuid,
  seller_name text,
  payment_method text,
  amount_received numeric,
  change_amount numeric,
  change_breakdown jsonb,
  customer_id uuid,
  customer_name text,
  customer_email text,
  customer_id_number text,
  notes text,
  total numeric,
  created_at timestamptz,
  employee_full_name text,
  employee_role text,
  is_owner boolean,
  total_count bigint
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
    RAISE EXCEPTION 'No autorizado para consultar ventas de este negocio';
  END IF;

  RETURN QUERY
  WITH filtered AS (
    SELECT
      s.id,
      s.business_id,
      s.user_id,
      s.seller_name,
      s.payment_method,
      s.amount_received,
      s.change_amount,
      COALESCE(s.change_breakdown, '[]'::jsonb) AS change_breakdown,
      s.customer_id,
      s.customer_name,
      s.customer_email,
      s.customer_id_number,
      s.notes,
      s.total,
      s.created_at,
      e.full_name AS employee_full_name,
      e.role AS employee_role,
      (s.user_id = b.created_by) AS is_owner
    FROM public.sales s
    LEFT JOIN public.businesses b
      ON b.id = s.business_id
    LEFT JOIN public.employees e
      ON e.business_id = s.business_id
     AND e.user_id = s.user_id
    WHERE s.business_id = p_business_id
      AND (p_from_date IS NULL OR s.created_at >= p_from_date)
      AND (p_to_date IS NULL OR s.created_at <= p_to_date)
      AND (p_payment_method IS NULL OR s.payment_method = p_payment_method)
      AND (p_user_id IS NULL OR s.user_id = p_user_id)
      AND (p_customer_id IS NULL OR s.customer_id = p_customer_id)
      AND (p_min_amount IS NULL OR s.total >= p_min_amount)
      AND (p_max_amount IS NULL OR s.total <= p_max_amount)
  )
  SELECT
    f.id,
    f.business_id,
    f.user_id,
    f.seller_name,
    f.payment_method,
    f.amount_received,
    f.change_amount,
    f.change_breakdown,
    f.customer_id,
    f.customer_name,
    f.customer_email,
    f.customer_id_number,
    f.notes,
    f.total,
    f.created_at,
    f.employee_full_name,
    f.employee_role,
    f.is_owner,
    CASE WHEN p_include_count THEN COUNT(*) OVER() ELSE NULL::bigint END AS total_count
  FROM filtered f
  ORDER BY f.created_at DESC
  OFFSET GREATEST(COALESCE(p_offset, 0), 0)
  LIMIT GREATEST(COALESCE(p_limit, 50), 1);
END;
$$;

REVOKE ALL ON FUNCTION public.get_sales_enriched(uuid,integer,integer,timestamptz,timestamptz,text,uuid,uuid,numeric,numeric,boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_sales_enriched(uuid,integer,integer,timestamptz,timestamptz,text,uuid,uuid,numeric,numeric,boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_sales_enriched(uuid,integer,integer,timestamptz,timestamptz,text,uuid,uuid,numeric,numeric,boolean) TO authenticated;

COMMENT ON FUNCTION public.get_sales_enriched(uuid,integer,integer,timestamptz,timestamptz,text,uuid,uuid,numeric,numeric,boolean)
IS 'Listado paginado de ventas enriquecido (owner/admin) con metadatos de efectivo y control de acceso por negocio.';
