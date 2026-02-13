-- ============================================================
-- VALIDACIÓN CONCURRENCIA: CIERRE DE ORDEN/MESA
-- Fecha: 2026-02-13
-- Ejecutar después de cargar tráfico real o pruebas simultáneas.
-- ============================================================

-- 1) Mesas con order cerrada aún referenciada
SELECT t.id AS table_id,
       t.business_id,
       t.current_order_id,
       o.status AS order_status
FROM public.tables t
JOIN public.orders o ON o.id = t.current_order_id
WHERE lower(coalesce(o.status, '')) <> 'open';

-- Esperado: 0 filas

-- 2) Órdenes cerradas sin closed_at
SELECT o.id AS order_id,
       o.business_id,
       o.status,
       o.closed_at
FROM public.orders o
WHERE lower(coalesce(o.status, '')) = 'closed'
  AND o.closed_at IS NULL;

-- Esperado: 0 filas

-- 3) Mesas disponibles con current_order_id no nulo
SELECT t.id AS table_id,
       t.business_id,
       t.status,
       t.current_order_id
FROM public.tables t
WHERE lower(coalesce(t.status, '')) = 'available'
  AND t.current_order_id IS NOT NULL;

-- Esperado: 0 filas

-- 4) Posibles dobles cierres recientes (heurístico)
-- Detecta múltiples ventas muy cercanas para una misma mesa/orden cerrada.
-- Si no guardas table_id/order_id en sales, usar aproximación por usuario+negocio+tiempo.
WITH recent_sales AS (
  SELECT s.id,
         s.business_id,
         s.user_id,
         s.total,
         s.created_at,
         lag(s.created_at) OVER (PARTITION BY s.business_id, s.user_id ORDER BY s.created_at) AS prev_created_at,
         lag(s.total) OVER (PARTITION BY s.business_id, s.user_id ORDER BY s.created_at) AS prev_total
  FROM public.sales s
  WHERE s.created_at >= now() - interval '24 hours'
)
SELECT *
FROM recent_sales
WHERE prev_created_at IS NOT NULL
  AND (created_at - prev_created_at) <= interval '2 seconds'
  AND total = prev_total
ORDER BY created_at DESC;

-- Esperado: revisar manualmente. Debe tender a 0 en operaciones de cierre.

-- 5) Inventario negativo (síntoma de cierres concurrentes no controlados)
SELECT p.id,
       p.business_id,
       p.name,
       p.stock
FROM public.products p
WHERE p.stock < 0
ORDER BY p.stock ASC;

-- Esperado: 0 filas

-- 6) Triggers de invariantes activos
SELECT event_object_table AS table_name,
       trigger_name,
       action_timing,
       event_manipulation AS event
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name IN (
    'trg_enforce_order_open_invariants',
    'trg_enforce_table_current_order_invariants',
    'trg_normalize_table_status_before_write'
  )
ORDER BY trigger_name, event;

-- Esperado: filas para orders y tables.

-- 7) Índices únicos de invariantes (si no hay históricos duplicados)
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'uq_orders_one_open_per_table',
    'uq_tables_current_order_unique'
  )
ORDER BY indexname;

-- Esperado: idealmente 2 filas. Si no, revisar NOTICE de migración 0910.

-- 8) Detectar estados legacy en mesas (open/closed)
SELECT status, COUNT(*) AS total
FROM public.tables
GROUP BY status
ORDER BY total DESC;

-- Esperado: usar preferentemente occupied/available.
-- Si aparecen open/closed, normalizar gradualmente.
-- ============================================================
