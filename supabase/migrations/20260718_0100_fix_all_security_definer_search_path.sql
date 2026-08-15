-- ============================================================
-- FIX: Set search_path for ALL SECURITY DEFINER functions
-- Fecha: 2026-07-18
-- Objetivo: eliminar warnings 0011 (function_search_path_mutable)
--   en TODAS las funciones del schema public que no tienen
--   search_path fijo, incluyendo funciones NO security definer
--   que tambien son marcadas por el linter.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Fix dinámico: todas las funciones SECURITY DEFINER sin search_path
-- ============================================================
DO $$
DECLARE
    fn record;
BEGIN
    FOR fn IN
        SELECT
            n.nspname AS schema_name,
            p.proname AS function_name,
            pg_get_function_identity_arguments(p.oid) AS args,
            p.prosecdef AS is_security_definer
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.prosecdef = true
          AND NOT EXISTS (
            SELECT 1
            FROM unnest(COALESCE(p.proconfig, '{}'::text[])) AS cfg
            WHERE cfg LIKE 'search_path=%'
          )
        ORDER BY p.proname
    LOOP
        RAISE NOTICE 'Fixing search_path for public.%(%)', fn.function_name, fn.args;
        EXECUTE format(
            'ALTER FUNCTION public.%I(%s) SET search_path = public',
            fn.function_name,
            fn.args
        );
    END LOOP;
END
$$;

-- ============================================================
-- 2. Fix explícito: persist_order_snapshot (no es SECURITY DEFINER
--    pero el linter igual lo marca por usar search_path mutable)
-- ============================================================
ALTER FUNCTION public.persist_order_snapshot(uuid, jsonb)
  SET search_path = public;

-- ============================================================
-- 3. Verificación: reportar cuántas quedan sin search_path
-- ============================================================
DO $$
DECLARE
    remaining_count integer;
BEGIN
    SELECT COUNT(*)
    INTO remaining_count
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND NOT EXISTS (
        SELECT 1
        FROM unnest(COALESCE(p.proconfig, '{}'::text[])) AS cfg
        WHERE cfg LIKE 'search_path=%'
      );

    IF remaining_count > 0 THEN
        RAISE WARNING 'Quedan % funciones SECURITY DEFINER sin search_path fijo', remaining_count;
    ELSE
        RAISE NOTICE 'Todas las funciones SECURITY DEFINER ahora tienen search_path = public';
    END IF;
END
$$;

COMMIT;
