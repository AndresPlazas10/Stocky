BEGIN;

CREATE OR REPLACE FUNCTION public.list_recent_sales_mobile(
  p_business_id uuid,
  p_limit integer DEFAULT 50
)
RETURNS TABLE(
  id uuid,
  business_id uuid,
  user_id uuid,
  seller_name text,
  payment_method text,
  total numeric,
  created_at timestamptz,
  amount_received numeric,
  change_amount numeric,
  change_breakdown jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
  v_has_amount_received boolean := false;
  v_has_change_amount boolean := false;
  v_has_change_breakdown boolean := false;
  v_amount_received_expr text;
  v_change_amount_expr text;
  v_change_breakdown_expr text;
  v_sql text;
BEGIN
  IF p_business_id IS NULL THEN
    RAISE EXCEPTION 'p_business_id es obligatorio';
  END IF;

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sesion invalida: auth.uid() es NULL';
  END IF;

  IF NOT public.can_access_business(p_business_id) THEN
    RAISE EXCEPTION 'No autorizado para acceder a ventas de este negocio';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sales'
      AND column_name = 'amount_received'
  ) INTO v_has_amount_received;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sales'
      AND column_name = 'change_amount'
  ) INTO v_has_change_amount;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sales'
      AND column_name = 'change_breakdown'
  ) INTO v_has_change_breakdown;

  v_amount_received_expr := CASE
    WHEN v_has_amount_received THEN 's.amount_received::numeric'
    ELSE 'NULL::numeric'
  END;

  v_change_amount_expr := CASE
    WHEN v_has_change_amount THEN 's.change_amount::numeric'
    ELSE 'NULL::numeric'
  END;

  v_change_breakdown_expr := CASE
    WHEN v_has_change_breakdown THEN 'COALESCE(s.change_breakdown::jsonb, ''[]''::jsonb)'
    ELSE '''[]''::jsonb'
  END;

  v_sql := format($sql$
    SELECT
      s.id,
      s.business_id,
      s.user_id,
      COALESCE(NULLIF(trim(s.seller_name), ''), 'Vendedor')::text AS seller_name,
      lower(COALESCE(s.payment_method::text, 'cash')) AS payment_method,
      COALESCE(s.total, 0)::numeric AS total,
      s.created_at,
      %s AS amount_received,
      %s AS change_amount,
      %s AS change_breakdown
    FROM public.sales s
    WHERE s.business_id = $1
    ORDER BY s.created_at DESC NULLS LAST, s.id DESC
    LIMIT $2
  $sql$, v_amount_received_expr, v_change_amount_expr, v_change_breakdown_expr);

  RETURN QUERY EXECUTE v_sql USING p_business_id, v_limit;
END;
$$;

COMMENT ON FUNCTION public.list_recent_sales_mobile(uuid, integer)
IS 'Devuelve ventas recientes para mobile en una sola llamada, compatible con esquemas legacy sin columnas de efectivo.';

REVOKE ALL ON FUNCTION public.list_recent_sales_mobile(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_recent_sales_mobile(uuid, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.list_recent_sales_mobile(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_recent_sales_mobile(uuid, integer) TO service_role;

COMMIT;
