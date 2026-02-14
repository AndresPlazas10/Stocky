-- =====================================================
-- Reassert acceso a negocio + RLS ventas
-- Fecha: 2026-02-13
-- Objetivo:
--   1) Reforzar can_access_business (NULL en is_active => activo)
--   2) Reaplicar policy unificada de sales con can_access_business
-- =====================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.can_access_business(p_business_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR p_business_id IS NULL THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.businesses b
    WHERE b.id = p_business_id
      AND b.created_by = v_uid
  ) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.business_id = p_business_id
      AND e.user_id = v_uid
      AND COALESCE(e.is_active, true) = true
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.can_access_business(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_business(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_access_business(uuid) TO authenticated;

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sales_access_policy ON public.sales;
DROP POLICY IF EXISTS sales_select_policy ON public.sales;
DROP POLICY IF EXISTS sales_insert_policy ON public.sales;
DROP POLICY IF EXISTS sales_update_policy ON public.sales;
DROP POLICY IF EXISTS sales_delete_policy ON public.sales;

CREATE POLICY sales_access_policy ON public.sales
  FOR ALL
  TO authenticated
  USING (
    public.can_access_business(sales.business_id)
  )
  WITH CHECK (
    public.can_access_business(sales.business_id)
  );

COMMIT;
