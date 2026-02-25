-- ============================================================
-- DIAGNOSTICO LOCAL-FIRST: CONSISTENCIA OPERATIVA
-- Fecha: 2026-02-25
-- Uso: ejecutar completo en Supabase SQL Editor
-- ============================================================

-- ------------------------------------------------------------
-- 1) Mesas inconsistentes respecto a current_order_id
-- ------------------------------------------------------------
SELECT
  t.id AS table_id,
  t.business_id,
  t.table_number,
  t.status AS table_status,
  t.current_order_id,
  o.status AS current_order_status
FROM public.tables t
LEFT JOIN public.orders o
  ON o.id = t.current_order_id
WHERE
  (t.current_order_id IS NULL AND lower(coalesce(t.status, '')) <> 'available')
  OR
  (t.current_order_id IS NOT NULL AND lower(coalesce(t.status, '')) <> 'occupied')
  OR
  (t.current_order_id IS NOT NULL AND (o.id IS NULL OR lower(coalesce(o.status, '')) <> 'open'))
ORDER BY t.business_id, t.table_number;

-- ------------------------------------------------------------
-- 2) Mesas con mas de una orden abierta (debe ser 0 filas)
-- ------------------------------------------------------------
SELECT
  o.business_id,
  o.table_id,
  COUNT(*) AS open_orders,
  ARRAY_AGG(o.id ORDER BY o.created_at DESC) AS order_ids
FROM public.orders o
WHERE o.table_id IS NOT NULL
  AND lower(coalesce(o.status, '')) = 'open'
GROUP BY o.business_id, o.table_id
HAVING COUNT(*) > 1
ORDER BY open_orders DESC;

-- ------------------------------------------------------------
-- 3) Ordenes abiertas sin mesa o mesa no enlazada correctamente
-- ------------------------------------------------------------
SELECT
  o.id AS order_id,
  o.business_id,
  o.table_id,
  o.status,
  t.current_order_id AS table_current_order_id
FROM public.orders o
LEFT JOIN public.tables t
  ON t.id = o.table_id
WHERE lower(coalesce(o.status, '')) = 'open'
  AND (
    o.table_id IS NULL
    OR t.id IS NULL
    OR t.business_id <> o.business_id
    OR t.current_order_id IS DISTINCT FROM o.id
  )
ORDER BY o.business_id, o.created_at DESC;

-- ------------------------------------------------------------
-- 4) Ventas con total distinto a la suma de detalles
-- ------------------------------------------------------------
WITH detail_totals AS (
  SELECT
    sd.sale_id,
    COALESCE(SUM(COALESCE(sd.subtotal, 0)), 0) AS details_total
  FROM public.sale_details sd
  GROUP BY sd.sale_id
)
SELECT
  s.id AS sale_id,
  s.business_id,
  COALESCE(s.total, 0) AS sale_total,
  COALESCE(dt.details_total, 0) AS details_total,
  (COALESCE(s.total, 0) - COALESCE(dt.details_total, 0)) AS diff
FROM public.sales s
LEFT JOIN detail_totals dt
  ON dt.sale_id = s.id
WHERE ABS(COALESCE(s.total, 0) - COALESCE(dt.details_total, 0)) > 0.01
ORDER BY ABS(COALESCE(s.total, 0) - COALESCE(dt.details_total, 0)) DESC, s.created_at DESC;

-- ------------------------------------------------------------
-- 5) Productos con stock negativo (manage_stock=true)
-- ------------------------------------------------------------
SELECT
  p.id AS product_id,
  p.business_id,
  p.name,
  p.stock,
  p.manage_stock
FROM public.products p
WHERE COALESCE(p.manage_stock, true) = true
  AND COALESCE(p.stock, 0) < 0
ORDER BY p.stock ASC;

-- ------------------------------------------------------------
-- 6) Resumen ejecutivo por negocio
-- ------------------------------------------------------------
WITH tables_inconsistent AS (
  SELECT t.business_id, COUNT(*) AS count_inconsistent_tables
  FROM public.tables t
  LEFT JOIN public.orders o ON o.id = t.current_order_id
  WHERE
    (t.current_order_id IS NULL AND lower(coalesce(t.status, '')) <> 'available')
    OR
    (t.current_order_id IS NOT NULL AND lower(coalesce(t.status, '')) <> 'occupied')
    OR
    (t.current_order_id IS NOT NULL AND (o.id IS NULL OR lower(coalesce(o.status, '')) <> 'open'))
  GROUP BY t.business_id
),
open_orders_duplicated AS (
  SELECT o.business_id, COUNT(*) AS count_tables_with_multi_open_orders
  FROM (
    SELECT business_id, table_id
    FROM public.orders
    WHERE table_id IS NOT NULL AND lower(coalesce(status, '')) = 'open'
    GROUP BY business_id, table_id
    HAVING COUNT(*) > 1
  ) o
  GROUP BY o.business_id
),
sales_mismatch AS (
  SELECT s.business_id, COUNT(*) AS count_sales_total_mismatch
  FROM public.sales s
  LEFT JOIN (
    SELECT sale_id, COALESCE(SUM(COALESCE(subtotal, 0)), 0) AS details_total
    FROM public.sale_details
    GROUP BY sale_id
  ) dt ON dt.sale_id = s.id
  WHERE ABS(COALESCE(s.total, 0) - COALESCE(dt.details_total, 0)) > 0.01
  GROUP BY s.business_id
),
negative_stock AS (
  SELECT p.business_id, COUNT(*) AS count_negative_stock_products
  FROM public.products p
  WHERE COALESCE(p.manage_stock, true) = true
    AND COALESCE(p.stock, 0) < 0
  GROUP BY p.business_id
)
SELECT
  b.id AS business_id,
  b.name AS business_name,
  COALESCE(ti.count_inconsistent_tables, 0) AS inconsistent_tables,
  COALESCE(od.count_tables_with_multi_open_orders, 0) AS tables_with_multi_open_orders,
  COALESCE(sm.count_sales_total_mismatch, 0) AS sales_total_mismatch,
  COALESCE(ns.count_negative_stock_products, 0) AS negative_stock_products
FROM public.businesses b
LEFT JOIN tables_inconsistent ti ON ti.business_id = b.id
LEFT JOIN open_orders_duplicated od ON od.business_id = b.id
LEFT JOIN sales_mismatch sm ON sm.business_id = b.id
LEFT JOIN negative_stock ns ON ns.business_id = b.id
ORDER BY
  inconsistent_tables DESC,
  tables_with_multi_open_orders DESC,
  sales_total_mismatch DESC,
  negative_stock_products DESC,
  b.name ASC;
