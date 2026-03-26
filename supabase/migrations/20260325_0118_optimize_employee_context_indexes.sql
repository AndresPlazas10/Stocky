BEGIN;

-- Empleados: listado de gestión ordenado por created_at DESC y filtrado por business_id.
CREATE INDEX IF NOT EXISTS idx_employees_business_created_at_desc_cover
  ON public.employees (business_id, created_at DESC)
  INCLUDE (id, user_id, username, full_name, role, is_active);

COMMENT ON INDEX public.idx_employees_business_created_at_desc_cover IS
  'Optimiza listado de empleados por negocio con orden reciente';

-- Contexto owner: bootstrap por created_by + created_at desc.
CREATE INDEX IF NOT EXISTS idx_businesses_created_by_created_at_desc_cover
  ON public.businesses (created_by, created_at DESC)
  INCLUDE (id, name, is_active);

COMMENT ON INDEX public.idx_businesses_created_by_created_at_desc_cover IS
  'Optimiza resolución de negocio inicial por owner';

ANALYZE public.employees;
ANALYZE public.businesses;

COMMIT;
