-- ============================================================
-- Reconciliacion server-side de consistencia mesas/ordenes
-- Fecha: 2026-02-25
-- Objetivo: ejecutar reconciliacion fuera del Dashboard (RPC + cron)
-- ============================================================

CREATE OR REPLACE FUNCTION public.reconcile_tables_orders_consistency(
  p_business_id uuid,
  p_max_fixes integer DEFAULT 50,
  p_source text DEFAULT 'rpc'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_limit integer := GREATEST(COALESCE(p_max_fixes, 50), 1);
  v_applied integer := 0;
  v_status_fixed integer := 0;
  v_pointer_cleared integer := 0;
  v_table_from_open integer := 0;
  v_table_hard_conflict_fixed integer := 0;
  v_orders_cancelled_conflict integer := 0;
  v_orders_cancelled_missing_table integer := 0;
BEGIN
  IF p_business_id IS NULL THEN
    RAISE EXCEPTION 'p_business_id es requerido';
  END IF;

  -- Permitir cron/service role sin auth.uid(); usuarios autenticados deben pertenecer al negocio.
  IF v_actor IS NOT NULL AND NOT public.can_access_business(v_actor, p_business_id) THEN
    RAISE EXCEPTION 'No autorizado para reconciliar este negocio';
  END IF;

  -- Lock por negocio para evitar carreras entre ejecuciones concurrentes.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_business_id::text, 0));

  -- 1) Normalizar status de mesa segun current_order_id.
  WITH target AS (
    SELECT t.id,
           CASE WHEN t.current_order_id IS NULL THEN 'available' ELSE 'occupied' END AS desired_status
    FROM public.tables t
    WHERE t.business_id = p_business_id
      AND lower(coalesce(t.status, '')) <> CASE WHEN t.current_order_id IS NULL THEN 'available' ELSE 'occupied' END
    LIMIT v_limit
  )
  UPDATE public.tables t
  SET status = target.desired_status,
      updated_at = timezone('utc', now())
  FROM target
  WHERE t.id = target.id;
  GET DIAGNOSTICS v_status_fixed = ROW_COUNT;

  -- 2) Quitar current_order_id si apunta a orden no abierta/no valida.
  WITH target AS (
    SELECT t.id
    FROM public.tables t
    WHERE t.business_id = p_business_id
      AND t.current_order_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.orders o
        WHERE o.id = t.current_order_id
          AND o.business_id = t.business_id
          AND lower(coalesce(o.status, '')) = 'open'
      )
    LIMIT v_limit
  )
  UPDATE public.tables t
  SET current_order_id = NULL,
      status = 'available',
      updated_at = timezone('utc', now())
  FROM target
  WHERE t.id = target.id;
  GET DIAGNOSTICS v_pointer_cleared = ROW_COUNT;

  -- 3) Resolver conflictos duros: multiples ordenes abiertas para la misma mesa.
  WITH open_orders AS (
    SELECT o.id, o.business_id, o.table_id, o.opened_at, o.updated_at
    FROM public.orders o
    WHERE o.business_id = p_business_id
      AND o.table_id IS NOT NULL
      AND lower(coalesce(o.status, '')) = 'open'
  ),
  ranked AS (
    SELECT
      oo.id,
      oo.business_id,
      oo.table_id,
      ROW_NUMBER() OVER (
        PARTITION BY oo.table_id
        ORDER BY
          CASE WHEN oo.id = t.current_order_id THEN 0 ELSE 1 END,
          COALESCE(oo.opened_at, oo.updated_at, timezone('utc', now())) ASC,
          oo.id ASC
      ) AS rn
    FROM open_orders oo
    JOIN public.tables t
      ON t.id = oo.table_id
     AND t.business_id = oo.business_id
  ),
  canonical AS (
    SELECT r.table_id, r.business_id, r.id AS canonical_order_id
    FROM ranked r
    WHERE r.rn = 1
  ),
  target AS (
    SELECT t.id, c.canonical_order_id
    FROM public.tables t
    JOIN canonical c
      ON c.table_id = t.id
     AND c.business_id = t.business_id
    WHERE t.business_id = p_business_id
      AND (t.current_order_id IS DISTINCT FROM c.canonical_order_id OR lower(coalesce(t.status, '')) <> 'occupied')
    LIMIT v_limit
  )
  UPDATE public.tables t
  SET current_order_id = target.canonical_order_id,
      status = 'occupied',
      updated_at = timezone('utc', now())
  FROM target
  WHERE t.id = target.id;
  GET DIAGNOSTICS v_table_hard_conflict_fixed = ROW_COUNT;

  WITH open_orders AS (
    SELECT o.id, o.business_id, o.table_id, o.opened_at, o.updated_at
    FROM public.orders o
    WHERE o.business_id = p_business_id
      AND o.table_id IS NOT NULL
      AND lower(coalesce(o.status, '')) = 'open'
  ),
  ranked AS (
    SELECT
      oo.id,
      oo.business_id,
      oo.table_id,
      ROW_NUMBER() OVER (
        PARTITION BY oo.table_id
        ORDER BY
          CASE WHEN oo.id = t.current_order_id THEN 0 ELSE 1 END,
          COALESCE(oo.opened_at, oo.updated_at, timezone('utc', now())) ASC,
          oo.id ASC
      ) AS rn
    FROM open_orders oo
    JOIN public.tables t
      ON t.id = oo.table_id
     AND t.business_id = oo.business_id
  ),
  conflicts AS (
    SELECT r.id
    FROM ranked r
    WHERE r.rn > 1
    LIMIT v_limit
  )
  UPDATE public.orders o
  SET status = 'cancelled',
      closed_at = timezone('utc', now()),
      table_id = NULL,
      updated_at = timezone('utc', now())
  FROM conflicts c
  WHERE o.id = c.id
    AND o.business_id = p_business_id
    AND lower(coalesce(o.status, '')) = 'open';
  GET DIAGNOSTICS v_orders_cancelled_conflict = ROW_COUNT;

  -- 4) Cancelar ordenes abiertas que apuntan a mesa inexistente.
  WITH target AS (
    SELECT o.id
    FROM public.orders o
    WHERE o.business_id = p_business_id
      AND o.table_id IS NOT NULL
      AND lower(coalesce(o.status, '')) = 'open'
      AND NOT EXISTS (
        SELECT 1 FROM public.tables t WHERE t.id = o.table_id AND t.business_id = o.business_id
      )
    LIMIT v_limit
  )
  UPDATE public.orders o
  SET status = 'cancelled',
      closed_at = timezone('utc', now()),
      table_id = NULL,
      updated_at = timezone('utc', now())
  FROM target
  WHERE o.id = target.id;
  GET DIAGNOSTICS v_orders_cancelled_missing_table = ROW_COUNT;

  -- 5) Reatar mesa para orden abierta valida cuando la mesa no tiene current_order_id.
  WITH target AS (
    SELECT t.id AS table_id, o.id AS order_id
    FROM public.tables t
    JOIN public.orders o
      ON o.table_id = t.id
     AND o.business_id = t.business_id
     AND lower(coalesce(o.status, '')) = 'open'
    WHERE t.business_id = p_business_id
      AND t.current_order_id IS NULL
    ORDER BY COALESCE(o.opened_at, o.updated_at, timezone('utc', now())) ASC, o.id ASC
    LIMIT v_limit
  )
  UPDATE public.tables t
  SET current_order_id = target.order_id,
      status = 'occupied',
      updated_at = timezone('utc', now())
  FROM target
  WHERE t.id = target.table_id;
  GET DIAGNOSTICS v_table_from_open = ROW_COUNT;

  v_applied := v_status_fixed
    + v_pointer_cleared
    + v_table_hard_conflict_fixed
    + v_orders_cancelled_conflict
    + v_orders_cancelled_missing_table
    + v_table_from_open;

  RETURN jsonb_build_object(
    'ok', true,
    'reason', CASE WHEN v_applied = 0 THEN 'clean' ELSE 'reconciled' END,
    'source', COALESCE(p_source, 'rpc'),
    'business_id', p_business_id,
    'applied_fixes', v_applied,
    'findings', jsonb_build_array(),
    'details', jsonb_build_object(
      'table_status_fixed', v_status_fixed,
      'table_pointer_cleared', v_pointer_cleared,
      'table_hard_conflict_fixed', v_table_hard_conflict_fixed,
      'orders_cancelled_conflict', v_orders_cancelled_conflict,
      'orders_cancelled_missing_table', v_orders_cancelled_missing_table,
      'table_from_open', v_table_from_open
    )
  );
END;
$$;

COMMENT ON FUNCTION public.reconcile_tables_orders_consistency(uuid, integer, text)
IS 'Reconciliacion transaccional server-side de consistencia entre tables.current_order_id/status y orders abiertas.';

GRANT EXECUTE ON FUNCTION public.reconcile_tables_orders_consistency(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_tables_orders_consistency(uuid, integer, text) TO service_role;

CREATE OR REPLACE FUNCTION public.reconcile_tables_orders_consistency_all(
  p_limit_businesses integer DEFAULT 200
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business record;
  v_count integer := 0;
BEGIN
  FOR v_business IN
    SELECT b.id
    FROM public.businesses b
    WHERE b.is_active IS DISTINCT FROM false
    ORDER BY b.created_at DESC
    LIMIT GREATEST(COALESCE(p_limit_businesses, 200), 1)
  LOOP
    PERFORM public.reconcile_tables_orders_consistency(v_business.id, 50, 'cron');
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.reconcile_tables_orders_consistency_all(integer)
IS 'Ejecuta reconciliacion de mesas/ordenes para multiples negocios activos (uso cron server-side).';

GRANT EXECUTE ON FUNCTION public.reconcile_tables_orders_consistency_all(integer) TO service_role;

DO $$
DECLARE
  v_has_cron_schema boolean := EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron');
  v_existing_job record;
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
  EXCEPTION WHEN OTHERS THEN
    -- Si no hay permisos o no esta disponible, no fallar la migracion.
    NULL;
  END;

  IF NOT v_has_cron_schema THEN
    v_has_cron_schema := EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron');
  END IF;

  IF NOT v_has_cron_schema THEN
    RETURN;
  END IF;

  FOR v_existing_job IN
    SELECT jobid
    FROM cron.job
    WHERE jobname = 'stocky_reconcile_tables_orders_consistency'
  LOOP
    PERFORM cron.unschedule(v_existing_job.jobid);
  END LOOP;

  PERFORM cron.schedule(
    'stocky_reconcile_tables_orders_consistency',
    '* * * * *',
    'SELECT public.reconcile_tables_orders_consistency_all(200);'
  );
END;
$$;
