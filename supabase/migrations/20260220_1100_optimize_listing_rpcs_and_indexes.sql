-- ============================================================
-- Optimización listados ventas/compras (latencia)
-- Fecha: 2026-02-20
-- Objetivo:
--   1) Agregar índices faltantes para filtros frecuentes.
--   2) Optimizar get_sales_enriched/get_purchases_enriched
--      evitando COUNT(*) OVER() por fila.
-- ============================================================

-- -----------------------------------------------------------------
-- 1) Índices faltantes para filtros reales de frontend
-- -----------------------------------------------------------------

-- Ventas filtradas por cliente + fecha
CREATE INDEX IF NOT EXISTS idx_sales_business_customer_created
  ON public.sales (business_id, customer_id, created_at DESC)
  WHERE customer_id IS NOT NULL;

-- Compras filtradas por proveedor + fecha
CREATE INDEX IF NOT EXISTS idx_purchases_business_supplier_created
  ON public.purchases (business_id, supplier_id, created_at DESC)
  WHERE supplier_id IS NOT NULL;

-- Compras filtradas por usuario + fecha
CREATE INDEX IF NOT EXISTS idx_purchases_business_user_created
  ON public.purchases (business_id, user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

-- Carga/eliminación de detalles de compra por purchase_id
CREATE INDEX IF NOT EXISTS idx_purchase_details_purchase_product
  ON public.purchase_details (purchase_id, product_id);

-- Reportes por producto en compras
CREATE INDEX IF NOT EXISTS idx_purchase_details_product_purchase
  ON public.purchase_details (product_id, purchase_id);

-- -----------------------------------------------------------------
-- 2) RPC get_sales_enriched optimizado
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
DECLARE
  v_business_owner uuid;
  v_total_count bigint := NULL;
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

  SELECT b.created_by
  INTO v_business_owner
  FROM public.businesses b
  WHERE b.id = p_business_id
  LIMIT 1;

  -- Contar una sola vez (evita COUNT(*) OVER() para cada fila del page set).
  IF p_include_count THEN
    SELECT COUNT(*)
    INTO v_total_count
    FROM public.sales s
    WHERE s.business_id = p_business_id
      AND (p_from_date IS NULL OR s.created_at >= p_from_date)
      AND (p_to_date IS NULL OR s.created_at <= p_to_date)
      AND (p_payment_method IS NULL OR s.payment_method = p_payment_method)
      AND (p_user_id IS NULL OR s.user_id = p_user_id)
      AND (p_customer_id IS NULL OR s.customer_id = p_customer_id)
      AND (p_min_amount IS NULL OR s.total >= p_min_amount)
      AND (p_max_amount IS NULL OR s.total <= p_max_amount);
  END IF;

  RETURN QUERY
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
    (s.user_id = v_business_owner) AS is_owner,
    v_total_count AS total_count
  FROM public.sales s
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
  ORDER BY s.created_at DESC
  OFFSET GREATEST(COALESCE(p_offset, 0), 0)
  LIMIT GREATEST(COALESCE(p_limit, 50), 1);
END;
$$;

REVOKE ALL ON FUNCTION public.get_sales_enriched(uuid,integer,integer,timestamptz,timestamptz,text,uuid,uuid,numeric,numeric,boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_sales_enriched(uuid,integer,integer,timestamptz,timestamptz,text,uuid,uuid,numeric,numeric,boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_sales_enriched(uuid,integer,integer,timestamptz,timestamptz,text,uuid,uuid,numeric,numeric,boolean) TO authenticated;

COMMENT ON FUNCTION public.get_sales_enriched(uuid,integer,integer,timestamptz,timestamptz,text,uuid,uuid,numeric,numeric,boolean)
IS 'Listado paginado de ventas enriquecido. Optimizado para latencia: count separado (sin COUNT OVER por fila).';

-- -----------------------------------------------------------------
-- 3) RPC get_purchases_enriched optimizado
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
DECLARE
  v_business_owner uuid;
  v_total_count bigint := NULL;
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

  SELECT b.created_by
  INTO v_business_owner
  FROM public.businesses b
  WHERE b.id = p_business_id
  LIMIT 1;

  IF p_include_count THEN
    SELECT COUNT(*)
    INTO v_total_count
    FROM public.purchases p
    WHERE p.business_id = p_business_id
      AND (p_from_date IS NULL OR p.created_at >= p_from_date)
      AND (p_to_date IS NULL OR p.created_at <= p_to_date)
      AND (p_supplier_id IS NULL OR p.supplier_id = p_supplier_id)
      AND (p_user_id IS NULL OR p.user_id = p_user_id)
      AND (p_min_amount IS NULL OR p.total >= p_min_amount)
      AND (p_max_amount IS NULL OR p.total <= p_max_amount);
  END IF;

  RETURN QUERY
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
    (p.user_id = v_business_owner) AS is_owner,
    v_total_count AS total_count
  FROM public.purchases p
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
  ORDER BY p.created_at DESC
  OFFSET GREATEST(COALESCE(p_offset, 0), 0)
  LIMIT GREATEST(COALESCE(p_limit, 50), 1);
END;
$$;

REVOKE ALL ON FUNCTION public.get_purchases_enriched(uuid,integer,integer,timestamptz,timestamptz,uuid,uuid,numeric,numeric,boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_purchases_enriched(uuid,integer,integer,timestamptz,timestamptz,uuid,uuid,numeric,numeric,boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_purchases_enriched(uuid,integer,integer,timestamptz,timestamptz,uuid,uuid,numeric,numeric,boolean) TO authenticated;

COMMENT ON FUNCTION public.get_purchases_enriched(uuid,integer,integer,timestamptz,timestamptz,uuid,uuid,numeric,numeric,boolean)
IS 'Listado paginado de compras enriquecido. Optimizado para latencia: count separado (sin COUNT OVER por fila).';

