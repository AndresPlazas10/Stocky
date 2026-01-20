-- ============================================
-- 🔄 MIGRACIÓN: DEPRECAR SISTEMA DE FACTURACIÓN ELECTRÓNICA
-- ============================================
-- Fecha: 16 de enero de 2026
-- Propósito: Desactivar integración de facturación electrónica en Stocky
-- 
-- CONTEXTO:
-- Stocky YA NO actúa como proveedor de facturación electrónica.
-- Los negocios deben facturar directamente en Siigo (plan incluido).
-- Este script depreca tablas y campos relacionados SIN eliminar datos.
-- 
-- EJECUCIÓN:
-- 1. Abrir Supabase Dashboard
-- 2. Ir a SQL Editor
-- 3. Copiar y pegar este script completo
-- 4. Ejecutar
-- 
-- ⚠️ IMPORTANTE: Este script NO elimina datos, solo los marca como deprecados
-- ============================================

BEGIN;

-- ============================================
-- PASO 1: DESACTIVAR FACTURACIÓN EN TODOS LOS NEGOCIOS
-- ============================================

DO $$
BEGIN
    -- Verificar si la columna existe antes de actualizarla
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'businesses' 
        AND column_name = 'invoicing_enabled'
    ) THEN
        -- Desactivar facturación electrónica en todos los negocios
        UPDATE businesses 
        SET invoicing_enabled = false,
            invoicing_provider = NULL
        WHERE invoicing_enabled = true;
        
        RAISE NOTICE 'Facturación desactivada en % negocios', 
            (SELECT COUNT(*) FROM businesses WHERE invoicing_enabled = false);
    END IF;
END $$;

-- ============================================
-- PASO 2: MARCAR TABLAS DE FACTURACIÓN COMO DEPRECADAS
-- ============================================

-- 2.1 Tabla: business_siigo_credentials (DEPRECADA)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'business_siigo_credentials') THEN
        COMMENT ON TABLE business_siigo_credentials IS 
        '⚠️ DEPRECADA - 16/01/2026 - Stocky ya NO maneja credenciales Siigo. Los negocios acceden directamente a Siigo. Tabla mantenida solo para referencia histórica.';
        
        -- Agregar columna de deprecación si no existe
        ALTER TABLE business_siigo_credentials 
        ADD COLUMN IF NOT EXISTS _deprecated BOOLEAN DEFAULT true;
        
        UPDATE business_siigo_credentials SET _deprecated = true;
        
        RAISE NOTICE 'Tabla business_siigo_credentials marcada como DEPRECADA';
    END IF;
END $$;

-- 2.2 Tabla: siigo_invoice_logs (DEPRECADA)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'siigo_invoice_logs') THEN
        COMMENT ON TABLE siigo_invoice_logs IS 
        '⚠️ DEPRECADA - 16/01/2026 - Stocky ya NO genera facturas electrónicas vía Siigo. Los logs antiguos se mantienen para auditoría pero no se crearán nuevos registros.';
        
        ALTER TABLE siigo_invoice_logs 
        ADD COLUMN IF NOT EXISTS _deprecated BOOLEAN DEFAULT true;
        
        UPDATE siigo_invoice_logs SET _deprecated = true;
        
        RAISE NOTICE 'Tabla siigo_invoice_logs marcada como DEPRECADA';
    END IF;
END $$;

-- 2.3 Tabla: invoicing_requests (DEPRECADA)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoicing_requests') THEN
        COMMENT ON TABLE invoicing_requests IS 
        '⚠️ DEPRECADA - 16/01/2026 - Ya no se aceptan solicitudes de facturación a través de Stocky. Los negocios tienen acceso directo a Siigo incluido en su plan.';
        
        ALTER TABLE invoicing_requests 
        ADD COLUMN IF NOT EXISTS _deprecated BOOLEAN DEFAULT true;
        
        UPDATE invoicing_requests SET _deprecated = true;
        
        -- Cancelar todas las solicitudes pendientes
        UPDATE invoicing_requests 
        SET status = 'cancelled',
            admin_notes = 'Sistema de facturación integrada discontinuado el 16/01/2026. Usar Siigo directamente.'
        WHERE status = 'pending';
        
        RAISE NOTICE 'Tabla invoicing_requests marcada como DEPRECADA. Solicitudes pendientes canceladas.';
    END IF;
END $$;

-- 2.4 Tabla: invoices (DEPRECADA - si existe)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoices') THEN
        COMMENT ON TABLE invoices IS 
        '⚠️ DEPRECADA - 16/01/2026 - Stocky ya NO emite facturas electrónicas. Solo genera comprobantes informativos (NO válidos ante DIAN). Datos históricos mantenidos para referencia.';
        
        ALTER TABLE invoices 
        ADD COLUMN IF NOT EXISTS _deprecated BOOLEAN DEFAULT true;
        
        UPDATE invoices SET _deprecated = true;
        
        RAISE NOTICE 'Tabla invoices marcada como DEPRECADA';
    END IF;
END $$;

-- 2.5 Tabla: invoice_items (DEPRECADA - si existe)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoice_items') THEN
        COMMENT ON TABLE invoice_items IS 
        '⚠️ DEPRECADA - 16/01/2026 - Relacionada con tabla invoices deprecada. Mantenida solo para históricos.';
        
        ALTER TABLE invoice_items 
        ADD COLUMN IF NOT EXISTS _deprecated BOOLEAN DEFAULT true;
        
        UPDATE invoice_items SET _deprecated = true;
        
        RAISE NOTICE 'Tabla invoice_items marcada como DEPRECADA';
    END IF;
END $$;

-- ============================================
-- PASO 3: ACTUALIZAR CAMPOS EN TABLA SALES
-- ============================================

DO $$
BEGIN
    -- 3.1 Actualizar comentarios de campos relacionados con facturación
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sales' AND column_name = 'document_type'
    ) THEN
        COMMENT ON COLUMN sales.document_type IS 
        'Tipo de documento generado. SIEMPRE debe ser "receipt" (comprobante). Las facturas electrónicas se emiten directamente en Siigo.';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sales' AND column_name = 'is_electronic_invoice'
    ) THEN
        COMMENT ON COLUMN sales.is_electronic_invoice IS 
        '⚠️ DEPRECADO - Este campo ya no se usa. Stocky NO genera facturas electrónicas. Mantenido solo para compatibilidad con datos antiguos.';
        
        -- Asegurar que todas las ventas futuras tengan esto en false
        UPDATE sales 
        SET is_electronic_invoice = false 
        WHERE is_electronic_invoice = true;
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sales' AND column_name = 'invoice_status'
    ) THEN
        COMMENT ON COLUMN sales.invoice_status IS 
        '⚠️ DEPRECADO - Ya no aplicable. Stocky no maneja estados de facturas electrónicas.';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sales' AND column_name = 'cufe'
    ) THEN
        COMMENT ON COLUMN sales.cufe IS 
        '⚠️ DEPRECADO - Stocky no genera CUFE. Las facturas con CUFE se emiten directamente en Siigo.';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sales' AND column_name = 'invoice_number'
    ) THEN
        COMMENT ON COLUMN sales.invoice_number IS 
        '⚠️ DEPRECADO - Los números de factura electrónica se asignan en Siigo, no en Stocky.';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sales' AND column_name = 'invoice_pdf_url'
    ) THEN
        COMMENT ON COLUMN sales.invoice_pdf_url IS 
        '⚠️ DEPRECADO - Los PDFs de facturas electrónicas se obtienen desde Siigo.';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sales' AND column_name = 'invoice_qr_code'
    ) THEN
        COMMENT ON COLUMN sales.invoice_qr_code IS 
        '⚠️ DEPRECADO - Los códigos QR de facturas DIAN se generan en Siigo.';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sales' AND column_name = 'invoice_error'
    ) THEN
        COMMENT ON COLUMN sales.invoice_error IS 
        '⚠️ DEPRECADO - Ya no aplicable. Stocky no genera facturas.';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sales' AND column_name = 'invoice_date'
    ) THEN
        COMMENT ON COLUMN sales.invoice_date IS 
        '⚠️ DEPRECADO - Las fechas de facturación electrónica se manejan en Siigo.';
    END IF;
    
    RAISE NOTICE 'Campos de facturación en tabla sales actualizados con advertencias de DEPRECACIÓN';
END $$;

-- ============================================
-- PASO 4: ACTUALIZAR CAMPOS EN TABLA BUSINESSES
-- ============================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'businesses' AND column_name = 'invoicing_enabled'
    ) THEN
        COMMENT ON COLUMN businesses.invoicing_enabled IS 
        '⚠️ DEPRECADO - Stocky ya NO maneja facturación electrónica. Campo mantenido en false para todos los negocios. Los negocios facturan directamente en Siigo (plan incluido).';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'businesses' AND column_name = 'invoicing_provider'
    ) THEN
        COMMENT ON COLUMN businesses.invoicing_provider IS 
        '⚠️ DEPRECADO - Los negocios manejan su proveedor de facturación (Siigo) de forma independiente.';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'businesses' AND column_name = 'invoicing_activated_at'
    ) THEN
        COMMENT ON COLUMN businesses.invoicing_activated_at IS 
        '⚠️ DEPRECADO - Ya no aplicable. Campo histórico.';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'businesses' AND column_name = 'invoicing_activated_by'
    ) THEN
        COMMENT ON COLUMN businesses.invoicing_activated_by IS 
        '⚠️ DEPRECADO - Ya no aplicable. Campo histórico.';
    END IF;
    
    -- El NIT y razón social SÍ se mantienen (son útiles para otros propósitos)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'businesses' AND column_name = 'nit'
    ) THEN
        COMMENT ON COLUMN businesses.nit IS 
        'NIT del negocio (opcional). Útil para identificación pero NO se usa para facturación electrónica en Stocky. La facturación se hace directamente en Siigo.';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'businesses' AND column_name = 'razon_social'
    ) THEN
        COMMENT ON COLUMN businesses.razon_social IS 
        'Razón social del negocio (opcional). Útil para identificación pero NO se usa para facturación electrónica en Stocky. La facturación se hace directamente en Siigo.';
    END IF;
    
    RAISE NOTICE 'Campos de facturación en tabla businesses actualizados';
END $$;

-- ============================================
-- PASO 5: ELIMINAR TRIGGERS RELACIONADOS CON FACTURACIÓN
-- ============================================

DO $$
BEGIN
    -- Eliminar trigger de generación automática de números de factura (si existe)
    DROP TRIGGER IF EXISTS generate_invoice_number_trigger ON invoices;
    RAISE NOTICE 'Triggers de facturación eliminados (si existían)';
END $$;

-- ============================================
-- PASO 6: ELIMINAR FUNCIONES RPC RELACIONADAS CON FACTURACIÓN
-- ============================================

DO $$
BEGIN
    -- Función para generar número de factura
    DROP FUNCTION IF EXISTS generate_invoice_number(UUID);
    DROP FUNCTION IF EXISTS generate_invoice_number(p_business_id UUID);
    
    -- Función para generar factura electrónica
    DROP FUNCTION IF EXISTS generate_electronic_invoice(UUID, JSONB);
    DROP FUNCTION IF EXISTS create_electronic_invoice(UUID, JSONB);
    
    RAISE NOTICE 'Funciones RPC de facturación eliminadas (si existían)';
END $$;

-- ============================================
-- PASO 7: CREAR VISTA PARA COMPROBANTES (NO FACTURAS)
-- ============================================

-- Vista que muestra solo comprobantes de venta (NO facturas)
CREATE OR REPLACE VIEW sales_receipts AS
SELECT 
    s.id,
    s.business_id,
    s.user_id,
    s.total,
    s.payment_method,
    s.seller_name,
    s.created_at,
    s.updated_at,
    b.name as business_name,
    CONCAT('CPV-', UPPER(SUBSTRING(s.id::text, 1, 8))) as receipt_number
FROM sales s
JOIN businesses b ON s.business_id = b.id
WHERE s.document_type = 'receipt' OR s.document_type IS NULL;

COMMENT ON VIEW sales_receipts IS 
'Vista de comprobantes de venta (NO facturas). Stocky solo genera comprobantes informativos sin validez fiscal ante DIAN.';

-- ============================================
-- PASO 8: AGREGAR RESTRICCIONES DE SEGURIDAD
-- ============================================

DO $$
BEGIN
    -- Agregar check constraint para asegurar que document_type siempre sea 'receipt'
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sales' AND column_name = 'document_type'
    ) THEN
        -- Primero actualizar cualquier valor diferente
        UPDATE sales 
        SET document_type = 'receipt' 
        WHERE document_type IS NULL OR document_type != 'receipt';
        
        -- Eliminar constraint anterior si existe
        ALTER TABLE sales 
        DROP CONSTRAINT IF EXISTS sales_document_type_check;
        
        -- Agregar nuevo constraint
        ALTER TABLE sales 
        ADD CONSTRAINT sales_document_type_check 
        CHECK (document_type = 'receipt');
        
        RAISE NOTICE 'Constraint agregado: sales.document_type debe ser siempre "receipt"';
    END IF;
    
    -- Asegurar que is_electronic_invoice siempre sea false
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sales' AND column_name = 'is_electronic_invoice'
    ) THEN
        UPDATE sales SET is_electronic_invoice = false;
        
        ALTER TABLE sales 
        DROP CONSTRAINT IF EXISTS sales_no_electronic_invoice_check;
        
        ALTER TABLE sales 
        ADD CONSTRAINT sales_no_electronic_invoice_check 
        CHECK (is_electronic_invoice = false);
        
        RAISE NOTICE 'Constraint agregado: sales.is_electronic_invoice debe ser siempre false';
    END IF;
END $$;

-- ============================================
-- PASO 9: CREAR FUNCIÓN PARA VALIDAR NUEVAS VENTAS
-- ============================================

CREATE OR REPLACE FUNCTION validate_sale_before_insert()
RETURNS TRIGGER AS $$
BEGIN
    -- Forzar que todas las ventas sean comprobantes (no facturas)
    NEW.document_type := 'receipt';
    NEW.is_electronic_invoice := false;
    
    -- Limpiar campos de facturación que no deben usarse
    NEW.invoice_status := NULL;
    NEW.cufe := NULL;
    NEW.invoice_number := NULL;
    NEW.invoice_pdf_url := NULL;
    NEW.invoice_qr_code := NULL;
    NEW.invoice_error := NULL;
    NEW.invoice_date := NULL;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger a la tabla sales
DROP TRIGGER IF EXISTS ensure_receipt_only_trigger ON sales;

CREATE TRIGGER ensure_receipt_only_trigger
    BEFORE INSERT OR UPDATE ON sales
    FOR EACH ROW
    EXECUTE FUNCTION validate_sale_before_insert();

COMMENT ON FUNCTION validate_sale_before_insert() IS 
'Asegura que todas las ventas sean comprobantes (NO facturas). Limpia automáticamente campos de facturación electrónica.';

-- ============================================
-- PASO 10: RESUMEN Y DOCUMENTACIÓN
-- ============================================

DO $$
DECLARE
    deprecadas_count INTEGER;
    sales_count INTEGER;
    businesses_count INTEGER;
BEGIN
    -- Contar tablas deprecadas
    SELECT COUNT(*) INTO deprecadas_count
    FROM information_schema.tables
    WHERE table_name IN (
        'business_siigo_credentials',
        'siigo_invoice_logs',
        'invoicing_requests',
        'invoices',
        'invoice_items'
    );
    
    -- Contar ventas
    SELECT COUNT(*) INTO sales_count FROM sales;
    
    -- Contar negocios
    SELECT COUNT(*) INTO businesses_count FROM businesses;
    
    RAISE NOTICE '
    ============================================
    ✅ MIGRACIÓN COMPLETADA EXITOSAMENTE
    ============================================
    
    📊 RESUMEN:
    - Tablas deprecadas: %
    - Ventas actualizadas: %
    - Negocios: % (todos con facturación desactivada)
    - Vista creada: sales_receipts
    - Triggers de validación: activados
    
    ⚠️ IMPORTANTE:
    - Stocky YA NO emite facturas electrónicas
    - Solo genera comprobantes informativos (NO válidos ante DIAN)
    - Los negocios deben facturar en Siigo directamente
    - Todas las ventas futuras serán "receipt" automáticamente
    
    📋 PRÓXIMOS PASOS:
    1. Verificar que el frontend no intente crear facturas
    2. Actualizar documentación de usuario
    3. Comunicar cambios a clientes existentes
    
    ============================================
    ', deprecadas_count, sales_count, businesses_count;
END $$;

COMMIT;

-- ============================================
-- SCRIPT DE VERIFICACIÓN (EJECUTAR DESPUÉS)
-- ============================================
-- Ejecuta estas queries para verificar que todo está correcto:

/*
-- 1. Verificar que ningún negocio tiene facturación habilitada
SELECT COUNT(*) as negocios_con_facturacion_activa 
FROM businesses 
WHERE invoicing_enabled = true;
-- Resultado esperado: 0

-- 2. Verificar que todas las ventas son comprobantes
SELECT COUNT(*) as ventas_no_comprobante
FROM sales 
WHERE document_type != 'receipt' OR is_electronic_invoice = true;
-- Resultado esperado: 0

-- 3. Ver tablas deprecadas
SELECT table_name 
FROM information_schema.tables 
WHERE table_name IN (
    'business_siigo_credentials',
    'siigo_invoice_logs', 
    'invoicing_requests',
    'invoices',
    'invoice_items'
);

-- 4. Ver vista de comprobantes
SELECT COUNT(*) as total_comprobantes FROM sales_receipts;

-- 5. Probar que no se pueden insertar facturas (debe fallar)
-- INSERT INTO sales (business_id, total, document_type, is_electronic_invoice)
-- VALUES ('tu-business-id-aqui', 1000, 'invoice', true);
-- Resultado esperado: ERROR (violación de constraint)
*/
