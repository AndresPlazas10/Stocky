BEGIN;

ALTER TABLE public.tables
  ADD COLUMN IF NOT EXISTS sync_version bigint NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.tables.sync_version
IS 'Version monotona por mesa para evitar que snapshots viejos pisen estado mas reciente entre dispositivos.';

CREATE OR REPLACE FUNCTION public.bump_table_sync_version(p_table_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_table_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.tables AS t
  SET
    sync_version = COALESCE(t.sync_version, 0) + 1,
    updated_at = timezone('utc', now())
  WHERE t.id = p_table_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.touch_table_sync_from_orders()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_new_table_id uuid;
  v_old_table_id uuid;
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    v_new_table_id := NEW.table_id;
  END IF;

  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    v_old_table_id := OLD.table_id;
  END IF;

  IF v_new_table_id IS NOT NULL THEN
    PERFORM public.bump_table_sync_version(v_new_table_id);
  END IF;

  IF v_old_table_id IS NOT NULL AND v_old_table_id IS DISTINCT FROM v_new_table_id THEN
    PERFORM public.bump_table_sync_version(v_old_table_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.touch_table_sync_from_order_items()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_new_order_id uuid;
  v_old_order_id uuid;
  v_new_table_id uuid;
  v_old_table_id uuid;
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    v_new_order_id := NEW.order_id;
  END IF;

  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    v_old_order_id := OLD.order_id;
  END IF;

  IF v_new_order_id IS NOT NULL THEN
    SELECT o.table_id
    INTO v_new_table_id
    FROM public.orders AS o
    WHERE o.id = v_new_order_id
    LIMIT 1;
  END IF;

  IF v_old_order_id IS NOT NULL AND v_old_order_id IS DISTINCT FROM v_new_order_id THEN
    SELECT o.table_id
    INTO v_old_table_id
    FROM public.orders AS o
    WHERE o.id = v_old_order_id
    LIMIT 1;
  ELSIF v_old_order_id IS NOT NULL THEN
    v_old_table_id := v_new_table_id;
  END IF;

  IF v_new_table_id IS NOT NULL THEN
    PERFORM public.bump_table_sync_version(v_new_table_id);
  END IF;

  IF v_old_table_id IS NOT NULL AND v_old_table_id IS DISTINCT FROM v_new_table_id THEN
    PERFORM public.bump_table_sync_version(v_old_table_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_table_sync_from_orders ON public.orders;
CREATE TRIGGER trg_touch_table_sync_from_orders
AFTER INSERT OR UPDATE OR DELETE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.touch_table_sync_from_orders();

DROP TRIGGER IF EXISTS trg_touch_table_sync_from_order_items ON public.order_items;
CREATE TRIGGER trg_touch_table_sync_from_order_items
AFTER INSERT OR UPDATE OR DELETE ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.touch_table_sync_from_order_items();

COMMIT;
