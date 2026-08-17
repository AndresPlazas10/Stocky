-- ============================================================
-- HARDENING SEGURIDAD FASE 1 - Helper de permisos por rol
-- Fecha: 2026-08-17
-- Objetivo: proveer helpers de autorización por ROL (no solo por
-- membresía) para usarlos en las policies RLS de escritura.
-- ============================================================

BEGIN;

-- can_write_business: true si el usuario es owner/admin del negocio.
-- Se usa para restringir INSERT/UPDATE/DELETE de datos administrativos
-- (productos, proveedores, combos, facturas, negocio).
CREATE OR REPLACE FUNCTION public.can_write_business(p_business_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
BEGIN
  IF v_uid IS NULL OR p_business_id IS NULL THEN
    RETURN false;
  END IF;

  -- Owner del negocio
  IF EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = p_business_id
      AND b.created_by = v_uid
      AND COALESCE(b.is_active, true) = true
  ) THEN
    RETURN true;
  END IF;

  -- Admin/Owner activo como empleado
  SELECT lower(coalesce(e.role, '')) INTO v_role
  FROM public.employees e
  JOIN public.businesses b ON b.id = e.business_id
  WHERE e.business_id = p_business_id
    AND e.user_id = v_uid
    AND e.is_active = true
    AND COALESCE(b.is_active, true) = true
  LIMIT 1;

  IF v_role IN ('owner', 'admin', 'administrador', 'propietario')
     OR position('admin' in coalesce(v_role, '')) > 0 THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.can_write_business(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_write_business(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_write_business(uuid) TO authenticated;

COMMENT ON FUNCTION public.can_write_business(uuid)
IS 'Valida si el usuario puede escribir datos administrativos del negocio (owner/admin activo).';

-- can_operate_business: true si el usuario puede operar el flujo de mesas/órdenes
-- (cualquier empleado activo EXCEPTO cocina). Se usa para las policies de
-- orders/order_items/tables donde meseros/cajeros deben poder escribir.
CREATE OR REPLACE FUNCTION public.can_operate_business(p_business_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
BEGIN
  IF v_uid IS NULL OR p_business_id IS NULL THEN
    RETURN false;
  END IF;

  IF public.can_write_business(p_business_id) THEN
    RETURN true;
  END IF;

  SELECT lower(coalesce(e.role, '')) INTO v_role
  FROM public.employees e
  JOIN public.businesses b ON b.id = e.business_id
  WHERE e.business_id = p_business_id
    AND e.user_id = v_uid
    AND e.is_active = true
    AND COALESCE(b.is_active, true) = true
  LIMIT 1;

  -- Cocina es solo lectura: no puede operar el flujo de órdenes.
  IF v_role IN ('kitchen', 'cocina') THEN
    RETURN false;
  END IF;

  RETURN v_role <> '';
END;
$$;

REVOKE ALL ON FUNCTION public.can_operate_business(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_operate_business(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_operate_business(uuid) TO authenticated;

COMMENT ON FUNCTION public.can_operate_business(uuid)
IS 'Valida si el usuario puede operar el flujo de mesas/órdenes (empleado activo que no sea cocina).';

COMMIT;
