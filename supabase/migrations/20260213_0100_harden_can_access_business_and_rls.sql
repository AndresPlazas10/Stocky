-- =====================================================
-- HARDENING P0 - Step 1
-- Fecha: 2026-02-13
-- Objetivo:
--  1) Eliminar policy permisiva en employees (USING true)
--  2) Endurecer grants críticos en funciones sensibles
-- =====================================================

-- -----------------------------------------------------
-- 1) Helper seguro para validar acceso a business
-- -----------------------------------------------------
-- SECURITY DEFINER para evitar recursión de RLS al consultar employees.
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

  -- Owner del negocio
  IF EXISTS (
    SELECT 1
    FROM public.businesses b
    WHERE b.id = p_business_id
      AND b.created_by = v_uid
  ) THEN
    RETURN true;
  END IF;

  -- Empleado activo del negocio
  IF EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.business_id = p_business_id
      AND e.user_id = v_uid
      AND e.is_active = true
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.can_access_business(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_business(uuid) TO authenticated;

COMMENT ON FUNCTION public.can_access_business(uuid)
IS 'Valida acceso del usuario autenticado al negocio (owner o empleado activo).';

-- -----------------------------------------------------
-- 2) Employees RLS: remover policy abierta y crear policy segura
-- -----------------------------------------------------
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employees_select_all ON public.employees;
DROP POLICY IF EXISTS employees_select_policy ON public.employees;

CREATE POLICY employees_select_policy ON public.employees
  FOR SELECT
  USING (
    public.can_access_business(employees.business_id)
  );

-- Mantener políticas de INSERT/UPDATE/DELETE existentes (owners)
-- y forzar que no exista bypass por policy abierta.

-- -----------------------------------------------------
-- 3) Endurecer grants críticos (quitar anon/public)
-- -----------------------------------------------------

-- generate_invoice_number(uuid)
DO $$
BEGIN
  IF to_regprocedure('public.generate_invoice_number(uuid)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.generate_invoice_number(uuid) FROM PUBLIC;
    REVOKE ALL ON FUNCTION public.generate_invoice_number(uuid) FROM anon;
    GRANT EXECUTE ON FUNCTION public.generate_invoice_number(uuid) TO authenticated;
  END IF;
END
$$;

-- update_stock_batch(jsonb)
DO $$
BEGIN
  IF to_regprocedure('public.update_stock_batch(jsonb)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.update_stock_batch(jsonb) FROM PUBLIC;
    REVOKE ALL ON FUNCTION public.update_stock_batch(jsonb) FROM anon;
    GRANT EXECUTE ON FUNCTION public.update_stock_batch(jsonb) TO authenticated;
  END IF;
END
$$;

-- restore_stock_batch(jsonb)
DO $$
BEGIN
  IF to_regprocedure('public.restore_stock_batch(jsonb)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.restore_stock_batch(jsonb) FROM PUBLIC;
    REVOKE ALL ON FUNCTION public.restore_stock_batch(jsonb) FROM anon;
    GRANT EXECUTE ON FUNCTION public.restore_stock_batch(jsonb) TO authenticated;
  END IF;
END
$$;

-- create_sale_complete(uuid,uuid,text,text,jsonb,uuid,uuid)
DO $$
BEGIN
  IF to_regprocedure('public.create_sale_complete(uuid,uuid,text,text,jsonb,uuid,uuid)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.create_sale_complete(uuid,uuid,text,text,jsonb,uuid,uuid) FROM PUBLIC;
    REVOKE ALL ON FUNCTION public.create_sale_complete(uuid,uuid,text,text,jsonb,uuid,uuid) FROM anon;
    GRANT EXECUTE ON FUNCTION public.create_sale_complete(uuid,uuid,text,text,jsonb,uuid,uuid) TO authenticated;
  END IF;
END
$$;

-- =====================================================
-- Fin de migración P0 Step 1
-- =====================================================
