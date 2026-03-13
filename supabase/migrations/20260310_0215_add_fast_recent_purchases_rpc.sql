BEGIN;

CREATE OR REPLACE FUNCTION public.list_recent_purchases_fast(
  p_business_id uuid,
  p_limit integer DEFAULT 40
)
RETURNS TABLE(
  id uuid,
  business_id uuid,
  user_id uuid,
  supplier_id uuid,
  payment_method text,
  total numeric,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 40), 1), 200);
BEGIN
  IF p_business_id IS NULL THEN
    RAISE EXCEPTION 'p_business_id es obligatorio';
  END IF;

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sesion invalida: auth.uid() es NULL';
  END IF;

  IF NOT public.can_access_business(p_business_id) THEN
    RAISE EXCEPTION 'No autorizado para acceder a compras de este negocio';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.business_id,
    p.user_id,
    p.supplier_id,
    lower(COALESCE(p.payment_method::text, 'cash')) AS payment_method,
    COALESCE(p.total, 0)::numeric AS total,
    p.created_at
  FROM public.purchases p
  WHERE p.business_id = p_business_id
  ORDER BY p.created_at DESC NULLS LAST, p.id DESC
  LIMIT v_limit;
END;
$$;

COMMENT ON FUNCTION public.list_recent_purchases_fast(uuid, integer)
IS 'Version optimizada de compras recientes para first-paint mobile (sin join a suppliers).';

REVOKE ALL ON FUNCTION public.list_recent_purchases_fast(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_recent_purchases_fast(uuid, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.list_recent_purchases_fast(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_recent_purchases_fast(uuid, integer) TO service_role;

ANALYZE public.purchases;

COMMIT;
