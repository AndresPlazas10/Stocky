-- ============================================================
-- Fix overload create_sale_complete con metadata de efectivo
-- Fecha: 2026-02-20
-- Objetivo:
--   1) Hacer que la firma de 9 parámetros reutilice la lógica
--      base (7 parámetros) con soporte de combos.
--   2) Persistir amount_received/change_breakdown sin duplicar
--      lógica de inventario.
-- ============================================================

DROP FUNCTION IF EXISTS public.create_sale_complete(uuid,uuid,text,text,jsonb,uuid,uuid,numeric,jsonb);

CREATE OR REPLACE FUNCTION public.create_sale_complete(
  p_business_id uuid,
  p_user_id uuid,
  p_seller_name text,
  p_payment_method text,
  p_items jsonb,
  p_order_id uuid,
  p_table_id uuid,
  p_amount_received numeric,
  p_change_breakdown jsonb
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
  v_sale_row record;
  v_change_breakdown jsonb := '[]'::jsonb;
  v_change_amount numeric := 0;
  v_amount_received numeric := NULL;
BEGIN
  -- Reusar lógica core (productos + combos + validaciones + stock).
  SELECT c.*
  INTO v_sale_row
  FROM public.create_sale_complete(
    p_business_id,
    p_user_id,
    p_seller_name,
    p_payment_method,
    p_items,
    p_order_id,
    p_table_id
  ) c
  LIMIT 1;

  IF lower(coalesce(p_payment_method, '')) = 'cash' THEN
    IF p_amount_received IS NOT NULL AND p_amount_received >= 0 THEN
      v_amount_received := p_amount_received;
    END IF;

    IF jsonb_typeof(p_change_breakdown) = 'array' THEN
      v_change_breakdown := p_change_breakdown;
    END IF;

    SELECT COALESCE(SUM(
      ((entry->>'denomination')::numeric) * ((entry->>'count')::numeric)
    ), 0)
    INTO v_change_amount
    FROM jsonb_array_elements(v_change_breakdown) AS entry
    WHERE jsonb_typeof(entry) = 'object'
      AND (entry ? 'denomination')
      AND (entry ? 'count')
      AND (entry->>'denomination') ~ '^-?\\d+(\\.\\d+)?$'
      AND (entry->>'count') ~ '^-?\\d+(\\.\\d+)?$'
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

  RETURN QUERY
  SELECT
    v_sale_row.sale_id,
    v_sale_row.total_amount,
    v_sale_row.items_count,
    v_sale_row.status;
END;
$$;

REVOKE ALL ON FUNCTION public.create_sale_complete(uuid,uuid,text,text,jsonb,uuid,uuid,numeric,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_sale_complete(uuid,uuid,text,text,jsonb,uuid,uuid,numeric,jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_sale_complete(uuid,uuid,text,text,jsonb,uuid,uuid,numeric,jsonb) TO authenticated;

COMMENT ON FUNCTION public.create_sale_complete(uuid,uuid,text,text,jsonb,uuid,uuid,numeric,jsonb)
IS 'Wrapper cash metadata de create_sale_complete. Reutiliza lógica base con soporte de combos y persiste metadatos de efectivo.';
