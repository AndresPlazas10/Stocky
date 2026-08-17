-- ============================================================
-- HARDENING SEGURIDAD FASE 1 - Split de policies CRUD por rol
-- Fecha: 2026-08-17
-- Objetivo: reemplazar las policies FOR ALL (membresía) por policies
-- separadas por operación que respetan el rol del empleado:
--   * SELECT: cualquier empleado activo del negocio (can_access_business)
--   * INSERT/UPDATE/DELETE de datos administrativos: solo owner/admin (can_write_business)
--   * Flujo operativo de mesas/órdenes: empleado activo que no sea cocina (can_operate_business)
--   * Borrado de ventas/compras: solo owner/admin (evita fraude de cajeros)
-- ============================================================

BEGIN;

-- ============================================================
-- 1) PRODUCTS (datos administrativos: writes solo owner/admin)
-- ============================================================
DROP POLICY IF EXISTS products_access_policy ON public.products;
DROP POLICY IF EXISTS products_select_policy ON public.products;
DROP POLICY IF EXISTS products_insert_policy ON public.products;
DROP POLICY IF EXISTS products_update_policy ON public.products;
DROP POLICY IF EXISTS products_delete_policy ON public.products;

CREATE POLICY products_select_policy ON public.products
  FOR SELECT TO authenticated
  USING (can_access_business(business_id));

CREATE POLICY products_insert_policy ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (can_write_business(business_id));

CREATE POLICY products_update_policy ON public.products
  FOR UPDATE TO authenticated
  USING (can_access_business(business_id))
  WITH CHECK (can_write_business(business_id));

CREATE POLICY products_delete_policy ON public.products
  FOR DELETE TO authenticated
  USING (can_write_business(business_id));

-- ============================================================
-- 2) SUPPLIERS (writes solo owner/admin)
-- ============================================================
DROP POLICY IF EXISTS suppliers_access_policy ON public.suppliers;
DROP POLICY IF EXISTS suppliers_select_policy ON public.suppliers;
DROP POLICY IF EXISTS suppliers_insert_policy ON public.suppliers;
DROP POLICY IF EXISTS suppliers_update_policy ON public.suppliers;
DROP POLICY IF EXISTS suppliers_delete_policy ON public.suppliers;

CREATE POLICY suppliers_select_policy ON public.suppliers
  FOR SELECT TO authenticated
  USING (can_access_business(business_id));

CREATE POLICY suppliers_insert_policy ON public.suppliers
  FOR INSERT TO authenticated
  WITH CHECK (can_write_business(business_id));

CREATE POLICY suppliers_update_policy ON public.suppliers
  FOR UPDATE TO authenticated
  USING (can_access_business(business_id))
  WITH CHECK (can_write_business(business_id));

CREATE POLICY suppliers_delete_policy ON public.suppliers
  FOR DELETE TO authenticated
  USING (can_write_business(business_id));

-- ============================================================
-- 3) COMBOS / COMBO_ITEMS (writes solo owner/admin)
-- ============================================================
DROP POLICY IF EXISTS combos_access_policy ON public.combos;
DROP POLICY IF EXISTS combos_select_policy ON public.combos;
DROP POLICY IF EXISTS combos_insert_policy ON public.combos;
DROP POLICY IF EXISTS combos_update_policy ON public.combos;
DROP POLICY IF EXISTS combos_delete_policy ON public.combos;

CREATE POLICY combos_select_policy ON public.combos
  FOR SELECT TO authenticated
  USING (can_access_business(business_id));

CREATE POLICY combos_insert_policy ON public.combos
  FOR INSERT TO authenticated
  WITH CHECK (can_write_business(business_id));

CREATE POLICY combos_update_policy ON public.combos
  FOR UPDATE TO authenticated
  USING (can_access_business(business_id))
  WITH CHECK (can_write_business(business_id));

CREATE POLICY combos_delete_policy ON public.combos
  FOR DELETE TO authenticated
  USING (can_write_business(business_id));

DROP POLICY IF EXISTS combo_items_access_policy ON public.combo_items;
DROP POLICY IF EXISTS combo_items_select_policy ON public.combo_items;
DROP POLICY IF EXISTS combo_items_insert_policy ON public.combo_items;
DROP POLICY IF EXISTS combo_items_update_policy ON public.combo_items;
DROP POLICY IF EXISTS combo_items_delete_policy ON public.combo_items;

CREATE POLICY combo_items_select_policy ON public.combo_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.combos c
    WHERE c.id = combo_items.combo_id AND can_access_business(c.business_id)
  ));

CREATE POLICY combo_items_insert_policy ON public.combo_items
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.combos c
    WHERE c.id = combo_items.combo_id AND can_write_business(c.business_id)
  ));

CREATE POLICY combo_items_update_policy ON public.combo_items
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.combos c
    WHERE c.id = combo_items.combo_id AND can_access_business(c.business_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.combos c
    WHERE c.id = combo_items.combo_id AND can_write_business(c.business_id)
  ));

CREATE POLICY combo_items_delete_policy ON public.combo_items
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.combos c
    WHERE c.id = combo_items.combo_id AND can_write_business(c.business_id)
  ));

-- ============================================================
-- 4) INVOICES (writes solo owner/admin)
-- ============================================================
DROP POLICY IF EXISTS invoices_access_policy ON public.invoices;
DROP POLICY IF EXISTS invoices_select_policy ON public.invoices;
DROP POLICY IF EXISTS invoices_insert_policy ON public.invoices;
DROP POLICY IF EXISTS invoices_update_policy ON public.invoices;
DROP POLICY IF EXISTS invoices_delete_policy ON public.invoices;

CREATE POLICY invoices_select_policy ON public.invoices
  FOR SELECT TO authenticated
  USING (can_access_business(business_id));

CREATE POLICY invoices_insert_policy ON public.invoices
  FOR INSERT TO authenticated
  WITH CHECK (can_write_business(business_id));

CREATE POLICY invoices_update_policy ON public.invoices
  FOR UPDATE TO authenticated
  USING (can_access_business(business_id))
  WITH CHECK (can_write_business(business_id));

CREATE POLICY invoices_delete_policy ON public.invoices
  FOR DELETE TO authenticated
  USING (can_write_business(business_id));

-- ============================================================
-- 5) SALES / SALE_DETAILS (borrado solo owner/admin; el resto operativo)
--    La creación de ventas va por RPC create_sale_complete (SECURITY DEFINER).
--    Se mantiene INSERT/UPDATE con membresía para el flujo operativo
--    (metadata de efectivo del cierre de mesa) y se cierra el DELETE.
-- ============================================================
DROP POLICY IF EXISTS sales_access_policy ON public.sales;
DROP POLICY IF EXISTS sales_select_policy ON public.sales;
DROP POLICY IF EXISTS sales_insert_policy ON public.sales;
DROP POLICY IF EXISTS sales_update_policy ON public.sales;
DROP POLICY IF EXISTS sales_delete_policy ON public.sales;

CREATE POLICY sales_select_policy ON public.sales
  FOR SELECT TO authenticated
  USING (can_access_business(business_id));

CREATE POLICY sales_insert_policy ON public.sales
  FOR INSERT TO authenticated
  WITH CHECK (can_operate_business(business_id));

CREATE POLICY sales_update_policy ON public.sales
  FOR UPDATE TO authenticated
  USING (can_access_business(business_id))
  WITH CHECK (can_operate_business(business_id));

CREATE POLICY sales_delete_policy ON public.sales
  FOR DELETE TO authenticated
  USING (can_write_business(business_id));

DROP POLICY IF EXISTS sale_details_realtime_access_policy ON public.sale_details;
DROP POLICY IF EXISTS sale_details_access_policy ON public.sale_details;
DROP POLICY IF EXISTS sale_details_select_policy ON public.sale_details;
DROP POLICY IF EXISTS sale_details_insert_policy ON public.sale_details;
DROP POLICY IF EXISTS sale_details_update_policy ON public.sale_details;
DROP POLICY IF EXISTS sale_details_delete_policy ON public.sale_details;

CREATE POLICY sale_details_select_policy ON public.sale_details
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.sales s
    WHERE s.id = sale_details.sale_id AND can_access_business(s.business_id)
  ));

CREATE POLICY sale_details_insert_policy ON public.sale_details
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.sales s
    WHERE s.id = sale_details.sale_id AND can_operate_business(s.business_id)
  ));

CREATE POLICY sale_details_update_policy ON public.sale_details
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.sales s
    WHERE s.id = sale_details.sale_id AND can_access_business(s.business_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.sales s
    WHERE s.id = sale_details.sale_id AND can_operate_business(s.business_id)
  ));

CREATE POLICY sale_details_delete_policy ON public.sale_details
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.sales s
    WHERE s.id = sale_details.sale_id AND can_write_business(s.business_id)
  ));

-- ============================================================
-- 6) PURCHASES / PURCHASE_DETAILS (borrado solo owner/admin)
--    La creación de compras va por RPC create_purchase_complete.
-- ============================================================
DROP POLICY IF EXISTS purchases_access_policy ON public.purchases;
DROP POLICY IF EXISTS purchases_select_policy ON public.purchases;
DROP POLICY IF EXISTS purchases_insert_policy ON public.purchases;
DROP POLICY IF EXISTS purchases_update_policy ON public.purchases;
DROP POLICY IF EXISTS purchases_delete_policy ON public.purchases;

CREATE POLICY purchases_select_policy ON public.purchases
  FOR SELECT TO authenticated
  USING (can_access_business(business_id));

CREATE POLICY purchases_insert_policy ON public.purchases
  FOR INSERT TO authenticated
  WITH CHECK (can_write_business(business_id));

CREATE POLICY purchases_update_policy ON public.purchases
  FOR UPDATE TO authenticated
  USING (can_access_business(business_id))
  WITH CHECK (can_write_business(business_id));

CREATE POLICY purchases_delete_policy ON public.purchases
  FOR DELETE TO authenticated
  USING (can_write_business(business_id));

DROP POLICY IF EXISTS purchase_details_access_policy ON public.purchase_details;
DROP POLICY IF EXISTS purchase_details_select_policy ON public.purchase_details;
DROP POLICY IF EXISTS purchase_details_insert_policy ON public.purchase_details;
DROP POLICY IF EXISTS purchase_details_update_policy ON public.purchase_details;
DROP POLICY IF EXISTS purchase_details_delete_policy ON public.purchase_details;

CREATE POLICY purchase_details_select_policy ON public.purchase_details
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.purchases p
    WHERE p.id = purchase_details.purchase_id AND can_access_business(p.business_id)
  ));

CREATE POLICY purchase_details_insert_policy ON public.purchase_details
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.purchases p
    WHERE p.id = purchase_details.purchase_id AND can_write_business(p.business_id)
  ));

CREATE POLICY purchase_details_update_policy ON public.purchase_details
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.purchases p
    WHERE p.id = purchase_details.purchase_id AND can_access_business(p.business_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.purchases p
    WHERE p.id = purchase_details.purchase_id AND can_write_business(p.business_id)
  ));

CREATE POLICY purchase_details_delete_policy ON public.purchase_details
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.purchases p
    WHERE p.id = purchase_details.purchase_id AND can_write_business(p.business_id)
  ));

-- ============================================================
-- 7) BUSINESSES (UPDATE solo owner; INSERT con created_by propio)
-- ============================================================
DROP POLICY IF EXISTS businesses_update_policy ON public.businesses;
DROP POLICY IF EXISTS businesses_insert_policy ON public.businesses;

CREATE POLICY businesses_insert_policy ON public.businesses
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY businesses_update_policy ON public.businesses
  FOR UPDATE TO authenticated
  USING (can_write_business(id))
  WITH CHECK (can_write_business(id));

-- ============================================================
-- 8) ORDERS / ORDER_ITEMS / TABLES (flujo operativo de mesas)
--    Meseros/cajeros deben poder operar el flujo (can_operate_business).
--    Cocina queda SOLO lectura (can_access_business).
-- ============================================================
DROP POLICY IF EXISTS orders_select_policy ON public.orders;
DROP POLICY IF EXISTS orders_insert_policy ON public.orders;
DROP POLICY IF EXISTS orders_update_policy ON public.orders;
DROP POLICY IF EXISTS orders_delete_policy ON public.orders;
DROP POLICY IF EXISTS orders_all ON public.orders;

CREATE POLICY orders_select_policy ON public.orders
  FOR SELECT TO authenticated
  USING (can_access_business(business_id));

CREATE POLICY orders_insert_policy ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (can_operate_business(business_id));

CREATE POLICY orders_update_policy ON public.orders
  FOR UPDATE TO authenticated
  USING (can_access_business(business_id))
  WITH CHECK (can_operate_business(business_id));

CREATE POLICY orders_delete_policy ON public.orders
  FOR DELETE TO authenticated
  USING (can_operate_business(business_id));

DROP POLICY IF EXISTS order_items_realtime_access_policy ON public.order_items;
DROP POLICY IF EXISTS order_items_access_policy ON public.order_items;
DROP POLICY IF EXISTS order_items_select_policy ON public.order_items;
DROP POLICY IF EXISTS order_items_insert_policy ON public.order_items;
DROP POLICY IF EXISTS order_items_update_policy ON public.order_items;
DROP POLICY IF EXISTS order_items_delete_policy ON public.order_items;

CREATE POLICY order_items_select_policy ON public.order_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id AND can_access_business(o.business_id)
  ));

CREATE POLICY order_items_insert_policy ON public.order_items
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id AND can_operate_business(o.business_id)
  ));

CREATE POLICY order_items_update_policy ON public.order_items
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id AND can_access_business(o.business_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id AND can_operate_business(o.business_id)
  ));

CREATE POLICY order_items_delete_policy ON public.order_items
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id AND can_operate_business(o.business_id)
  ));

DROP POLICY IF EXISTS tables_all ON public.tables;
DROP POLICY IF EXISTS tables_select_policy ON public.tables;
DROP POLICY IF EXISTS tables_insert_policy ON public.tables;
DROP POLICY IF EXISTS tables_update_policy ON public.tables;
DROP POLICY IF EXISTS tables_delete_policy ON public.tables;

CREATE POLICY tables_select_policy ON public.tables
  FOR SELECT TO authenticated
  USING (can_access_business(business_id));

CREATE POLICY tables_insert_policy ON public.tables
  FOR INSERT TO authenticated
  WITH CHECK (can_operate_business(business_id));

CREATE POLICY tables_update_policy ON public.tables
  FOR UPDATE TO authenticated
  USING (can_access_business(business_id))
  WITH CHECK (can_operate_business(business_id));

CREATE POLICY tables_delete_policy ON public.tables
  FOR DELETE TO authenticated
  USING (can_write_business(business_id));

COMMIT;
