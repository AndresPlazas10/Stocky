-- ============================================================
-- Índices de performance para contexto móvil y listado de mesas
-- Fecha: 2026-03-09
-- Objetivo:
--   1) Acelerar resolve_mobile_business_context (owner/employee)
--   2) Reducir costo de listados/count por business_id en tables
-- ============================================================

BEGIN;

-- Owner context: SELECT ... FROM businesses
-- WHERE created_by = ? ORDER BY created_at DESC LIMIT 1
CREATE INDEX IF NOT EXISTS idx_businesses_created_by_created_at_desc
  ON public.businesses (created_by, created_at DESC);

-- Employee context: SELECT ... FROM employees
-- WHERE user_id = ? AND is_active = true ORDER BY created_at DESC LIMIT 1
CREATE INDEX IF NOT EXISTS idx_employees_user_active_created_at_desc
  ON public.employees (user_id, is_active, created_at DESC, business_id);

-- Mesas iniciales: filtros por business_id + orden por table_number/id.
CREATE INDEX IF NOT EXISTS idx_tables_business
  ON public.tables (business_id);

CREATE INDEX IF NOT EXISTS idx_tables_business_table_number_id
  ON public.tables (business_id, table_number, id);

ANALYZE public.businesses;
ANALYZE public.employees;
ANALYZE public.tables;

COMMIT;
