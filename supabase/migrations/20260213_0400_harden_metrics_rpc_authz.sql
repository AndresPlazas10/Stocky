-- ============================================================
-- HARDENING P0 - Step 4
-- Fecha: 2026-02-13
-- Objetivo: endurecer RPCs de métricas por negocio
-- ============================================================

-- -----------------------------------------------------------------
-- get_business_dashboard_metrics
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_business_dashboard_metrics(
  p_business_id uuid,
  p_start_date timestamptz DEFAULT CURRENT_DATE,
  p_end_date timestamptz DEFAULT CURRENT_DATE + INTERVAL '1 day'
)
RETURNS TABLE (
  metric_date date,
  total_sales bigint,
  revenue numeric,
  avg_ticket numeric,
  active_sellers bigint,
  cash_sales bigint,
  transfer_sales bigint,
  card_sales bigint,
  cash_revenue numeric,
  transfer_revenue numeric,
  card_revenue numeric,
  products_sold bigint,
  units_sold numeric,
  active_products bigint,
  low_stock_products bigint,
  inventory_value numeric,
  total_purchases bigint,
  purchases_total numeric
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
    RAISE EXCEPTION 'No autorizado para consultar métricas de este negocio';
  END IF;

  RETURN QUERY
  SELECT
    bmd.metric_date,
    bmd.total_sales,
    bmd.revenue,
    bmd.avg_ticket,
    bmd.active_sellers,
    bmd.cash_sales,
    bmd.transfer_sales,
    bmd.card_sales,
    bmd.cash_revenue,
    bmd.transfer_revenue,
    bmd.card_revenue,
    bmd.products_sold,
    bmd.units_sold,
    bmd.active_products,
    bmd.low_stock_products,
    bmd.inventory_value,
    bmd.total_purchases,
    bmd.purchases_total
  FROM public.business_metrics_daily bmd
  WHERE bmd.business_id = p_business_id
    AND bmd.metric_date >= DATE(p_start_date)
    AND bmd.metric_date <= DATE(p_end_date)
  ORDER BY bmd.metric_date DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_business_dashboard_metrics(uuid,timestamptz,timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_business_dashboard_metrics(uuid,timestamptz,timestamptz) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_business_dashboard_metrics(uuid,timestamptz,timestamptz) TO authenticated;

COMMENT ON FUNCTION public.get_business_dashboard_metrics(uuid,timestamptz,timestamptz)
IS 'Obtiene métricas del dashboard con validación de acceso por negocio.';

-- -----------------------------------------------------------------
-- get_business_today_metrics
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_business_today_metrics(
  p_business_id uuid
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result json;
BEGIN
  IF p_business_id IS NULL THEN
    RAISE EXCEPTION 'p_business_id es obligatorio';
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sesión inválida: auth.uid() es NULL';
  END IF;

  IF NOT public.can_access_business(p_business_id) THEN
    RAISE EXCEPTION 'No autorizado para consultar métricas de este negocio';
  END IF;

  SELECT json_build_object(
    'today_sales', (
      SELECT COUNT(*)
      FROM public.sales
      WHERE business_id = p_business_id
        AND created_at >= CURRENT_DATE
    ),
    'today_revenue', (
      SELECT COALESCE(SUM(total), 0)
      FROM public.sales
      WHERE business_id = p_business_id
        AND created_at >= CURRENT_DATE
    ),
    'today_avg_ticket', (
      SELECT COALESCE(AVG(total), 0)
      FROM public.sales
      WHERE business_id = p_business_id
        AND created_at >= CURRENT_DATE
    ),
    'cash_sales', (
      SELECT COUNT(*)
      FROM public.sales
      WHERE business_id = p_business_id
        AND created_at >= CURRENT_DATE
        AND payment_method = 'Efectivo'
    ),
    'transfer_sales', (
      SELECT COUNT(*)
      FROM public.sales
      WHERE business_id = p_business_id
        AND created_at >= CURRENT_DATE
        AND payment_method = 'Transferencia'
    ),
    'card_sales', (
      SELECT COUNT(*)
      FROM public.sales
      WHERE business_id = p_business_id
        AND created_at >= CURRENT_DATE
        AND payment_method = 'Tarjeta'
    ),
    'low_stock_count', (
      SELECT COUNT(*)
      FROM public.products
      WHERE business_id = p_business_id
        AND is_active = true
        AND stock <= min_stock
    ),
    'active_products', (
      SELECT COUNT(*)
      FROM public.products
      WHERE business_id = p_business_id
        AND is_active = true
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_business_today_metrics(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_business_today_metrics(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_business_today_metrics(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_business_today_metrics(uuid)
IS 'Obtiene métricas de hoy con validación de acceso por negocio.';
