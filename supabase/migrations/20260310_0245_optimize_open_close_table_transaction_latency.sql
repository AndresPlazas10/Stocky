BEGIN;

CREATE OR REPLACE FUNCTION public.sync_table_state_from_order_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Permite omitir este trigger en transacciones que ya sincronizan tables
  -- explícitamente (ej: open_close_table_transaction) para reducir latencia.
  IF current_setting('stocky.skip_table_sync_from_orders', true) = '1' THEN
    RETURN NEW;
  END IF;

  -- UPDATE: si la orden deja de estar abierta, liberar mesa previa.
  IF TG_OP = 'UPDATE' THEN
    IF OLD.table_id IS NOT NULL
       AND lower(coalesce(OLD.status, '')) = 'open'
       AND (
         NEW.table_id IS DISTINCT FROM OLD.table_id
         OR lower(coalesce(NEW.status, '')) <> 'open'
       ) THEN
      UPDATE public.tables
      SET current_order_id = NULL,
          status = 'available',
          updated_at = timezone('utc', now())
      WHERE id = OLD.table_id
        AND business_id = OLD.business_id
        AND current_order_id = OLD.id;
    END IF;
  END IF;

  -- INSERT/UPDATE: orden abierta y ligada a mesa => ocupar mesa.
  IF NEW.table_id IS NOT NULL
     AND lower(coalesce(NEW.status, '')) = 'open' THEN
    UPDATE public.tables
    SET current_order_id = NEW.id,
        status = 'occupied',
        updated_at = timezone('utc', now())
    WHERE id = NEW.table_id
      AND business_id = NEW.business_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_orders_business_table_status_open
  ON public.orders (business_id, table_id, id DESC)
  WHERE status = 'open' AND table_id IS NOT NULL;

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

  IF v_auth_uid IS NOT NULL AND v_auth_uid <> p_user_id THEN
    RAISE EXCEPTION 'Sesión inválida para ejecutar operación de mesa';
  END IF;

  -- Evitar trabajo duplicado de trigger orders->tables en esta transacción.
  PERFORM set_config('stocky.skip_table_sync_from_orders', '1', true);

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
    -- Priorizar orden ya referenciada por la mesa si sigue abierta.
    IF v_current_order_id IS NOT NULL THEN
      SELECT o.id
      INTO v_order_id
      FROM public.orders o
      WHERE o.id = v_current_order_id
        AND o.business_id = v_business_id
        AND o.status = 'open'
      FOR UPDATE;
    END IF;

    -- Si no existe, reusar una abierta asociada a la mesa.
    IF v_order_id IS NULL THEN
      SELECT o.id
      INTO v_order_id
      FROM public.orders o
      WHERE o.business_id = v_business_id
        AND o.table_id = p_table_id
        AND o.status = 'open'
      ORDER BY o.id DESC
      LIMIT 1
      FOR UPDATE;
    END IF;

    -- Crear nueva orden abierta cuando no hay reutilizable.
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
    ELSE
      UPDATE public.orders o
      SET status = 'open',
          table_id = p_table_id,
          closed_at = NULL,
          opened_at = COALESCE(o.opened_at, v_now),
          updated_at = v_now,
          user_id = COALESCE(o.user_id, p_user_id)
      WHERE o.id = v_order_id;
    END IF;

    UPDATE public.tables t
    SET current_order_id = v_order_id,
        status = 'occupied',
        opened_at = v_now,
        closed_at = NULL,
        updated_at = v_now
    WHERE t.id = p_table_id
      AND t.business_id = v_business_id;
  ELSE
    -- Cerrar orden abierta principal de la mesa.
    IF v_current_order_id IS NOT NULL THEN
      UPDATE public.orders o
      SET status = 'closed',
          closed_at = v_now,
          updated_at = v_now
      WHERE o.id = v_current_order_id
        AND o.business_id = v_business_id
        AND o.status = 'open';
    ELSE
      UPDATE public.orders o
      SET status = 'closed',
          closed_at = v_now,
          updated_at = v_now
      WHERE o.business_id = v_business_id
        AND o.table_id = p_table_id
        AND o.status = 'open';
    END IF;

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
IS 'Version optimizada para baja latencia de commit al abrir/cerrar mesa en mobile.';

ANALYZE public.orders;
ANALYZE public.tables;

COMMIT;
