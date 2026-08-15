-- =====================================================
-- POLÍTICAS RLS PARA ORDERS
-- Fecha: 2026-08-13
-- Objetivo: restaurar el acceso de clientes a `orders`.
-- La política antigua `orders_all` fue eliminada en
-- 20260119_optimize_rls_performance.sql sin reemplazo,
-- por lo que todos los UPDATE/INSERT/DELETE de clientes
-- quedaron bloqueados silenciosamente por RLS (0 filas).
-- Consecuencia: `orders.total` nunca se actualizaba y la
-- web mostraba el total en 0 tras el poll de 5s.
-- =====================================================

ALTER TABLE IF EXISTS public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS orders_select_policy ON public.orders;
CREATE POLICY orders_select_policy ON public.orders
  FOR SELECT TO authenticated
  USING (public.can_access_business(business_id));

DROP POLICY IF EXISTS orders_insert_policy ON public.orders;
CREATE POLICY orders_insert_policy ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (public.can_access_business(business_id));

DROP POLICY IF EXISTS orders_update_policy ON public.orders;
CREATE POLICY orders_update_policy ON public.orders
  FOR UPDATE TO authenticated
  USING (public.can_access_business(business_id))
  WITH CHECK (public.can_access_business(business_id));

DROP POLICY IF EXISTS orders_delete_policy ON public.orders;
CREATE POLICY orders_delete_policy ON public.orders
  FOR DELETE TO authenticated
  USING (public.can_access_business(business_id));

COMMENT ON POLICY orders_select_policy ON public.orders
IS 'Permite ver órdenes de negocios donde el usuario es owner o empleado activo (can_access_business).';
COMMENT ON POLICY orders_insert_policy ON public.orders
IS 'Permite crear órdenes en negocios donde el usuario es owner o empleado activo (can_access_business).';
COMMENT ON POLICY orders_update_policy ON public.orders
IS 'Permite actualizar órdenes (total, estado) en negocios donde el usuario es owner o empleado activo (can_access_business).';
COMMENT ON POLICY orders_delete_policy ON public.orders
IS 'Permite eliminar órdenes en negocios donde el usuario es owner o empleado activo (can_access_business).';
