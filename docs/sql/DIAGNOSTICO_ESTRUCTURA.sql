-- =====================================================
-- DIAGNÓSTICO DE ESTRUCTURA ACTUAL - STOCKLY
-- =====================================================
-- Script para obtener la estructura completa de la BD
-- Ejecuta este script para ver qué tablas y columnas existen
-- =====================================================

-- =====================================================
-- 1. LISTADO DE TODAS LAS TABLAS
-- =====================================================

SELECT 
  '========================================' AS separador,
  '📊 TABLAS EN EL SCHEMA PUBLIC' AS titulo,
  '========================================' AS separador2;

SELECT 
  schemaname AS schema,
  tablename AS tabla,
  CASE 
    WHEN rowsecurity THEN '🔒 RLS ACTIVO'
    ELSE '🔓 SIN RLS'
  END AS seguridad
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename NOT LIKE 'pg_%'
ORDER BY tablename;

-- =====================================================
-- 2. ESTRUCTURA DETALLADA: EMPLOYEES
-- =====================================================

SELECT 
  '========================================' AS separador,
  '👥 ESTRUCTURA TABLA: EMPLOYEES' AS titulo,
  '========================================' AS separador2;

SELECT 
  ordinal_position AS "#",
  column_name AS columna,
  data_type AS tipo,
  character_maximum_length AS longitud_max,
  is_nullable AS permite_null,
  column_default AS valor_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'employees'
ORDER BY ordinal_position;

-- =====================================================
-- 3. ESTRUCTURA DETALLADA: SALES
-- =====================================================

SELECT 
  '========================================' AS separador,
  '💰 ESTRUCTURA TABLA: SALES' AS titulo,
  '========================================' AS separador2;

SELECT 
  ordinal_position AS "#",
  column_name AS columna,
  data_type AS tipo,
  character_maximum_length AS longitud_max,
  is_nullable AS permite_null,
  column_default AS valor_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'sales'
ORDER BY ordinal_position;

-- =====================================================
-- 4. ESTRUCTURA DETALLADA: BUSINESSES
-- =====================================================

SELECT 
  '========================================' AS separador,
  '🏢 ESTRUCTURA TABLA: BUSINESSES' AS titulo,
  '========================================' AS separador2;

SELECT 
  ordinal_position AS "#",
  column_name AS columna,
  data_type AS tipo,
  character_maximum_length AS longitud_max,
  is_nullable AS permite_null,
  column_default AS valor_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'businesses'
ORDER BY ordinal_position;

-- =====================================================
-- 5. ESTRUCTURA DETALLADA: PRODUCTS
-- =====================================================

SELECT 
  '========================================' AS separador,
  '📦 ESTRUCTURA TABLA: PRODUCTS' AS titulo,
  '========================================' AS separador2;

SELECT 
  ordinal_position AS "#",
  column_name AS columna,
  data_type AS tipo,
  character_maximum_length AS longitud_max,
  is_nullable AS permite_null,
  column_default AS valor_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'products'
ORDER BY ordinal_position;

-- =====================================================
-- 6. ESTRUCTURA DETALLADA: PURCHASES
-- =====================================================

SELECT 
  '========================================' AS separador,
  '🛒 ESTRUCTURA TABLA: PURCHASES' AS titulo,
  '========================================' AS separador2;

SELECT 
  ordinal_position AS "#",
  column_name AS columna,
  data_type AS tipo,
  character_maximum_length AS longitud_max,
  is_nullable AS permite_null,
  column_default AS valor_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'purchases'
ORDER BY ordinal_position;

-- =====================================================
-- 7. ESTRUCTURA DETALLADA: INVOICES
-- =====================================================

SELECT 
  '========================================' AS separador,
  '📄 ESTRUCTURA TABLA: INVOICES' AS titulo,
  '========================================' AS separador2;

SELECT 
  ordinal_position AS "#",
  column_name AS columna,
  data_type AS tipo,
  character_maximum_length AS longitud_max,
  is_nullable AS permite_null,
  column_default AS valor_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'invoices'
ORDER BY ordinal_position;

-- =====================================================
-- 8. ESTRUCTURA TODAS LAS DEMÁS TABLAS
-- =====================================================

SELECT 
  '========================================' AS separador,
  '📋 TODAS LAS COLUMNAS (RESUMEN)' AS titulo,
  '========================================' AS separador2;

SELECT 
  table_name AS tabla,
  column_name AS columna,
  data_type AS tipo,
  is_nullable AS null,
  column_default AS default_val
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'customers', 'suppliers', 'sale_details', 'purchase_details',
    'invoice_items', 'tables', 'orders', 'order_items', 
    'idempotency_requests'
  )
ORDER BY table_name, ordinal_position;

-- =====================================================
-- 9. FOREIGN KEYS EXISTENTES
-- =====================================================

SELECT 
  '========================================' AS separador,
  '🔗 FOREIGN KEYS' AS titulo,
  '========================================' AS separador2;

SELECT 
  tc.table_name AS tabla,
  kcu.column_name AS columna,
  ccu.table_name AS referencia_tabla,
  ccu.column_name AS referencia_columna,
  rc.update_rule AS on_update,
  rc.delete_rule AS on_delete
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints AS rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

-- =====================================================
-- 10. ÍNDICES EXISTENTES
-- =====================================================

SELECT 
  '========================================' AS separador,
  '📊 ÍNDICES CREADOS' AS titulo,
  '========================================' AS separador2;

SELECT 
  tablename AS tabla,
  indexname AS indice,
  CASE 
    WHEN indexdef LIKE '%UNIQUE%' THEN 'UNIQUE'
    ELSE 'REGULAR'
  END AS tipo
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename NOT LIKE 'pg_%'
ORDER BY tablename, indexname;

-- =====================================================
-- 11. POLÍTICAS RLS EXISTENTES
-- =====================================================

SELECT 
  '========================================' AS separador,
  '🔒 POLÍTICAS RLS ACTIVAS' AS titulo,
  '========================================' AS separador2;

SELECT 
  tablename AS tabla,
  policyname AS politica,
  cmd AS operacion,
  permissive AS tipo,
  roles
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- =====================================================
-- 12. TIPOS ENUM EXISTENTES
-- =====================================================

SELECT 
  '========================================' AS separador,
  '📝 TIPOS ENUM DEFINIDOS' AS titulo,
  '========================================' AS separador2;

SELECT 
  t.typname AS tipo_enum,
  string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) AS valores_posibles
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public'
GROUP BY t.typname
ORDER BY t.typname;

-- =====================================================
-- 13. FUNCIONES EXISTENTES
-- =====================================================

SELECT 
  '========================================' AS separador,
  '⚡ FUNCIONES CREADAS' AS titulo,
  '========================================' AS separador2;

SELECT 
  routine_name AS funcion,
  routine_type AS tipo,
  data_type AS retorna,
  security_type AS seguridad
FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routine_name;

-- =====================================================
-- 14. TRIGGERS EXISTENTES
-- =====================================================

SELECT 
  '========================================' AS separador,
  '🎯 TRIGGERS ACTIVOS' AS titulo,
  '========================================' AS separador2;

SELECT 
  event_object_table AS tabla,
  trigger_name AS trigger,
  action_timing AS momento,
  event_manipulation AS evento
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table NOT LIKE 'pg_%'
ORDER BY event_object_table, trigger_name;

-- =====================================================
-- 15. RESUMEN GENERAL
-- =====================================================

SELECT 
  '========================================' AS separador,
  '📊 RESUMEN GENERAL' AS titulo,
  '========================================' AS separador2;

SELECT 
  'Total de Tablas' AS metrica,
  COUNT(*)::TEXT AS valor
FROM pg_tables 
WHERE schemaname = 'public' AND tablename NOT LIKE 'pg_%'

UNION ALL

SELECT 
  'Tablas con RLS',
  COUNT(*)::TEXT
FROM pg_tables 
WHERE schemaname = 'public' AND rowsecurity = true

UNION ALL

SELECT 
  'Total Políticas RLS',
  COUNT(*)::TEXT
FROM pg_policies 
WHERE schemaname = 'public'

UNION ALL

SELECT 
  'Total Índices',
  COUNT(*)::TEXT
FROM pg_indexes 
WHERE schemaname = 'public'

UNION ALL

SELECT 
  'Total Funciones',
  COUNT(*)::TEXT
FROM information_schema.routines 
WHERE routine_schema = 'public'

UNION ALL

SELECT 
  'Total Triggers',
  COUNT(*)::TEXT
FROM information_schema.triggers 
WHERE trigger_schema = 'public' AND event_object_table NOT LIKE 'pg_%'

UNION ALL

SELECT 
  'Total Foreign Keys',
  COUNT(*)::TEXT
FROM information_schema.table_constraints 
WHERE table_schema = 'public' AND constraint_type = 'FOREIGN KEY';

-- =====================================================
-- FIN DEL DIAGNÓSTICO
-- =====================================================

SELECT 
  '========================================' AS separador,
  '✅ DIAGNÓSTICO COMPLETO' AS titulo,
  '========================================' AS separador2;
