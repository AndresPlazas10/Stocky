-- ============================================
-- 🔧 MIGRACIÓN: DEPRECAR SISTEMA DE FACTURACIÓN
-- ============================================
-- Fecha: 16 de enero de 2026
-- Basado en: Estructura real de la base de datos
-- 
-- ESTRATEGIA:
-- 1. Deprecar tablas de facturación (SIN eliminarlas)
-- 2. Deshabilitar facturación en businesses
-- 3. Preservar datos históricos
-- 4. Evitar nuevas facturas
-- ============================================

BEGIN;

-- ============================================
-- PASO 1: Actualizar comentarios de tablas
-- ============================================

COMMENT ON TABLE business_siigo_credentials IS 
'⚠️ DEPRECATED - Ya no se usa. Stocky dejó de ser proveedor de facturación electrónica. Los negocios facturan directamente en Siigo (incluido en su plan). Preservada solo para auditoría histórica.';

COMMENT ON TABLE siigo_invoice_logs IS 
'⚠️ DEPRECATED - Ya no se usa. Logs históricos de integración con Siigo cuando Stocky era proveedor. Preservada solo para auditoría.';

COMMENT ON TABLE invoicing_requests IS 
'⚠️ DEPRECATED - Ya no se usa. Solicitudes de activación de facturación cuando Stocky era proveedor. Preservada solo para auditoría.';

COMMENT ON TABLE invoices IS 
'⚠️ DEPRECATED - Ya no se usa para facturación electrónica. Stocky ahora genera solo comprobantes informativos (NO válidos ante DIAN). Preservada para historial.';

COMMENT ON TABLE invoice_items IS 
'⚠️ DEPRECATED - Ya no se usa. Items de facturas antiguas. Preservada para historial.';

COMMENT ON TABLE electronic_invoices IS 
'⚠️ DEPRECATED - Ya no se usa. Facturas electrónicas generadas cuando Stocky era proveedor. Preservada para historial y auditoría.';

-- ============================================
-- PASO 2: Deshabilitar facturación en negocios
-- ============================================

-- Actualizar todos los negocios que tengan facturación habilitada
UPDATE businesses
SET 
    invoicing_enabled = false,
    invoicing_provider = NULL
WHERE invoicing_enabled = true;

-- Mensaje informativo
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO updated_count FROM businesses WHERE invoicing_enabled = false;
    RAISE NOTICE '✅ Facturación deshabilitada. Total de negocios actualizados: %', updated_count;
END $$;

-- ============================================
-- PASO 3: Agregar columna de deprecación a tablas
-- ============================================

-- Marcar tablas como deprecated con una columna flag
DO $$
BEGIN
    -- business_siigo_credentials
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'business_siigo_credentials' 
        AND column_name = '_deprecated'
    ) THEN
        ALTER TABLE business_siigo_credentials 
        ADD COLUMN _deprecated BOOLEAN DEFAULT TRUE;
        
        COMMENT ON COLUMN business_siigo_credentials._deprecated IS 
        'Marca esta tabla como deprecada. No usar para nuevas funcionalidades.';
    END IF;
    
    -- siigo_invoice_logs
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'siigo_invoice_logs' 
        AND column_name = '_deprecated'
    ) THEN
        ALTER TABLE siigo_invoice_logs 
        ADD COLUMN _deprecated BOOLEAN DEFAULT TRUE;
        
        COMMENT ON COLUMN siigo_invoice_logs._deprecated IS 
        'Marca esta tabla como deprecada. No usar para nuevas funcionalidades.';
    END IF;
    
    -- invoicing_requests
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoicing_requests' 
        AND column_name = '_deprecated'
    ) THEN
        ALTER TABLE invoicing_requests 
        ADD COLUMN _deprecated BOOLEAN DEFAULT TRUE;
        
        COMMENT ON COLUMN invoicing_requests._deprecated IS 
        'Marca esta tabla como deprecada. No usar para nuevas funcionalidades.';
    END IF;
    
    -- invoices
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoices' 
        AND column_name = '_deprecated'
    ) THEN
        ALTER TABLE invoices 
        ADD COLUMN _deprecated BOOLEAN DEFAULT TRUE;
        
        COMMENT ON COLUMN invoices._deprecated IS 
        'Marca esta tabla como deprecada. Ahora se usan comprobantes informativos, NO facturas electrónicas.';
    END IF;
    
    -- invoice_items
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoice_items' 
        AND column_name = '_deprecated'
    ) THEN
        ALTER TABLE invoice_items 
        ADD COLUMN _deprecated BOOLEAN DEFAULT TRUE;
        
        COMMENT ON COLUMN invoice_items._deprecated IS 
        'Marca esta tabla como deprecada. No usar para nuevas funcionalidades.';
    END IF;
    
    -- electronic_invoices
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'electronic_invoices' 
        AND column_name = '_deprecated'
    ) THEN
        ALTER TABLE electronic_invoices 
        ADD COLUMN _deprecated BOOLEAN DEFAULT TRUE;
        
        COMMENT ON COLUMN electronic_invoices._deprecated IS 
        'Marca esta tabla como deprecada. Stocky ya no genera facturas electrónicas válidas ante DIAN.';
    END IF;
    
    RAISE NOTICE '✅ Columnas _deprecated agregadas a todas las tablas de facturación';
END $$;

-- ============================================
-- PASO 4: Eliminar FK de sales a electronic_invoices
-- ============================================

-- Esto permite que sales funcione independiente de facturación
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'sales_electronic_invoice_id_fkey'
        AND table_name = 'sales'
    ) THEN
        ALTER TABLE sales DROP CONSTRAINT sales_electronic_invoice_id_fkey;
        RAISE NOTICE '✅ FK sales -> electronic_invoices eliminada';
    ELSE
        RAISE NOTICE '⚠️ FK sales -> electronic_invoices ya no existe';
    END IF;
END $$;

-- ============================================
-- PASO 5: Actualizar comentario de columnas en businesses
-- ============================================

COMMENT ON COLUMN businesses.invoicing_enabled IS 
'DEPRECATED - Ya no se usa. Stocky dejó de ser proveedor de facturación. Los negocios facturan directamente en Siigo.';

COMMENT ON COLUMN businesses.invoicing_provider IS 
'DEPRECATED - Ya no se usa. Stocky dejó de gestionar facturación electrónica.';

COMMENT ON COLUMN businesses.invoicing_activated_at IS 
'DEPRECATED - Fecha histórica de cuando se activó facturación (ya no aplicable).';

COMMENT ON COLUMN businesses.invoicing_activated_by IS 
'DEPRECATED - Usuario histórico que activó facturación (ya no aplicable).';

-- ============================================
-- PASO 6: Actualizar comentario de sales.electronic_invoice_id
-- ============================================

COMMENT ON COLUMN sales.electronic_invoice_id IS 
'DEPRECATED - Ya no se usa. Referencias históricas a facturas electrónicas antiguas. Nuevas ventas NO generan facturas electrónicas, solo comprobantes informativos.';

-- ============================================
-- PASO 7: Eliminar funciones RPC de facturación
-- ============================================

DO $$
BEGIN
    -- can_business_invoice
    IF EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname = 'can_business_invoice'
    ) THEN
        DROP FUNCTION IF EXISTS can_business_invoice(uuid);
        RAISE NOTICE '✅ Función can_business_invoice eliminada';
    END IF;
    
    -- get_invoice_stats
    IF EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname = 'get_invoice_stats'
    ) THEN
        DROP FUNCTION IF EXISTS get_invoice_stats(uuid, date, date);
        RAISE NOTICE '✅ Función get_invoice_stats eliminada';
    END IF;
    
    -- generate_invoice_number
    IF EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname = 'generate_invoice_number'
    ) THEN
        DROP FUNCTION IF EXISTS generate_invoice_number(uuid);
        RAISE NOTICE '✅ Función generate_invoice_number eliminada';
    END IF;
    
    RAISE NOTICE '✅ Funciones RPC de facturación eliminadas';
END $$;

-- ============================================
-- PASO 8: Eliminar triggers de facturación
-- ============================================

DO $$
BEGIN
    -- Trigger de siigo_credentials
    IF EXISTS (
        SELECT 1 FROM information_schema.triggers 
        WHERE trigger_name = 'trigger_update_siigo_credentials_timestamp'
    ) THEN
        DROP TRIGGER IF EXISTS trigger_update_siigo_credentials_timestamp ON business_siigo_credentials;
        RAISE NOTICE '✅ Trigger trigger_update_siigo_credentials_timestamp eliminado';
    END IF;
    
    -- Trigger de invoicing_requests
    IF EXISTS (
        SELECT 1 FROM information_schema.triggers 
        WHERE trigger_name = 'trigger_invoicing_requests_updated'
    ) THEN
        DROP TRIGGER IF EXISTS trigger_invoicing_requests_updated ON invoicing_requests;
        RAISE NOTICE '✅ Trigger trigger_invoicing_requests_updated eliminado';
    END IF;
    
    -- Trigger de electronic_invoices
    IF EXISTS (
        SELECT 1 FROM information_schema.triggers 
        WHERE trigger_name = 'trigger_electronic_invoices_updated'
    ) THEN
        DROP TRIGGER IF EXISTS trigger_electronic_invoices_updated ON electronic_invoices;
        RAISE NOTICE '✅ Trigger trigger_electronic_invoices_updated eliminado';
    END IF;
    
    -- Trigger de restore stock (invoices)
    IF EXISTS (
        SELECT 1 FROM information_schema.triggers 
        WHERE trigger_name = 'trigger_restore_stock_on_invoice_cancel'
    ) THEN
        DROP TRIGGER IF EXISTS trigger_restore_stock_on_invoice_cancel ON invoices;
        RAISE NOTICE '✅ Trigger trigger_restore_stock_on_invoice_cancel eliminado';
    END IF;
    
    RAISE NOTICE '✅ Triggers de facturación eliminados';
END $$;

-- ============================================
-- PASO 9: Eliminar funciones auxiliares de triggers
-- ============================================

DO $$
BEGIN
    -- update_siigo_credentials_timestamp
    IF EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname = 'update_siigo_credentials_timestamp'
    ) THEN
        DROP FUNCTION IF EXISTS update_siigo_credentials_timestamp();
        RAISE NOTICE '✅ Función update_siigo_credentials_timestamp eliminada';
    END IF;
    
    -- restore_stock_from_invoice (sobrecarga con invoice_id)
    IF EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname = 'restore_stock_from_invoice'
        AND pg_get_function_arguments(p.oid) LIKE '%p_invoice_id%'
    ) THEN
        DROP FUNCTION IF EXISTS restore_stock_from_invoice(uuid);
        RAISE NOTICE '✅ Función restore_stock_from_invoice(uuid) eliminada';
    END IF;
    
    -- restore_stock_from_invoice (trigger function)
    IF EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname = 'restore_stock_from_invoice'
        AND pg_get_function_result(p.oid) = 'trigger'
    ) THEN
        DROP FUNCTION IF EXISTS restore_stock_from_invoice() CASCADE;
        RAISE NOTICE '✅ Función trigger restore_stock_from_invoice() eliminada';
    END IF;
    
    RAISE NOTICE '✅ Funciones auxiliares de triggers eliminadas';
END $$;

-- ============================================
-- PASO 10: Crear vista de resumen
-- ============================================

CREATE OR REPLACE VIEW deprecated_invoicing_summary AS
SELECT 
    'business_siigo_credentials' as tabla,
    (SELECT COUNT(*) FROM business_siigo_credentials) as registros_historicos,
    '⚠️ DEPRECATED - Credenciales antiguas de Siigo' as estado
UNION ALL
SELECT 
    'siigo_invoice_logs' as tabla,
    (SELECT COUNT(*) FROM siigo_invoice_logs) as registros_historicos,
    '⚠️ DEPRECATED - Logs históricos de facturación' as estado
UNION ALL
SELECT 
    'invoicing_requests' as tabla,
    (SELECT COUNT(*) FROM invoicing_requests) as registros_historicos,
    '⚠️ DEPRECATED - Solicitudes antiguas de facturación' as estado
UNION ALL
SELECT 
    'invoices' as tabla,
    (SELECT COUNT(*) FROM invoices) as registros_historicos,
    '⚠️ DEPRECATED - Facturas históricas (NO válidas ante DIAN)' as estado
UNION ALL
SELECT 
    'invoice_items' as tabla,
    (SELECT COUNT(*) FROM invoice_items) as registros_historicos,
    '⚠️ DEPRECATED - Items de facturas históricas' as estado
UNION ALL
SELECT 
    'electronic_invoices' as tabla,
    (SELECT COUNT(*) FROM electronic_invoices) as registros_historicos,
    '⚠️ DEPRECATED - Facturas electrónicas antiguas' as estado;

COMMENT ON VIEW deprecated_invoicing_summary IS 
'Vista de resumen de tablas deprecadas de facturación. Muestra cantidad de registros históricos preservados.';

-- ============================================
-- PASO 11: Resumen final
-- ============================================

DO $$
DECLARE
    v_businesses_updated INTEGER;
    v_siigo_creds INTEGER;
    v_siigo_logs INTEGER;
    v_invoicing_req INTEGER;
    v_invoices INTEGER;
    v_invoice_items INTEGER;
    v_electronic_invoices INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_businesses_updated FROM businesses WHERE invoicing_enabled = false;
    SELECT COUNT(*) INTO v_siigo_creds FROM business_siigo_credentials;
    SELECT COUNT(*) INTO v_siigo_logs FROM siigo_invoice_logs;
    SELECT COUNT(*) INTO v_invoicing_req FROM invoicing_requests;
    SELECT COUNT(*) INTO v_invoices FROM invoices;
    SELECT COUNT(*) INTO v_invoice_items FROM invoice_items;
    SELECT COUNT(*) INTO v_electronic_invoices FROM electronic_invoices;
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ MIGRACIÓN COMPLETADA EXITOSAMENTE';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '📊 RESUMEN:';
    RAISE NOTICE '  • Negocios con facturación deshabilitada: %', v_businesses_updated;
    RAISE NOTICE '  • Credenciales Siigo preservadas: %', v_siigo_creds;
    RAISE NOTICE '  • Logs Siigo preservados: %', v_siigo_logs;
    RAISE NOTICE '  • Solicitudes de facturación preservadas: %', v_invoicing_req;
    RAISE NOTICE '  • Facturas históricas preservadas: %', v_invoices;
    RAISE NOTICE '  • Items de facturas preservados: %', v_invoice_items;
    RAISE NOTICE '  • Facturas electrónicas preservadas: %', v_electronic_invoices;
    RAISE NOTICE '';
    RAISE NOTICE '🔒 SEGURIDAD:';
    RAISE NOTICE '  • Todas las tablas marcadas como DEPRECATED';
    RAISE NOTICE '  • Datos históricos preservados para auditoría';
    RAISE NOTICE '  • FK sales -> electronic_invoices eliminada';
    RAISE NOTICE '  • Funciones RPC de facturación eliminadas';
    RAISE NOTICE '  • Triggers de facturación eliminados';
    RAISE NOTICE '';
    RAISE NOTICE '📋 PRÓXIMOS PASOS:';
    RAISE NOTICE '  1. Verificar que la UI no intente crear facturas electrónicas';
    RAISE NOTICE '  2. Actualizar frontend para mostrar solo comprobantes informativos';
    RAISE NOTICE '  3. Agregar disclaimers legales en comprobantes';
    RAISE NOTICE '  4. Consultar vista deprecated_invoicing_summary para ver datos históricos';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

COMMIT;

-- ============================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ============================================

-- Ver resumen de tablas deprecadas
SELECT * FROM deprecated_invoicing_summary;

-- Verificar que ningún negocio tenga facturación habilitada
SELECT 
    id, 
    name, 
    invoicing_enabled, 
    invoicing_provider
FROM businesses 
WHERE invoicing_enabled = true;
-- Resultado esperado: 0 filas

-- ============================================
-- FIN DE LA MIGRACIÓN
-- ============================================
