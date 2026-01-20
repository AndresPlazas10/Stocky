-- ============================================
-- 🔍 AUDITORÍA: ESTRUCTURA DE TABLAS DE FACTURACIÓN
-- ============================================
-- Fecha: 16 de enero de 2026
-- Propósito: Inspeccionar estructura actual antes de hacer cambios
-- 
-- ESTE SCRIPT SOLO CONSULTA - NO MODIFICA NADA
-- 
-- Ejecutar en Supabase SQL Editor para ver:
-- 1. Tablas relacionadas con facturación
-- 2. Columnas y sus tipos
-- 3. Constraints
-- 4. Índices
-- 5. Triggers
-- 6. Funciones RPC
-- ============================================

-- ============================================
-- 1. LISTAR TODAS LAS TABLAS RELACIONADAS
-- ============================================

SELECT 
    '=== TABLAS RELACIONADAS CON FACTURACIÓN ===' as info;

SELECT 
    schemaname,
    tablename,
    tableowner,
    CASE 
        WHEN obj_description((schemaname||'.'||tablename)::regclass) IS NOT NULL 
        THEN obj_description((schemaname||'.'||tablename)::regclass)
        ELSE 'Sin descripción'
    END as table_comment
FROM pg_tables
WHERE schemaname = 'public'
  AND (
    tablename LIKE '%invoice%' 
    OR tablename LIKE '%siigo%'
    OR tablename = 'sales'
    OR tablename = 'businesses'
  )
ORDER BY tablename;

-- ============================================
-- 2. ESTRUCTURA DE TABLA: businesses
-- ============================================

SELECT 
    '=== TABLA: businesses ===' as info;

SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default,
    CASE 
        WHEN col_description((table_schema||'.'||table_name)::regclass::oid, ordinal_position) IS NOT NULL
        THEN col_description((table_schema||'.'||table_name)::regclass::oid, ordinal_position)
        ELSE 'Sin comentario'
    END as column_comment
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'businesses'
  AND (
    column_name ILIKE '%invoice%' 
    OR column_name ILIKE '%nit%'
    OR column_name ILIKE '%razon%'
    OR column_name ILIKE '%siigo%'
  )
ORDER BY ordinal_position;

-- ============================================
-- 3. ESTRUCTURA DE TABLA: sales
-- ============================================

SELECT 
    '=== TABLA: sales ===' as info;

SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default,
    CASE 
        WHEN col_description((table_schema||'.'||table_name)::regclass::oid, ordinal_position) IS NOT NULL
        THEN col_description((table_schema||'.'||table_name)::regclass::oid, ordinal_position)
        ELSE 'Sin comentario'
    END as column_comment
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'sales'
  AND (
    column_name ILIKE '%invoice%' 
    OR column_name ILIKE '%document%'
    OR column_name ILIKE '%cufe%'
    OR column_name ILIKE '%customer%'
  )
ORDER BY ordinal_position;

-- ============================================
-- 4. ESTRUCTURA DE TABLA: business_siigo_credentials (si existe)
-- ============================================

SELECT 
    '=== TABLA: business_siigo_credentials (si existe) ===' as info;

SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'business_siigo_credentials'
ORDER BY ordinal_position;

-- ============================================
-- 5. ESTRUCTURA DE TABLA: siigo_invoice_logs (si existe)
-- ============================================

SELECT 
    '=== TABLA: siigo_invoice_logs (si existe) ===' as info;

SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'siigo_invoice_logs'
ORDER BY ordinal_position;

-- ============================================
-- 6. ESTRUCTURA DE TABLA: invoicing_requests (si existe)
-- ============================================

SELECT 
    '=== TABLA: invoicing_requests (si existe) ===' as info;

SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'invoicing_requests'
ORDER BY ordinal_position;

-- ============================================
-- 7. ESTRUCTURA DE TABLA: invoices (si existe)
-- ============================================

SELECT 
    '=== TABLA: invoices (si existe) ===' as info;

SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'invoices'
ORDER BY ordinal_position;

-- ============================================
-- 8. ESTRUCTURA DE TABLA: invoice_items (si existe)
-- ============================================

SELECT 
    '=== TABLA: invoice_items (si existe) ===' as info;

SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'invoice_items'
ORDER BY ordinal_position;

-- ============================================
-- 9. CONSTRAINTS (RESTRICCIONES)
-- ============================================

SELECT 
    '=== CONSTRAINTS EN TABLAS RELACIONADAS ===' as info;

SELECT 
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.table_schema = 'public'
  AND tc.table_name IN (
    'businesses',
    'sales',
    'business_siigo_credentials',
    'siigo_invoice_logs',
    'invoicing_requests',
    'invoices',
    'invoice_items'
  )
ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name;

-- ============================================
-- 10. ÍNDICES
-- ============================================

SELECT 
    '=== ÍNDICES EN TABLAS RELACIONADAS ===' as info;

SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND (
    indexname ILIKE '%invoice%'
    OR indexname ILIKE '%siigo%'
    OR indexname ILIKE '%document%'
    OR indexname ILIKE '%cufe%'
    OR tablename IN ('sales', 'businesses')
  )
ORDER BY tablename, indexname;

-- ============================================
-- 11. TRIGGERS
-- ============================================

SELECT 
    '=== TRIGGERS EN TABLAS RELACIONADAS ===' as info;

SELECT 
    event_object_table AS table_name,
    trigger_name,
    event_manipulation AS event,
    action_timing AS timing,
    action_orientation AS orientation
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND (
    event_object_table IN (
      'businesses',
      'sales',
      'business_siigo_credentials',
      'siigo_invoice_logs',
      'invoicing_requests',
      'invoices',
      'invoice_items'
    )
    OR trigger_name ILIKE '%invoice%'
    OR trigger_name ILIKE '%siigo%'
  )
ORDER BY event_object_table, trigger_name;

-- ============================================
-- 12. FUNCIONES RPC RELACIONADAS
-- ============================================

SELECT 
    '=== FUNCIONES RPC RELACIONADAS CON FACTURACIÓN ===' as info;

SELECT 
    n.nspname as schema_name,
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments,
    pg_get_function_result(p.oid) as return_type,
    CASE 
        WHEN p.provolatile = 'i' THEN 'IMMUTABLE'
        WHEN p.provolatile = 's' THEN 'STABLE'
        WHEN p.provolatile = 'v' THEN 'VOLATILE'
    END as volatility,
    obj_description(p.oid) as description
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND (
    p.proname ILIKE '%invoice%'
    OR p.proname ILIKE '%siigo%'
    OR p.proname ILIKE '%factura%'
  )
ORDER BY p.proname;

-- ============================================
-- 13. CONTEO DE REGISTROS
-- ============================================

SELECT 
    '=== CONTEO DE REGISTROS ===' as info;

-- Total de ventas
SELECT 
    'sales' as tabla,
    'total' as valor,
    COUNT(*) as cantidad
FROM sales;

-- Contar ventas por tipo de documento (solo si la columna existe)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sales' AND column_name = 'document_type'
    ) THEN
        RAISE NOTICE 'Consultando sales.document_type...';
        PERFORM 1; -- Placeholder para la consulta dinámica
    ELSE
        RAISE NOTICE 'La columna sales.document_type NO EXISTE';
    END IF;
END $$;

-- Contar ventas con factura electrónica (solo si la columna existe)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sales' AND column_name = 'is_electronic_invoice'
    ) THEN
        RAISE NOTICE 'Consultando sales.is_electronic_invoice...';
        PERFORM 1; -- Placeholder para la consulta dinámica
    ELSE
        RAISE NOTICE 'La columna sales.is_electronic_invoice NO EXISTE';
    END IF;
END $$;

-- Total de negocios
SELECT 
    'businesses' as tabla,
    'total' as valor,
    COUNT(*) as cantidad
FROM businesses;

-- Contar negocios con facturación habilitada (solo si la columna existe)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'businesses' AND column_name = 'invoicing_enabled'
    ) THEN
        RAISE NOTICE 'Consultando businesses.invoicing_enabled...';
        PERFORM 1; -- Placeholder para la consulta dinámica
    ELSE
        RAISE NOTICE 'La columna businesses.invoicing_enabled NO EXISTE';
    END IF;
END $$;

-- Contar credenciales Siigo (solo si la tabla existe)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'business_siigo_credentials'
    ) THEN
        RAISE NOTICE 'Tabla business_siigo_credentials existe. Total: %', (SELECT COUNT(*) FROM business_siigo_credentials);
    ELSE
        RAISE NOTICE 'La tabla business_siigo_credentials NO EXISTE';
    END IF;
END $$;

-- Contar logs de Siigo (solo si la tabla existe)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'siigo_invoice_logs'
    ) THEN
        RAISE NOTICE 'Tabla siigo_invoice_logs existe. Total: %', (SELECT COUNT(*) FROM siigo_invoice_logs);
    ELSE
        RAISE NOTICE 'La tabla siigo_invoice_logs NO EXISTE';
    END IF;
END $$;

-- Contar solicitudes de facturación (solo si la tabla existe)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'invoicing_requests'
    ) THEN
        RAISE NOTICE 'Tabla invoicing_requests existe. Total: %', (SELECT COUNT(*) FROM invoicing_requests);
    ELSE
        RAISE NOTICE 'La tabla invoicing_requests NO EXISTE';
    END IF;
END $$;

-- Contar facturas (solo si la tabla existe)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'invoices'
    ) THEN
        RAISE NOTICE 'Tabla invoices existe. Total: %', (SELECT COUNT(*) FROM invoices);
    ELSE
        RAISE NOTICE 'La tabla invoices NO EXISTE';
    END IF;
END $$;

-- Contar invoice_items (solo si la tabla existe)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'invoice_items'
    ) THEN
        RAISE NOTICE 'Tabla invoice_items existe. Total: %', (SELECT COUNT(*) FROM invoice_items);
    ELSE
        RAISE NOTICE 'La tabla invoice_items NO EXISTE';
    END IF;
END $$;

-- ============================================
-- 14. VISTAS RELACIONADAS
-- ============================================

SELECT 
    '=== VISTAS RELACIONADAS ===' as info;

SELECT 
    schemaname,
    viewname,
    viewowner,
    definition
FROM pg_views
WHERE schemaname = 'public'
  AND (
    viewname ILIKE '%invoice%'
    OR viewname ILIKE '%sales%'
    OR viewname ILIKE '%siigo%'
  )
ORDER BY viewname;

-- ============================================
-- 15. RESUMEN EJECUTIVO
-- ============================================

SELECT 
    '=== RESUMEN EJECUTIVO ===' as info;

DO $$
DECLARE
    v_total_sales INTEGER;
    v_total_businesses INTEGER;
    v_siigo_credentials INTEGER := 0;
    v_siigo_logs INTEGER := 0;
    v_invoicing_requests INTEGER := 0;
    v_invoices INTEGER := 0;
    v_invoice_items INTEGER := 0;
    v_result JSONB;
BEGIN
    -- Contar ventas
    SELECT COUNT(*) INTO v_total_sales FROM sales;
    
    -- Contar negocios
    SELECT COUNT(*) INTO v_total_businesses FROM businesses;
    
    -- Contar credenciales Siigo
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'business_siigo_credentials') THEN
        SELECT COUNT(*) INTO v_siigo_credentials FROM business_siigo_credentials;
    END IF;
    
    -- Contar logs Siigo
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'siigo_invoice_logs') THEN
        SELECT COUNT(*) INTO v_siigo_logs FROM siigo_invoice_logs;
    END IF;
    
    -- Contar solicitudes de facturación
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'invoicing_requests') THEN
        SELECT COUNT(*) INTO v_invoicing_requests FROM invoicing_requests;
    END IF;
    
    -- Contar facturas
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'invoices') THEN
        SELECT COUNT(*) INTO v_invoices FROM invoices;
    END IF;
    
    -- Contar items de factura
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'invoice_items') THEN
        SELECT COUNT(*) INTO v_invoice_items FROM invoice_items;
    END IF;
    
    -- Construir resultado JSON
    v_result := jsonb_build_object(
        'total_ventas', v_total_sales,
        'total_negocios', v_total_businesses,
        'credenciales_siigo', v_siigo_credentials,
        'logs_siigo', v_siigo_logs,
        'solicitudes_facturacion', v_invoicing_requests,
        'facturas_historicas', v_invoices,
        'items_factura_historicos', v_invoice_items
    );
    
    RAISE NOTICE '📊 RESUMEN EJECUTIVO: %', v_result::text;
END $$;

-- ============================================
-- 16. VERIFICACIÓN DE EXISTENCIA DE TABLAS
-- ============================================

SELECT 
    '=== VERIFICACIÓN DE EXISTENCIA DE TABLAS ===' as info;

SELECT 
    tabla,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tabla)
        THEN '✅ EXISTE'
        ELSE '❌ NO EXISTE'
    END as estado
FROM (
    VALUES 
        ('businesses'),
        ('sales'),
        ('business_siigo_credentials'),
        ('siigo_invoice_logs'),
        ('invoicing_requests'),
        ('invoices'),
        ('invoice_items')
) AS t(tabla)
ORDER BY tabla;

-- ============================================
-- 17. VERIFICACIÓN DE COLUMNAS CRÍTICAS
-- ============================================

SELECT 
    '=== VERIFICACIÓN DE COLUMNAS CRÍTICAS ===' as info;

SELECT 
    tabla || '.' || columna as campo,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
              AND table_name = tabla 
              AND column_name = columna
        )
        THEN '✅ EXISTE'
        ELSE '❌ NO EXISTE'
    END as estado,
    COALESCE(
        (SELECT data_type 
         FROM information_schema.columns 
         WHERE table_schema = 'public' 
           AND table_name = tabla 
           AND column_name = columna),
        'N/A'
    ) as tipo_dato
FROM (
    VALUES 
        ('businesses', 'invoicing_enabled'),
        ('businesses', 'invoicing_provider'),
        ('businesses', 'nit'),
        ('businesses', 'razon_social'),
        ('sales', 'document_type'),
        ('sales', 'is_electronic_invoice'),
        ('sales', 'invoice_status'),
        ('sales', 'cufe'),
        ('sales', 'invoice_number'),
        ('sales', 'invoice_pdf_url'),
        ('sales', 'customer_id'),
        ('sales', 'customer_name'),
        ('sales', 'customer_nit'),
        ('sales', 'invoice_error')
) AS t(tabla, columna)
ORDER BY tabla, columna;

-- ============================================
-- FIN DEL SCRIPT DE AUDITORÍA
-- ============================================

SELECT 
    '✅ AUDITORÍA COMPLETADA' as resultado,
    'Revisa los resultados arriba para entender la estructura actual' as instruccion,
    'Basado en esta información, puedes ejecutar el script de migración con confianza' as siguiente_paso;
