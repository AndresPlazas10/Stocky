-- ============================================================
-- BLOCK 3 - Refuerzo con índices únicos parciales (safe mode)
-- Fecha: 2026-02-13
-- Objetivo: endurecer invariantes sin romper despliegue si hay datos sucios.
-- ============================================================

DO $$
DECLARE
  v_dup_open_orders integer;
  v_dup_current_order integer;
BEGIN
  -- Duplicados: más de una orden abierta para misma mesa
  SELECT COUNT(*) INTO v_dup_open_orders
  FROM (
    SELECT o.table_id
    FROM public.orders o
    WHERE o.table_id IS NOT NULL
      AND lower(coalesce(o.status, '')) = 'open'
    GROUP BY o.table_id
    HAVING COUNT(*) > 1
  ) d;

  IF v_dup_open_orders = 0 THEN
    EXECUTE '
      CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_one_open_per_table
      ON public.orders(table_id)
      WHERE table_id IS NOT NULL
        AND lower(coalesce(status, '''')) = ''open''
    ';
  ELSE
    RAISE NOTICE 'Se omite uq_orders_one_open_per_table: existen % mesas con órdenes abiertas duplicadas', v_dup_open_orders;
  END IF;

  -- Duplicados: más de una mesa apuntando al mismo current_order_id
  SELECT COUNT(*) INTO v_dup_current_order
  FROM (
    SELECT t.current_order_id
    FROM public.tables t
    WHERE t.current_order_id IS NOT NULL
    GROUP BY t.current_order_id
    HAVING COUNT(*) > 1
  ) d;

  IF v_dup_current_order = 0 THEN
    EXECUTE '
      CREATE UNIQUE INDEX IF NOT EXISTS uq_tables_current_order_unique
      ON public.tables(current_order_id)
      WHERE current_order_id IS NOT NULL
    ';
  ELSE
    RAISE NOTICE 'Se omite uq_tables_current_order_unique: existen % current_order_id duplicados', v_dup_current_order;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass('public.uq_orders_one_open_per_table') IS NOT NULL THEN
    COMMENT ON INDEX public.uq_orders_one_open_per_table
    IS 'Garantiza una sola orden abierta por mesa (si no hay datos duplicados al crear).';
  END IF;

  IF to_regclass('public.uq_tables_current_order_unique') IS NOT NULL THEN
    COMMENT ON INDEX public.uq_tables_current_order_unique
    IS 'Garantiza que una orden no quede asignada a más de una mesa (si no hay datos duplicados al crear).';
  END IF;
END
$$;
