BEGIN;

-- Fix mutable search_path on functions flagged by Supabase linter (0011)
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS proc
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'validate_sale_before_insert',
        'set_table_edit_locks_updated_at',
        'set_orders_updated_at',
        'set_tables_updated_at'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp;', r.proc);
  END LOOP;
END $$;

-- Prevent direct API access to materialized view (use RPCs instead)
REVOKE ALL ON TABLE public.business_metrics_daily FROM anon, authenticated;
GRANT SELECT ON TABLE public.business_metrics_daily TO service_role;

COMMIT;
