-- ============================================================
-- HARDENING P0 - Step 6
-- Fecha: 2026-02-13
-- Objetivo: restringir grants de RPCs sensibles no versionadas
-- que puedan existir con firmas variables en distintos entornos.
-- ============================================================

DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT
      n.nspname AS schema_name,
      p.proname AS function_name,
      pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'create_employee',
        'update_employee',
        'delete_employee',
        'delete_auth_user',
        'increase_stock',
        'reduce_stock',
        'restore_stock_from_invoice',
        'check_email_has_access',
        'user_has_business_access'
      )
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC',
      fn.schema_name,
      fn.function_name,
      fn.args
    );

    EXECUTE format(
      'REVOKE ALL ON FUNCTION %I.%I(%s) FROM anon',
      fn.schema_name,
      fn.function_name,
      fn.args
    );

    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated',
      fn.schema_name,
      fn.function_name,
      fn.args
    );
  END LOOP;
END
$$;

COMMENT ON SCHEMA public IS
  'Hardening aplicado: grants de RPCs sensibles restringidos (PUBLIC/anon revocados).';
