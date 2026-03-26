BEGIN;

-- Contexto empleado: accelera resolución por user activo (is_active true o null).
CREATE INDEX IF NOT EXISTS idx_employees_user_active_or_null_created_at_desc
  ON public.employees (user_id, created_at DESC)
  INCLUDE (business_id)
  WHERE COALESCE(is_active, true) = true;

COMMENT ON INDEX public.idx_employees_user_active_or_null_created_at_desc IS
  'Optimiza resolve_mobile_business_context para empleados activos';

-- Compras: evita sort adicional al ordenar por created_at DESC + id DESC.
CREATE INDEX IF NOT EXISTS idx_purchases_business_created_at_id_desc_cover
  ON public.purchases (business_id, created_at DESC, id DESC)
  INCLUDE (user_id, supplier_id, payment_method, total);

COMMENT ON INDEX public.idx_purchases_business_created_at_id_desc_cover IS
  'Optimiza listado reciente de compras para mobile/web';

-- Inventario: alinea con ORDER BY created_at DESC, id DESC del RPC rápido.
CREATE INDEX IF NOT EXISTS idx_products_business_created_at_id_desc_cover
  ON public.products (business_id, created_at DESC, id DESC)
  INCLUDE (code, name, category, purchase_price, sale_price, stock, min_stock, unit, supplier_id, is_active, manage_stock);

COMMENT ON INDEX public.idx_products_business_created_at_id_desc_cover IS
  'Optimiza listado reciente de productos para mobile/web';

ANALYZE public.employees;
ANALYZE public.purchases;
ANALYZE public.products;

COMMIT;
