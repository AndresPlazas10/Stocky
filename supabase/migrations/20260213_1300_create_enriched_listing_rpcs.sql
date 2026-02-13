-- ============================================================
-- Enriched listing RPCs for Ventas/Compras
-- Fecha: 2026-02-13
-- Objetivo:
--   - Reducir roundtrips del frontend en listados paginados.
--   - Entregar datos enriquecidos (owner/admin/supplier) en una sola llamada.
-- ============================================================

-- -----------------------------------------------------------------
-- get_sales_enriched
-- -----------------------------------------------------------------
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
IS 'Listado paginado de ventas enriquecido (owner/admin) con control de acceso por negocio.';

-- -----------------------------------------------------------------
-- get_purchases_enriched
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_purchases_enriched(
  p_business_id uuid,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_from_date timestamptz DEFAULT NULL,
  p_to_date timestamptz DEFAULT NULL,
  p_supplier_id uuid DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_min_amount numeric DEFAULT NULL,
  p_max_amount numeric DEFAULT NULL,
  p_include_count boolean DEFAULT true
)
RETURNS TABLE (
  id uuid,
  business_id uuid,
  user_id uuid,
  supplier_id uuid,
  payment_method text,
  notes text,
  total numeric,
  created_at timestamptz,
  supplier_business_name text,
  supplier_contact_name text,
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
    RAISE EXCEPTION 'No autorizado para consultar compras de este negocio';
  END IF;

  RETURN QUERY
  WITH filtered AS (
    SELECT
      p.id,
      p.business_id,
      p.user_id,
      p.supplier_id,
      p.payment_method,
      p.notes,
      p.total,
      p.created_at,
      s.business_name AS supplier_business_name,
      s.contact_name AS supplier_contact_name,
      e.full_name AS employee_full_name,
      e.role AS employee_role,
      (p.user_id = b.created_by) AS is_owner
    FROM public.purchases p
    LEFT JOIN public.businesses b
      ON b.id = p.business_id
    LEFT JOIN public.suppliers s
      ON s.id = p.supplier_id
    LEFT JOIN public.employees e
      ON e.business_id = p.business_id
     AND e.user_id = p.user_id
    WHERE p.business_id = p_business_id
      AND (p_from_date IS NULL OR p.created_at >= p_from_date)
      AND (p_to_date IS NULL OR p.created_at <= p_to_date)
      AND (p_supplier_id IS NULL OR p.supplier_id = p_supplier_id)
      AND (p_user_id IS NULL OR p.user_id = p_user_id)
      AND (p_min_amount IS NULL OR p.total >= p_min_amount)
      AND (p_max_amount IS NULL OR p.total <= p_max_amount)
  )
  SELECT
    f.id,
    f.business_id,
    f.user_id,
    f.supplier_id,
    f.payment_method,
    f.notes,
    f.total,
    f.created_at,
    f.supplier_business_name,
    f.supplier_contact_name,
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

REVOKE ALL ON FUNCTION public.get_purchases_enriched(uuid,integer,integer,timestamptz,timestamptz,uuid,uuid,numeric,numeric,boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_purchases_enriched(uuid,integer,integer,timestamptz,timestamptz,uuid,uuid,numeric,numeric,boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_purchases_enriched(uuid,integer,integer,timestamptz,timestamptz,uuid,uuid,numeric,numeric,boolean) TO authenticated;

COMMENT ON FUNCTION public.get_purchases_enriched(uuid,integer,integer,timestamptz,timestamptz,uuid,uuid,numeric,numeric,boolean)
IS 'Listado paginado de compras enriquecido (supplier/owner/admin) con control de acceso por negocio.';
