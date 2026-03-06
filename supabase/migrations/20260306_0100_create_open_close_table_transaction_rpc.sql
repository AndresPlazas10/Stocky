-- ============================================================
-- RPC atómico para abrir/cerrar mesas
-- Fecha: 2026-03-06
-- Objetivo: ejecutar apertura/cierre de mesa + orden asociada
-- en una sola transacción del lado de BD.
-- ============================================================

CREATE OR REPLACE FUNCTION public.open_close_table_transaction(
  p_table_id uuid,
  p_action text,
  p_user_id uuid
)
RETURNS TABLE (
  id uuid,
  business_id uuid,
  current_order_id uuid,
  status text,
  opened_at timestamptz,
  closed_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := timezone('utc', now());
  v_action text := lower(trim(coalesce(p_action, '')));
  v_auth_uid uuid := auth.uid();
  v_business_id uuid;
  v_current_order_id uuid;
  v_order_id uuid;
  v_is_authorized boolean := false;
BEGIN
  IF p_table_id IS NULL THEN
    RAISE EXCEPTION 'p_table_id es obligatorio';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id es obligatorio';
  END IF;

  IF v_action NOT IN ('open', 'close') THEN
    RAISE EXCEPTION 'Acción inválida: %', p_action;
  END IF;

  -- Si la función se invoca con JWT de usuario, evitar suplantación.
  IF v_auth_uid IS NOT NULL AND v_auth_uid <> p_user_id THEN
    RAISE EXCEPTION 'Sesión inválida para ejecutar operación de mesa';
  END IF;

  -- Lock de la mesa para serializar operaciones concurrentes sobre la misma fila.
  SELECT t.business_id, t.current_order_id
  INTO v_business_id, v_current_order_id
  FROM public.tables t
  WHERE t.id = p_table_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mesa % no encontrada', p_table_id;
  END IF;

  SELECT (
    EXISTS (
      SELECT 1
      FROM public.businesses b
      WHERE b.id = v_business_id
        AND b.created_by = p_user_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.business_id = v_business_id
        AND e.user_id = p_user_id
        AND e.is_active = true
    )
  )
  INTO v_is_authorized;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'No autorizado para operar mesas de este negocio';
  END IF;

  IF v_action = 'open' THEN
    -- Reusar orden abierta existente de la mesa si ya existe.
    SELECT o.id
    INTO v_order_id
    FROM public.orders o
    WHERE o.business_id = v_business_id
      AND o.table_id = p_table_id
      AND lower(coalesce(o.status, '')) = 'open'
    ORDER BY COALESCE(o.opened_at, o.updated_at, v_now) ASC, o.id ASC
    LIMIT 1
    FOR UPDATE;

    -- Si la mesa apuntaba a una orden cerrada/inconsistente, intentar reabrirla.
    IF v_order_id IS NULL AND v_current_order_id IS NOT NULL THEN
      SELECT o.id
      INTO v_order_id
      FROM public.orders o
      WHERE o.id = v_current_order_id
        AND o.business_id = v_business_id
      FOR UPDATE;

      IF v_order_id IS NOT NULL THEN
        UPDATE public.orders o
        SET status = 'open',
            table_id = p_table_id,
            closed_at = NULL,
            opened_at = COALESCE(o.opened_at, v_now),
            updated_at = v_now,
            user_id = COALESCE(o.user_id, p_user_id)
        WHERE o.id = v_order_id;
      END IF;
    END IF;

    -- Si no existe orden reaprovechable, crear una nueva.
    IF v_order_id IS NULL THEN
      INSERT INTO public.orders (
        business_id,
        table_id,
        user_id,
        status,
        total,
        opened_at
      )
      VALUES (
        v_business_id,
        p_table_id,
        p_user_id,
        'open',
        0,
        v_now
      )
      RETURNING orders.id INTO v_order_id;
    END IF;

    -- Cancelar cualquier orden abierta adicional de la mesa para dejar estado canónico.
    UPDATE public.orders o
    SET status = 'cancelled',
        closed_at = v_now,
        table_id = NULL,
        updated_at = v_now
    WHERE o.business_id = v_business_id
      AND o.table_id = p_table_id
      AND lower(coalesce(o.status, '')) = 'open'
      AND o.id <> v_order_id;

    UPDATE public.tables t
    SET current_order_id = v_order_id,
        status = 'occupied',
        opened_at = v_now,
        closed_at = NULL,
        updated_at = v_now
    WHERE t.id = p_table_id
      AND t.business_id = v_business_id;
  ELSE
    -- Cierre canónico: cerrar cualquier orden abierta de la mesa.
    UPDATE public.orders o
    SET status = 'closed',
        closed_at = v_now,
        updated_at = v_now
    WHERE o.business_id = v_business_id
      AND o.table_id = p_table_id
      AND lower(coalesce(o.status, '')) = 'open';

    UPDATE public.tables t
    SET current_order_id = NULL,
        status = 'available',
        closed_at = v_now,
        updated_at = v_now
    WHERE t.id = p_table_id
      AND t.business_id = v_business_id;
  END IF;

  RETURN QUERY
  SELECT
    t.id,
    t.business_id,
    t.current_order_id,
    t.status,
    t.opened_at,
    t.closed_at,
    t.updated_at
  FROM public.tables t
  WHERE t.id = p_table_id
    AND t.business_id = v_business_id;
END;
$$;

COMMENT ON FUNCTION public.open_close_table_transaction(uuid, text, uuid)
IS 'Abre/cierra mesa en una transacción (tabla + orden), con validación de acceso por owner/empleado.';

REVOKE ALL ON FUNCTION public.open_close_table_transaction(uuid, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.open_close_table_transaction(uuid, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.open_close_table_transaction(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.open_close_table_transaction(uuid, text, uuid) TO service_role;
