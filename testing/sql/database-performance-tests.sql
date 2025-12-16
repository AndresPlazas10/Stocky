-- =====================================================
-- 🔬 DATABASE PERFORMANCE TEST SUITE
-- =====================================================
-- Scripts para probar performance, locks, deadlocks
-- y overhead de RLS en Supabase PostgreSQL
-- =====================================================

-- =====================================================
-- TEST 1: MONITOR DE LOCKS EN TIEMPO REAL
-- =====================================================
-- Ejecutar en terminal separada durante pruebas de carga
-- Detecta: locks bloqueantes, deadlocks, queries lentas

-- Monitor locks bloqueantes
SELECT 
  blocked_locks.pid AS blocked_pid,
  blocked_activity.usename AS blocked_user,
  blocking_locks.pid AS blocking_pid,
  blocking_activity.usename AS blocking_user,
  blocked_activity.query AS blocked_statement,
  blocking_activity.query AS blocking_statement,
  blocked_activity.application_name AS app,
  NOW() - blocked_activity.query_start AS blocked_duration
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity 
  ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks 
  ON blocking_locks.locktype = blocked_locks.locktype
  AND blocking_locks.relation = blocked_locks.relation
  AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity 
  ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted
ORDER BY blocked_duration DESC;

-- Monitor de conexiones activas
SELECT 
  count(*) AS total_connections,
  count(*) FILTER (WHERE state = 'active') AS active,
  count(*) FILTER (WHERE state = 'idle') AS idle,
  count(*) FILTER (WHERE state = 'idle in transaction') AS idle_in_transaction,
  count(*) FILTER (WHERE wait_event IS NOT NULL) AS waiting
FROM pg_stat_activity
WHERE datname = current_database();

-- =====================================================
-- TEST 2: QUERIES LENTAS
-- =====================================================
-- Habilitar logging de queries lentas

-- Configurar threshold (queries > 500ms)
ALTER DATABASE postgres SET log_min_duration_statement = 500;

-- Luego ejecutar test de carga y analizar con:
SELECT 
  calls,
  mean_exec_time::numeric(10,2) AS avg_ms,
  max_exec_time::numeric(10,2) AS max_ms,
  total_exec_time::numeric(10,2) AS total_ms,
  (total_exec_time / sum(total_exec_time) OVER ()) * 100 AS pct_total,
  query
FROM pg_stat_statements
WHERE mean_exec_time > 100 -- Queries promedio > 100ms
ORDER BY total_exec_time DESC
LIMIT 20;

-- Reset de stats (ejecutar antes de pruebas)
SELECT pg_stat_statements_reset();

-- =====================================================
-- TEST 3: OVERHEAD DE RLS
-- =====================================================
-- Comparar performance con/sin RLS

-- Paso 1: Medir CON RLS (estado actual)
EXPLAIN ANALYZE
SELECT * FROM sales 
WHERE business_id = 'BUSINESS_UUID_AQUI'
LIMIT 50;

-- Guardar resultado (ej: Planning Time: X ms, Execution Time: Y ms)

-- Paso 2: Deshabilitar RLS temporalmente
ALTER TABLE sales DISABLE ROW LEVEL SECURITY;

-- Paso 3: Medir SIN RLS
EXPLAIN ANALYZE
SELECT * FROM sales 
WHERE business_id = 'BUSINESS_UUID_AQUI'
LIMIT 50;

-- Paso 4: Re-habilitar RLS (IMPORTANTE)
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

-- Calcular overhead:
-- Overhead RLS = (Tiempo con RLS - Tiempo sin RLS) / Tiempo sin RLS * 100

-- =====================================================
-- TEST 4: IMPACTO DE ÍNDICES
-- =====================================================
-- Medir queries antes/después de crear índices

-- Test: Query de reportes por fecha (SIN índice compuesto)
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM sales
WHERE business_id = 'BUSINESS_UUID'
  AND created_at >= '2024-01-01'
  AND created_at <= '2024-12-31'
ORDER BY created_at DESC;

-- Crear índice compuesto
CREATE INDEX idx_sales_business_created_test
ON sales(business_id, created_at DESC);

-- Re-ejecutar query (CON índice)
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM sales
WHERE business_id = 'BUSINESS_UUID'
  AND created_at >= '2024-01-01'
  AND created_at <= '2024-12-31'
ORDER BY created_at DESC;

-- Limpiar (opcional)
DROP INDEX IF EXISTS idx_sales_business_created_test;

-- =====================================================
-- TEST 5: SIMULADOR DE DEADLOCKS
-- =====================================================
-- Ejecutar en 2 terminales simultáneamente

-- Terminal 1:
BEGIN;
UPDATE products SET stock = stock - 1 WHERE id = 'PRODUCT_A_UUID';
-- Esperar 3 segundos
SELECT pg_sleep(3);
UPDATE products SET stock = stock - 1 WHERE id = 'PRODUCT_B_UUID';
COMMIT;

-- Terminal 2 (ejecutar al mismo tiempo):
BEGIN;
UPDATE products SET stock = stock - 1 WHERE id = 'PRODUCT_B_UUID';
-- Esperar 3 segundos
SELECT pg_sleep(3);
UPDATE products SET stock = stock - 1 WHERE id = 'PRODUCT_A_UUID';
COMMIT;

-- Resultado esperado: DEADLOCK detectado
-- PostgreSQL cancela una de las transacciones automáticamente

-- Ver deadlocks detectados:
SELECT * FROM pg_stat_database_conflicts 
WHERE datname = current_database();

-- =====================================================
-- TEST 6: RACE CONDITION EN STOCK
-- =====================================================
-- Simular actualización concurrente de stock

-- Preparación: Crear producto de prueba
INSERT INTO products (business_id, name, code, price, stock, category)
VALUES (
  'BUSINESS_UUID',
  'Producto Test Concurrencia',
  'TEST-RACE',
  10000,
  100,
  'test'
)
RETURNING id; -- Guardar este ID

-- Test: Ejecutar 10 veces en paralelo (diferentes terminales o scripts)
-- VULNERABLE (Read-Modify-Write):
DO $$
DECLARE
  v_product_id UUID := 'PRODUCT_TEST_UUID';
  v_current_stock NUMERIC;
  v_new_stock NUMERIC;
BEGIN
  -- 1. Leer stock
  SELECT stock INTO v_current_stock
  FROM products
  WHERE id = v_product_id;
  
  -- 2. Simular procesamiento
  PERFORM pg_sleep(0.05);
  
  -- 3. Calcular nuevo stock
  v_new_stock := v_current_stock - 1;
  
  -- 4. Actualizar
  UPDATE products
  SET stock = v_new_stock
  WHERE id = v_product_id;
  
  RAISE NOTICE 'Stock actualizado: % -> %', v_current_stock, v_new_stock;
END $$;

-- Verificar resultado:
SELECT stock FROM products WHERE code = 'TEST-RACE';
-- Stock inicial: 100
-- Decrementos esperados: 10
-- Stock esperado: 90
-- Stock real: 92-98 ❌ (race condition)

-- FIX: UPDATE atómico
UPDATE products 
SET stock = stock - 1 
WHERE id = 'PRODUCT_TEST_UUID'
RETURNING stock;
-- Sin race condition ✅

-- Limpieza
DELETE FROM products WHERE code = 'TEST-RACE';

-- =====================================================
-- TEST 7: CACHE HIT RATIO
-- =====================================================
-- Medir eficiencia de cache de PostgreSQL

SELECT 
  sum(heap_blks_read) AS heap_read,
  sum(heap_blks_hit) AS heap_hit,
  ROUND(
    sum(heap_blks_hit) / NULLIF(sum(heap_blks_hit + heap_blks_read), 0) * 100,
    2
  ) AS cache_hit_ratio_pct
FROM pg_statio_user_tables;

-- Cache hit ratio ideal: > 95%
-- 90-95%: Aceptable
-- < 90%: Necesita más memoria o índices

-- =====================================================
-- TEST 8: CONSUMO DE CONEXIONES
-- =====================================================
-- Monitorear consumo durante pruebas de carga

SELECT 
  max_conn,
  used,
  res_for_super,
  max_conn - used - res_for_super AS available,
  ROUND((used::float / max_conn) * 100, 2) AS pct_used
FROM (
  SELECT 
    count(*) AS used,
    (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') AS max_conn,
    (SELECT setting::int FROM pg_settings WHERE name = 'superuser_reserved_connections') AS res_for_super
  FROM pg_stat_activity
) s;

-- Alertar si pct_used > 80%

-- =====================================================
-- TEST 9: TAMAÑO DE TABLAS Y BLOAT
-- =====================================================
-- Verificar crecimiento de tablas y fragmentación

SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS indexes_size,
  n_live_tup AS live_rows,
  n_dead_tup AS dead_rows,
  ROUND((n_dead_tup::float / NULLIF(n_live_tup + n_dead_tup, 0)) * 100, 2) AS dead_pct
FROM pg_stat_user_tables
JOIN pg_tables ON tablename = pg_tables.tablename
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Si dead_pct > 20%: Ejecutar VACUUM
VACUUM ANALYZE sales;
VACUUM ANALYZE products;

-- =====================================================
-- TEST 10: ÍNDICES NO UTILIZADOS
-- =====================================================
-- Detectar índices que no se usan (desperdicio)

SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan AS times_used,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND indexrelname NOT LIKE 'pg_toast%'
ORDER BY pg_relation_size(indexrelid) DESC;

-- Considerar eliminar índices con times_used = 0

-- =====================================================
-- TEST 11: FUNCIÓN RLS - PERFORMANCE
-- =====================================================
-- Medir cuántas veces se ejecuta get_user_business_ids()

-- Habilitar tracking
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Reset stats
SELECT pg_stat_statements_reset();

-- Ejecutar query típica
SELECT * FROM sales WHERE business_id IN (SELECT * FROM get_user_business_ids()) LIMIT 10;

-- Ver cuántas veces se ejecutó la función
SELECT 
  calls,
  mean_exec_time,
  total_exec_time,
  query
FROM pg_stat_statements
WHERE query LIKE '%get_user_business_ids%'
ORDER BY calls DESC;

-- =====================================================
-- TEST 12: TRANSACTION ROLLBACK RATE
-- =====================================================
-- Medir tasa de transacciones abortadas (errores)

SELECT 
  datname,
  xact_commit AS commits,
  xact_rollback AS rollbacks,
  ROUND((xact_rollback::float / NULLIF(xact_commit + xact_rollback, 0)) * 100, 2) AS rollback_pct,
  conflicts AS deadlocks
FROM pg_stat_database
WHERE datname = current_database();

-- Rollback rate ideal: < 5%
-- > 10%: Hay problemas de concurrencia o errores

-- =====================================================
-- TEST 13: LONG RUNNING QUERIES
-- =====================================================
-- Detectar queries que llevan mucho tiempo ejecutándose

SELECT 
  pid,
  now() - pg_stat_activity.query_start AS duration,
  state,
  query,
  wait_event,
  wait_event_type
FROM pg_stat_activity
WHERE state != 'idle'
  AND now() - pg_stat_activity.query_start > interval '5 seconds'
ORDER BY duration DESC;

-- Opcional: Cancelar query lenta
-- SELECT pg_cancel_backend(PID);

-- =====================================================
-- TEST 14: SEQUENCE EXHAUSTION
-- =====================================================
-- Verificar que sequences no están cerca del límite

SELECT 
  schemaname,
  sequencename,
  last_value,
  max_value,
  ROUND((last_value::float / max_value) * 100, 2) AS pct_used
FROM pg_sequences
WHERE schemaname = 'public'
ORDER BY pct_used DESC;

-- Alertar si pct_used > 80%

-- =====================================================
-- SCRIPT DE MONITOREO CONTINUO
-- =====================================================
-- Ejecutar cada 10 segundos durante pruebas

DO $$
DECLARE
  v_iteration INT := 0;
  v_connections INT;
  v_locks INT;
  v_cache_hit NUMERIC;
BEGIN
  LOOP
    v_iteration := v_iteration + 1;
    
    -- Contar conexiones
    SELECT count(*) INTO v_connections
    FROM pg_stat_activity
    WHERE datname = current_database();
    
    -- Contar locks bloqueantes
    SELECT count(*) INTO v_locks
    FROM pg_locks
    WHERE NOT granted;
    
    -- Cache hit ratio
    SELECT ROUND(
      sum(heap_blks_hit) / NULLIF(sum(heap_blks_hit + heap_blks_read), 0) * 100,
      2
    ) INTO v_cache_hit
    FROM pg_statio_user_tables;
    
    RAISE NOTICE '[%] Conexiones: % | Locks: % | Cache Hit: %',
      to_char(now(), 'HH24:MI:SS'),
      v_connections,
      v_locks,
      v_cache_hit;
    
    -- Alertas
    IF v_connections > 50 THEN
      RAISE WARNING '⚠️ Muchas conexiones: %', v_connections;
    END IF;
    
    IF v_locks > 10 THEN
      RAISE WARNING '⚠️ Muchos locks: %', v_locks;
    END IF;
    
    IF v_cache_hit < 90 THEN
      RAISE WARNING '⚠️ Cache hit bajo: %', v_cache_hit;
    END IF;
    
    -- Pausa
    PERFORM pg_sleep(10);
    
    -- Salir después de 30 iteraciones (5 minutos)
    EXIT WHEN v_iteration >= 30;
  END LOOP;
  
  RAISE NOTICE '✅ Monitoreo completado';
END $$;

-- =====================================================
-- CLEANUP: RESETEAR ESTADÍSTICAS
-- =====================================================

-- Ejecutar DESPUÉS de las pruebas
SELECT pg_stat_reset();
SELECT pg_stat_statements_reset();

RAISE NOTICE '✅ Scripts de prueba de BD listos para ejecutar';
