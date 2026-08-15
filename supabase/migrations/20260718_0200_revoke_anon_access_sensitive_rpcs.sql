-- ============================================================
-- REVOKE: Acceso anon a RPCs sensibles
-- Fecha: 2026-07-18
-- Objetivo: eliminar warnings 0028 (anon_security_definer_function_executable)
--   revocando EXECUTE al rol anon en funciones que requieren autenticación.
--
-- create_business_for_current_user SE MANTIENE con acceso anon
-- porque es necesaria para el flujo de registro (AuthScreen.tsx).
-- ============================================================

BEGIN;

-- list_tables_with_order_summary: requiere autenticación, solo llamada por app autenticada
REVOKE EXECUTE ON FUNCTION public.list_tables_with_order_summary(uuid)
  FROM anon;

-- open_close_table_transaction: operación sensible de mesas, solo autenticados
REVOKE EXECUTE ON FUNCTION public.open_close_table_transaction(uuid, text, uuid)
  FROM anon;

-- resolve_mobile_business_context: resuelve contexto de negocio, solo autenticados
REVOKE EXECUTE ON FUNCTION public.resolve_mobile_business_context(uuid, uuid)
  FROM anon;

COMMIT;
