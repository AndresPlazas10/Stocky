-- ============================================
-- 📦 EXPORTAR ESTRUCTURA DE DB EN JSON
-- ============================================
-- Fecha: 16 de enero de 2026
-- Propósito: Generar un JSON completo con toda la estructura
-- 
-- Ejecutar en Supabase SQL Editor
-- Copiar el resultado JSON y pegarlo en el chat
-- ============================================

WITH 
-- 1. Listar todas las tablas relacionadas
tables_info AS (
    SELECT jsonb_agg(
        jsonb_build_object(
            'schema', schemaname,
            'table', tablename,
            'owner', tableowner
        )
    ) as data
    FROM pg_tables
    WHERE schemaname = 'public'
      AND (
        tablename LIKE '%invoice%' 
        OR tablename LIKE '%siigo%'
        OR tablename = 'sales'
        OR tablename = 'businesses'
      )
),

-- 2. Estructura de tabla businesses
businesses_columns AS (
    SELECT jsonb_agg(
        jsonb_build_object(
            'column_name', column_name,
            'data_type', data_type,
            'is_nullable', is_nullable,
            'column_default', column_default,
            'character_maximum_length', character_maximum_length
        ) ORDER BY ordinal_position
    ) as data
    FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'businesses'
),

-- 3. Estructura de tabla sales
sales_columns AS (
    SELECT jsonb_agg(
        jsonb_build_object(
            'column_name', column_name,
            'data_type', data_type,
            'is_nullable', is_nullable,
            'column_default', column_default,
            'character_maximum_length', character_maximum_length
        ) ORDER BY ordinal_position
    ) as data
    FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'sales'
),

-- 4. Estructura de business_siigo_credentials
siigo_creds_columns AS (
    SELECT COALESCE(
        (SELECT jsonb_agg(
            jsonb_build_object(
                'column_name', column_name,
                'data_type', data_type,
                'is_nullable', is_nullable,
                'column_default', column_default
            ) ORDER BY ordinal_position
        )
        FROM information_schema.columns
        WHERE table_schema = 'public' 
          AND table_name = 'business_siigo_credentials'),
        '[]'::jsonb
    ) as data
),

-- 5. Estructura de siigo_invoice_logs
siigo_logs_columns AS (
    SELECT COALESCE(
        (SELECT jsonb_agg(
            jsonb_build_object(
                'column_name', column_name,
                'data_type', data_type,
                'is_nullable', is_nullable,
                'column_default', column_default
            ) ORDER BY ordinal_position
        )
        FROM information_schema.columns
        WHERE table_schema = 'public' 
          AND table_name = 'siigo_invoice_logs'),
        '[]'::jsonb
    ) as data
),

-- 6. Estructura de invoicing_requests
invoicing_req_columns AS (
    SELECT COALESCE(
        (SELECT jsonb_agg(
            jsonb_build_object(
                'column_name', column_name,
                'data_type', data_type,
                'is_nullable', is_nullable,
                'column_default', column_default
            ) ORDER BY ordinal_position
        )
        FROM information_schema.columns
        WHERE table_schema = 'public' 
          AND table_name = 'invoicing_requests'),
        '[]'::jsonb
    ) as data
),

-- 7. Estructura de invoices
invoices_columns AS (
    SELECT COALESCE(
        (SELECT jsonb_agg(
            jsonb_build_object(
                'column_name', column_name,
                'data_type', data_type,
                'is_nullable', is_nullable,
                'column_default', column_default
            ) ORDER BY ordinal_position
        )
        FROM information_schema.columns
        WHERE table_schema = 'public' 
          AND table_name = 'invoices'),
        '[]'::jsonb
    ) as data
),

-- 8. Estructura de invoice_items
invoice_items_columns AS (
    SELECT COALESCE(
        (SELECT jsonb_agg(
            jsonb_build_object(
                'column_name', column_name,
                'data_type', data_type,
                'is_nullable', is_nullable,
                'column_default', column_default
            ) ORDER BY ordinal_position
        )
        FROM information_schema.columns
        WHERE table_schema = 'public' 
          AND table_name = 'invoice_items'),
        '[]'::jsonb
    ) as data
),

-- 9. Constraints
constraints_info AS (
    SELECT jsonb_agg(
        jsonb_build_object(
            'table_name', tc.table_name,
            'constraint_name', tc.constraint_name,
            'constraint_type', tc.constraint_type,
            'column_name', kcu.column_name,
            'foreign_table', ccu.table_name,
            'foreign_column', ccu.column_name
        )
    ) as data
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
),

-- 10. Índices
indexes_info AS (
    SELECT jsonb_agg(
        jsonb_build_object(
            'table', tablename,
            'index_name', indexname,
            'definition', indexdef
        )
    ) as data
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND (
        tablename IN ('sales', 'businesses')
        OR indexname ILIKE '%invoice%'
        OR indexname ILIKE '%siigo%'
      )
),

-- 11. Triggers
triggers_info AS (
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'table', event_object_table,
                'trigger_name', trigger_name,
                'event', event_manipulation,
                'timing', action_timing
            )
        ),
        '[]'::jsonb
    ) as data
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
),

-- 12. Funciones RPC
functions_info AS (
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'function_name', p.proname,
                'arguments', pg_get_function_arguments(p.oid),
                'return_type', pg_get_function_result(p.oid)
            )
        ),
        '[]'::jsonb
    ) as data
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND (
        p.proname ILIKE '%invoice%'
        OR p.proname ILIKE '%siigo%'
        OR p.proname ILIKE '%factura%'
      )
),

-- 13. Conteos
counts_info AS (
    SELECT jsonb_build_object(
        'total_sales', (SELECT COUNT(*) FROM sales),
        'total_businesses', (SELECT COUNT(*) FROM businesses),
        'business_siigo_credentials', (
            SELECT CASE 
                WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'business_siigo_credentials')
                THEN (SELECT COUNT(*) FROM business_siigo_credentials)
                ELSE 0
            END
        ),
        'siigo_invoice_logs', (
            SELECT CASE 
                WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'siigo_invoice_logs')
                THEN (SELECT COUNT(*) FROM siigo_invoice_logs)
                ELSE 0
            END
        ),
        'invoicing_requests', (
            SELECT CASE 
                WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'invoicing_requests')
                THEN (SELECT COUNT(*) FROM invoicing_requests)
                ELSE 0
            END
        ),
        'invoices', (
            SELECT CASE 
                WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'invoices')
                THEN (SELECT COUNT(*) FROM invoices)
                ELSE 0
            END
        ),
        'invoice_items', (
            SELECT CASE 
                WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'invoice_items')
                THEN (SELECT COUNT(*) FROM invoice_items)
                ELSE 0
            END
        )
    ) as data
),

-- 14. Existencia de tablas
tables_existence AS (
    SELECT jsonb_object_agg(
        tabla,
        EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tabla)
    ) as data
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
),

-- 15. Existencia de columnas críticas
columns_existence AS (
    SELECT jsonb_object_agg(
        tabla || '.' || columna,
        EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
              AND table_name = tabla 
              AND column_name = columna
        )
    ) as data
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
)

-- RESULTADO FINAL: TODO EN UN SOLO JSON
SELECT jsonb_pretty(
    jsonb_build_object(
        'meta', jsonb_build_object(
            'exported_at', NOW(),
            'database', current_database(),
            'purpose', 'Estructura para migración de facturación'
        ),
        'tables', (SELECT data FROM tables_info),
        'tables_existence', (SELECT data FROM tables_existence),
        'columns_existence', (SELECT data FROM columns_existence),
        'column_details', jsonb_build_object(
            'businesses', (SELECT data FROM businesses_columns),
            'sales', (SELECT data FROM sales_columns),
            'business_siigo_credentials', (SELECT data FROM siigo_creds_columns),
            'siigo_invoice_logs', (SELECT data FROM siigo_logs_columns),
            'invoicing_requests', (SELECT data FROM invoicing_req_columns),
            'invoices', (SELECT data FROM invoices_columns),
            'invoice_items', (SELECT data FROM invoice_items_columns)
        ),
        'constraints', (SELECT data FROM constraints_info),
        'indexes', (SELECT data FROM indexes_info),
        'triggers', (SELECT data FROM triggers_info),
        'functions', (SELECT data FROM functions_info),
        'record_counts', (SELECT data FROM counts_info)
    )
) as database_structure_json;
