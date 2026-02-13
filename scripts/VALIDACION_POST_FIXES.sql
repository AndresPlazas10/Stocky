-- ============================================================
-- VALIDACION POST-FIXES (SOLO DIAGNOSTICO / SOLO SELECT)
-- Auditoria estricta de consistencia para entorno POS multiusuario
-- ============================================================
-- Instrucciones:
-- 1) Reemplaza business_id y go_live_at
-- 2) Ejecuta bloque por bloque en Supabase SQL Editor
-- 3) Cualquier fila devuelta en checks de "anomalia" requiere revision

-- ------------------------------------------------------------
-- PARAMETROS
-- ------------------------------------------------------------
WITH params AS (
  SELECT
    '00000000-0000-0000-0000-000000000000'::uuid AS business_id,
    '2026-02-13T00:00:00Z'::timestamptz AS go_live_at
)
SELECT 'PARAMS_OK' AS status, * FROM params;

-- ------------------------------------------------------------
-- 1) SELLER ROLE MISMATCH (owner/admin guardado como no-Administrador)
-- ------------------------------------------------------------
WITH params AS (
  SELECT
    '00000000-0000-0000-0000-000000000000'::uuid AS business_id,
    '2026-02-13T00:00:00Z'::timestamptz AS go_live_at
)
SELECT
  s.id AS sale_id,
  s.created_at,
  s.user_id,
  s.seller_name,
  e.role AS employee_role,
  b.created_by AS business_owner
FROM sales s
JOIN businesses b
  ON b.id = s.business_id
LEFT JOIN employees e
  ON e.business_id = s.business_id
 AND e.user_id = s.user_id
JOIN params p
  ON p.business_id = s.business_id
WHERE s.created_at >= p.go_live_at
  AND (
    s.user_id = b.created_by
    OR lower(trim(coalesce(e.role, ''))) IN ('owner','admin','administrador','propietario')
    OR position('admin' in lower(trim(coalesce(e.role, '')))) > 0
  )
  AND coalesce(trim(s.seller_name), '') <> 'Administrador'
ORDER BY s.created_at DESC
LIMIT 200;

-- ------------------------------------------------------------
-- 2) SELLER BLANK/GENERIC EN VENTAS NUEVAS
-- ------------------------------------------------------------
WITH params AS (
  SELECT
    '00000000-0000-0000-0000-000000000000'::uuid AS business_id,
    '2026-02-13T00:00:00Z'::timestamptz AS go_live_at
)
SELECT
  s.id AS sale_id,
  s.created_at,
  s.user_id,
  s.seller_name
FROM sales s
JOIN params p
  ON p.business_id = s.business_id
WHERE s.created_at >= p.go_live_at
  AND lower(trim(coalesce(s.seller_name, ''))) IN ('', 'empleado', 'vendedor', 'vendedor desconocido', 'usuario')
ORDER BY s.created_at DESC
LIMIT 200;

-- ------------------------------------------------------------
-- 3) VENTAS CON TOTAL INCONSISTENTE VS DETALLES
-- ------------------------------------------------------------
WITH params AS (
  SELECT
    '00000000-0000-0000-0000-000000000000'::uuid AS business_id,
    '2026-02-13T00:00:00Z'::timestamptz AS go_live_at
),
sale_sum AS (
  SELECT
    s.id AS sale_id,
    s.total AS sale_total,
    coalesce(sum((sd.quantity::numeric) * (sd.unit_price::numeric)), 0) AS details_total
  FROM sales s
  LEFT JOIN sale_details sd
    ON sd.sale_id = s.id
  JOIN params p
    ON p.business_id = s.business_id
  WHERE s.created_at >= p.go_live_at
  GROUP BY s.id, s.total
)
SELECT
  sale_id,
  sale_total,
  details_total,
  (sale_total - details_total) AS diff
FROM sale_sum
WHERE abs(coalesce(sale_total, 0) - coalesce(details_total, 0)) > 0.01
ORDER BY abs(sale_total - details_total) DESC
LIMIT 200;

-- ------------------------------------------------------------
-- 4) COMPRAS CON TOTAL INCONSISTENTE VS DETALLES
-- ------------------------------------------------------------
WITH params AS (
  SELECT
    '00000000-0000-0000-0000-000000000000'::uuid AS business_id,
    '2026-02-13T00:00:00Z'::timestamptz AS go_live_at
),
purchase_sum AS (
  SELECT
    p.id AS purchase_id,
    p.total AS purchase_total,
    coalesce(sum(coalesce(pd.subtotal, (pd.quantity::numeric) * (pd.unit_cost::numeric))), 0) AS details_total
  FROM purchases p
  LEFT JOIN purchase_details pd
    ON pd.purchase_id = p.id
  JOIN params x
    ON x.business_id = p.business_id
  WHERE p.created_at >= x.go_live_at
  GROUP BY p.id, p.total
)
SELECT
  purchase_id,
  purchase_total,
  details_total,
  (purchase_total - details_total) AS diff
FROM purchase_sum
WHERE abs(coalesce(purchase_total, 0) - coalesce(details_total, 0)) > 0.01
ORDER BY abs(purchase_total - details_total) DESC
LIMIT 200;

-- ------------------------------------------------------------
-- 5) COSTO DE PRODUCTO DESALINEADO VS ULTIMA COMPRA
-- ------------------------------------------------------------
WITH params AS (
  SELECT
    '00000000-0000-0000-0000-000000000000'::uuid AS business_id,
    '2026-02-13T00:00:00Z'::timestamptz AS go_live_at
)
SELECT
  pr.id AS product_id,
  pr.name,
  pr.purchase_price,
  lp.unit_cost AS last_unit_cost,
  (pr.purchase_price - lp.unit_cost) AS diff,
  lp.purchase_id,
  lp.created_at AS last_purchase_at
FROM products pr
JOIN params p
  ON p.business_id = pr.business_id
JOIN LATERAL (
  SELECT
    pd.unit_cost,
    pu.id AS purchase_id,
    pu.created_at
  FROM purchases pu
  JOIN purchase_details pd
    ON pd.purchase_id = pu.id
  WHERE pu.business_id = pr.business_id
    AND pd.product_id = pr.id
    AND pu.created_at >= p.go_live_at
  ORDER BY pu.created_at DESC, pu.id DESC
  LIMIT 1
) lp ON true
WHERE abs(coalesce(pr.purchase_price, 0) - coalesce(lp.unit_cost, 0)) > 0.01
ORDER BY abs(pr.purchase_price - lp.unit_cost) DESC, pr.name
LIMIT 200;

-- ------------------------------------------------------------
-- 6) DUPLICIDAD DE ORDEN ABIERTA POR MESA
-- Esperado: maximo 1 orden open por table_id
-- ------------------------------------------------------------
WITH params AS (
  SELECT
    '00000000-0000-0000-0000-000000000000'::uuid AS business_id
)
SELECT
  o.table_id,
  count(*) AS open_orders,
  min(o.opened_at) AS first_opened_at,
  max(o.opened_at) AS last_opened_at
FROM orders o
JOIN params p
  ON p.business_id = o.business_id
WHERE o.status = 'open'
GROUP BY o.table_id
HAVING count(*) > 1
ORDER BY open_orders DESC, last_opened_at DESC;

-- ------------------------------------------------------------
-- 7) MESA APUNTANDO A ORDEN NO ABIERTA O DE OTRO NEGOCIO
-- ------------------------------------------------------------
WITH params AS (
  SELECT
    '00000000-0000-0000-0000-000000000000'::uuid AS business_id
)
SELECT
  t.id AS table_id,
  t.table_number,
  t.current_order_id,
  o.status AS order_status,
  t.business_id AS table_business_id,
  o.business_id AS order_business_id
FROM tables t
LEFT JOIN orders o
  ON o.id = t.current_order_id
JOIN params p
  ON p.business_id = t.business_id
WHERE t.current_order_id IS NOT NULL
  AND (
    o.id IS NULL
    OR o.status <> 'open'
    OR o.business_id <> t.business_id
  )
ORDER BY t.table_number;

-- ------------------------------------------------------------
-- 8) ORDEN ABIERTA NO REFERENCIADA POR NINGUNA MESA (posible huérfana)
-- ------------------------------------------------------------
WITH params AS (
  SELECT
    '00000000-0000-0000-0000-000000000000'::uuid AS business_id
)
SELECT
  o.id AS order_id,
  o.table_id,
  o.status,
  o.opened_at,
  o.total
FROM orders o
JOIN params p
  ON p.business_id = o.business_id
WHERE o.status = 'open'
  AND NOT EXISTS (
    SELECT 1
    FROM tables t
    WHERE t.business_id = o.business_id
      AND t.current_order_id = o.id
  )
ORDER BY o.opened_at DESC
LIMIT 200;

-- ------------------------------------------------------------
-- 9) MULTIPLES MESAS APUNTANDO AL MISMO current_order_id
-- ------------------------------------------------------------
WITH params AS (
  SELECT
    '00000000-0000-0000-0000-000000000000'::uuid AS business_id
)
SELECT
  t.current_order_id,
  count(*) AS table_count,
  string_agg(t.table_number::text, ', ' ORDER BY t.table_number) AS table_numbers
FROM tables t
JOIN params p
  ON p.business_id = t.business_id
WHERE t.current_order_id IS NOT NULL
GROUP BY t.current_order_id
HAVING count(*) > 1
ORDER BY table_count DESC;

-- ------------------------------------------------------------
-- 10) STOCK NEGATIVO
-- ------------------------------------------------------------
WITH params AS (
  SELECT
    '00000000-0000-0000-0000-000000000000'::uuid AS business_id
)
SELECT
  id AS product_id,
  code,
  name,
  stock,
  min_stock,
  is_active
FROM products pr
JOIN params p
  ON p.business_id = pr.business_id
WHERE coalesce(pr.stock, 0) < 0
ORDER BY stock ASC, name
LIMIT 200;

-- ------------------------------------------------------------
-- 11) HUERFANOS DE DETALLES (sale_details / purchase_details / order_items)
-- ------------------------------------------------------------
WITH params AS (
  SELECT
    '00000000-0000-0000-0000-000000000000'::uuid AS business_id
)
SELECT
  'sale_details_without_sale' AS anomaly_type,
  count(*) AS records
FROM sale_details sd
LEFT JOIN sales s
  ON s.id = sd.sale_id
WHERE s.id IS NULL

UNION ALL

SELECT
  'purchase_details_without_purchase' AS anomaly_type,
  count(*) AS records
FROM purchase_details pd
LEFT JOIN purchases p2
  ON p2.id = pd.purchase_id
WHERE p2.id IS NULL

UNION ALL

SELECT
  'order_items_without_order' AS anomaly_type,
  count(*) AS records
FROM order_items oi
LEFT JOIN orders o
  ON o.id = oi.order_id
WHERE o.id IS NULL;

-- ------------------------------------------------------------
-- 12) POSIBLES VENTAS DUPLICADAS (misma firma en ventana corta)
-- Nota: indicador heurístico para detectar reintentos sin idempotencia
-- ------------------------------------------------------------
WITH params AS (
  SELECT
    '00000000-0000-0000-0000-000000000000'::uuid AS business_id,
    '2026-02-13T00:00:00Z'::timestamptz AS go_live_at
),
base AS (
  SELECT
    s.id,
    s.user_id,
    s.total,
    s.payment_method,
    s.created_at,
    lag(s.created_at) OVER (
      PARTITION BY s.user_id, s.total, s.payment_method
      ORDER BY s.created_at
    ) AS prev_created_at
  FROM sales s
  JOIN params p
    ON p.business_id = s.business_id
  WHERE s.created_at >= p.go_live_at
)
SELECT
  id AS sale_id,
  user_id,
  total,
  payment_method,
  created_at,
  prev_created_at,
  extract(epoch from (created_at - prev_created_at)) AS seconds_since_prev
FROM base
WHERE prev_created_at IS NOT NULL
  AND extract(epoch from (created_at - prev_created_at)) <= 5
ORDER BY created_at DESC
LIMIT 200;

-- ------------------------------------------------------------
-- 13) RESUMEN EJECUTIVO DE ANOMALIAS (conteos)
-- ------------------------------------------------------------
WITH params AS (
  SELECT
    '00000000-0000-0000-0000-000000000000'::uuid AS business_id,
    '2026-02-13T00:00:00Z'::timestamptz AS go_live_at
),
seller_mismatch AS (
  SELECT count(*) AS n
  FROM sales s
  JOIN businesses b
    ON b.id = s.business_id
  LEFT JOIN employees e
    ON e.business_id = s.business_id
   AND e.user_id = s.user_id
  JOIN params p
    ON p.business_id = s.business_id
  WHERE s.created_at >= p.go_live_at
    AND (
      s.user_id = b.created_by
      OR lower(trim(coalesce(e.role, ''))) IN ('owner','admin','administrador','propietario')
      OR position('admin' in lower(trim(coalesce(e.role, '')))) > 0
    )
    AND coalesce(trim(s.seller_name), '') <> 'Administrador'
),
sales_total_mismatch AS (
  SELECT count(*) AS n
  FROM (
    SELECT s.id, s.total, coalesce(sum((sd.quantity::numeric) * (sd.unit_price::numeric)), 0) AS details_total
    FROM sales s
    LEFT JOIN sale_details sd ON sd.sale_id = s.id
    JOIN params p ON p.business_id = s.business_id
    WHERE s.created_at >= p.go_live_at
    GROUP BY s.id, s.total
  ) x
  WHERE abs(coalesce(total,0) - coalesce(details_total,0)) > 0.01
),
purchase_price_mismatch AS (
  SELECT count(*) AS n
  FROM products pr
  JOIN params p ON p.business_id = pr.business_id
  JOIN LATERAL (
    SELECT pd.unit_cost
    FROM purchases pu
    JOIN purchase_details pd ON pd.purchase_id = pu.id
    WHERE pu.business_id = pr.business_id
      AND pd.product_id = pr.id
      AND pu.created_at >= p.go_live_at
    ORDER BY pu.created_at DESC, pu.id DESC
    LIMIT 1
  ) lp ON true
  WHERE abs(coalesce(pr.purchase_price,0) - coalesce(lp.unit_cost,0)) > 0.01
),
duplicate_open_orders AS (
  SELECT count(*) AS n
  FROM (
    SELECT o.table_id, count(*) AS c
    FROM orders o
    JOIN params p ON p.business_id = o.business_id
    WHERE o.status = 'open'
    GROUP BY o.table_id
    HAVING count(*) > 1
  ) t
),
negative_stock AS (
  SELECT count(*) AS n
  FROM products pr
  JOIN params p ON p.business_id = pr.business_id
  WHERE coalesce(pr.stock, 0) < 0
)
SELECT
  (SELECT n FROM seller_mismatch) AS seller_role_mismatch,
  (SELECT n FROM sales_total_mismatch) AS sales_total_mismatch,
  (SELECT n FROM purchase_price_mismatch) AS purchase_price_mismatch,
  (SELECT n FROM duplicate_open_orders) AS duplicate_open_orders_per_table,
  (SELECT n FROM negative_stock) AS negative_stock_products;

