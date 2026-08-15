-- =====================================================
-- COMENTARIOS POR PEDIDO (orders.notes)
-- Fecha: 2026-08-13
-- Objetivo: permitir que el empleado agregue un
-- comentario al pedido de una mesa y que el rol cocina
-- lo vea debajo de los productos.
-- RLS: la política orders_update_policy ya permite
-- actualizar órdenes via can_access_business(), por lo
-- que no se requieren cambios de políticas.
-- =====================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN public.orders.notes
IS 'Comentarios del pedido de la mesa, visibles para el rol cocina debajo de los productos.';
