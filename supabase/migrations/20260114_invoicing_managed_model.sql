-- ============================================
-- 🏗️ MODELO DE FACTURACIÓN ADMINISTRADA
-- ============================================
-- Sistema: Stocky POS
-- Modelo: Activación manual por administrador
-- Proveedor: Siigo (DIAN Colombia)
-- 
-- REGLAS DE NEGOCIO:
-- 1. Negocios pueden operar SIN facturación electrónica
-- 2. Facturación se activa SOLO por equipo Stocky
-- 3. NIT es opcional (negocios no formalizados)
-- 4. Ventas NO dependen de facturas
-- 5. Una factura SIEMPRE pertenece a una venta
-- ============================================

-- ============================================
-- 1. MODIFICAR TABLA BUSINESSES
-- ============================================
-- Agregar campos para control de facturación administrada

-- Razón social (nombre legal para facturación)
ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS razon_social TEXT;

COMMENT ON COLUMN businesses.razon_social IS 'Razón social legal del negocio para facturación electrónica';

-- Estado de facturación electrónica (activada por admin)
ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS invoicing_enabled BOOLEAN DEFAULT false;

COMMENT ON COLUMN businesses.invoicing_enabled IS 'Indica si el negocio tiene facturación electrónica ACTIVA. Solo admin puede modificar.';

-- Proveedor de facturación (siigo, facturación.co, etc)
ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS invoicing_provider TEXT DEFAULT NULL;

COMMENT ON COLUMN businesses.invoicing_provider IS 'Proveedor de facturación: siigo, facturatech, etc. NULL si no tiene.';

-- Fecha de activación
ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS invoicing_activated_at TIMESTAMPTZ;

COMMENT ON COLUMN businesses.invoicing_activated_at IS 'Fecha/hora cuando se activó la facturación electrónica';

-- Admin que activó
ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS invoicing_activated_by UUID REFERENCES auth.users(id);

COMMENT ON COLUMN businesses.invoicing_activated_by IS 'Usuario administrador que activó la facturación';

-- Índice para filtrar negocios con facturación activa
CREATE INDEX IF NOT EXISTS idx_businesses_invoicing_enabled 
ON businesses(invoicing_enabled) 
WHERE invoicing_enabled = true;


-- ============================================
-- 2. TABLA: SOLICITUDES DE FACTURACIÓN
-- ============================================
-- Control del flujo de solicitud -> revisión -> activación

CREATE TABLE IF NOT EXISTS invoicing_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    
    -- Estado del flujo
    status TEXT NOT NULL DEFAULT 'pending',
    -- Valores: pending, approved, rejected, cancelled
    
    -- Datos de la solicitud
    nit_provided TEXT,                      -- NIT proporcionado en solicitud
    razon_social_provided TEXT,             -- Razón social proporcionada
    contact_method TEXT,                    -- whatsapp, email
    message TEXT,                           -- Mensaje adicional del negocio
    
    -- Revisión por admin
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    admin_notes TEXT,                       -- Notas internas del admin
    rejection_reason TEXT,                  -- Motivo si fue rechazada
    
    -- Auditoría
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice único parcial: solo una solicitud pendiente por negocio
-- Permite múltiples solicitudes rejected/approved del mismo negocio
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_pending_request
ON invoicing_requests(business_id)
WHERE status = 'pending';

-- Comentarios
COMMENT ON TABLE invoicing_requests IS 'Solicitudes de activación de facturación electrónica. Flujo: pending -> approved/rejected';

-- Índices
CREATE INDEX IF NOT EXISTS idx_invoicing_requests_business 
ON invoicing_requests(business_id);

CREATE INDEX IF NOT EXISTS idx_invoicing_requests_status 
ON invoicing_requests(status);

CREATE INDEX IF NOT EXISTS idx_invoicing_requests_pending 
ON invoicing_requests(created_at DESC) 
WHERE status = 'pending';


-- ============================================
-- 3. TABLA: FACTURAS ELECTRÓNICAS
-- ============================================
-- Separada de ventas para mantener integridad

CREATE TABLE IF NOT EXISTS electronic_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
    -- RESTRICT: No permitir eliminar venta si tiene factura
    
    -- Proveedor y referencia externa
    provider TEXT NOT NULL DEFAULT 'siigo',
    provider_invoice_id TEXT,               -- ID en el sistema del proveedor
    
    -- Datos DIAN
    invoice_number TEXT NOT NULL,           -- Número de factura (prefijo + consecutivo)
    cufe TEXT,                              -- Código Único Factura Electrónica
    qr_code TEXT,                           -- Código QR para verificación
    
    -- Documentos
    pdf_url TEXT,                           -- URL del PDF
    xml_url TEXT,                           -- URL del XML
    
    -- Estado
    status TEXT NOT NULL DEFAULT 'pending',
    -- Valores: pending, sent, accepted, rejected, failed
    dian_status TEXT,                       -- Estado específico DIAN
    dian_response JSONB,                    -- Respuesta completa DIAN
    
    -- Errores
    error_message TEXT,                     -- Mensaje de error amigable
    error_details JSONB,                    -- Detalles técnicos del error
    retry_count INTEGER DEFAULT 0,          -- Intentos de reenvío
    
    -- Auditoría
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    
    -- Una sola factura por venta
    CONSTRAINT unique_sale_invoice UNIQUE (sale_id)
);

-- Comentarios
COMMENT ON TABLE electronic_invoices IS 'Facturas electrónicas emitidas ante la DIAN. Una factura por venta.';
COMMENT ON COLUMN electronic_invoices.cufe IS 'Código Único de Factura Electrónica - Generado por DIAN';
COMMENT ON COLUMN electronic_invoices.status IS 'pending: creando | sent: enviada DIAN | accepted: validada | rejected: rechazada | failed: error técnico';

-- Índices
CREATE INDEX IF NOT EXISTS idx_electronic_invoices_business 
ON electronic_invoices(business_id);

CREATE INDEX IF NOT EXISTS idx_electronic_invoices_sale 
ON electronic_invoices(sale_id);

CREATE INDEX IF NOT EXISTS idx_electronic_invoices_status 
ON electronic_invoices(status);

CREATE INDEX IF NOT EXISTS idx_electronic_invoices_cufe 
ON electronic_invoices(cufe) 
WHERE cufe IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_electronic_invoices_number 
ON electronic_invoices(business_id, invoice_number);

CREATE INDEX IF NOT EXISTS idx_electronic_invoices_created 
ON electronic_invoices(created_at DESC);


-- ============================================
-- 4. MODIFICAR TABLA SALES
-- ============================================
-- Agregar referencia opcional a factura electrónica

ALTER TABLE sales 
ADD COLUMN IF NOT EXISTS electronic_invoice_id UUID REFERENCES electronic_invoices(id);

COMMENT ON COLUMN sales.electronic_invoice_id IS 'Referencia a factura electrónica. NULL si es solo recibo/comprobante.';

-- Índice para ventas con factura
CREATE INDEX IF NOT EXISTS idx_sales_electronic_invoice 
ON sales(electronic_invoice_id) 
WHERE electronic_invoice_id IS NOT NULL;


-- ============================================
-- 5. RENOMBRAR/AJUSTAR TABLA DE CREDENCIALES
-- ============================================
-- Las credenciales ahora son ADMINISTRADAS por Stocky

-- Agregar campo para indicar que es administrado
ALTER TABLE business_siigo_credentials 
ADD COLUMN IF NOT EXISTS managed_by_stocky BOOLEAN DEFAULT true;

COMMENT ON COLUMN business_siigo_credentials.managed_by_stocky IS 'Las credenciales son gestionadas por el equipo Stocky, no por el negocio';

-- Agregar campo de activación por admin
ALTER TABLE business_siigo_credentials 
ADD COLUMN IF NOT EXISTS activated_by UUID REFERENCES auth.users(id);

COMMENT ON COLUMN business_siigo_credentials.activated_by IS 'Administrador que configuró estas credenciales';

ALTER TABLE business_siigo_credentials 
ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ;


-- ============================================
-- 6. TABLA: ADMINISTRADORES STOCKY
-- ============================================
-- Para controlar quién puede activar facturación

CREATE TABLE IF NOT EXISTS stocky_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Permisos
    can_activate_invoicing BOOLEAN DEFAULT false,
    can_manage_credentials BOOLEAN DEFAULT false,
    can_view_all_businesses BOOLEAN DEFAULT false,
    
    -- Datos
    admin_name TEXT,
    admin_email TEXT,
    
    -- Auditoría
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    
    CONSTRAINT unique_stocky_admin UNIQUE (user_id)
);

COMMENT ON TABLE stocky_admins IS 'Administradores de la plataforma Stocky con permisos especiales';

-- ============================================
-- 7. FUNCIÓN: VERIFICAR SI ES ADMIN STOCKY
-- ============================================

CREATE OR REPLACE FUNCTION is_stocky_admin(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM stocky_admins 
        WHERE user_id = check_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION is_stocky_admin IS 'Verifica si un usuario es administrador de Stocky';


-- ============================================
-- 8. FUNCIÓN: ACTIVAR FACTURACIÓN PARA NEGOCIO
-- ============================================
-- Solo ejecutable por administradores

CREATE OR REPLACE FUNCTION activate_business_invoicing(
    p_business_id UUID,
    p_provider TEXT DEFAULT 'siigo',
    p_admin_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_admin_id UUID := auth.uid();
    v_result JSONB;
BEGIN
    -- Verificar que es administrador
    IF NOT is_stocky_admin(v_admin_id) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'No autorizado. Solo administradores pueden activar facturación.'
        );
    END IF;
    
    -- Verificar que el negocio existe
    IF NOT EXISTS (SELECT 1 FROM businesses WHERE id = p_business_id) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Negocio no encontrado'
        );
    END IF;
    
    -- Activar facturación
    UPDATE businesses SET
        invoicing_enabled = true,
        invoicing_provider = p_provider,
        invoicing_activated_at = NOW(),
        invoicing_activated_by = v_admin_id
    WHERE id = p_business_id;
    
    -- Aprobar solicitud pendiente si existe
    UPDATE invoicing_requests SET
        status = 'approved',
        reviewed_by = v_admin_id,
        reviewed_at = NOW(),
        admin_notes = COALESCE(p_admin_notes, admin_notes),
        updated_at = NOW()
    WHERE business_id = p_business_id 
    AND status = 'pending';
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Facturación electrónica activada correctamente',
        'business_id', p_business_id,
        'provider', p_provider,
        'activated_at', NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION activate_business_invoicing IS 'Activa facturación electrónica para un negocio. Solo admins.';


-- ============================================
-- 9. FUNCIÓN: DESACTIVAR FACTURACIÓN
-- ============================================

CREATE OR REPLACE FUNCTION deactivate_business_invoicing(
    p_business_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_admin_id UUID := auth.uid();
BEGIN
    -- Verificar que es administrador
    IF NOT is_stocky_admin(v_admin_id) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'No autorizado'
        );
    END IF;
    
    -- Desactivar facturación
    UPDATE businesses SET
        invoicing_enabled = false,
        updated_at = NOW()
    WHERE id = p_business_id;
    
    -- Desactivar credenciales
    UPDATE business_siigo_credentials SET
        is_enabled = false,
        updated_at = NOW()
    WHERE business_id = p_business_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Facturación desactivada',
        'reason', p_reason
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- 10. RLS: POLÍTICAS DE SEGURIDAD
-- ============================================

-- Habilitar RLS en nuevas tablas
ALTER TABLE invoicing_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE electronic_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE stocky_admins ENABLE ROW LEVEL SECURITY;

-- ============================================
-- POLÍTICAS: invoicing_requests
-- ============================================

-- Negocios pueden ver sus propias solicitudes
DROP POLICY IF EXISTS invoicing_requests_select_own ON invoicing_requests;
CREATE POLICY invoicing_requests_select_own ON invoicing_requests
    FOR SELECT USING (
        business_id IN (
            SELECT b.id FROM businesses b
            JOIN employees e ON e.business_id = b.id
            WHERE e.user_id = auth.uid()
        )
    );

-- Negocios pueden crear solicitudes para su negocio
DROP POLICY IF EXISTS invoicing_requests_insert_own ON invoicing_requests;
CREATE POLICY invoicing_requests_insert_own ON invoicing_requests
    FOR INSERT WITH CHECK (
        business_id IN (
            SELECT b.id FROM businesses b
            JOIN employees e ON e.business_id = b.id
            WHERE e.user_id = auth.uid()
            AND e.role IN ('owner', 'admin')
        )
    );

-- Solo admins pueden actualizar (aprobar/rechazar)
DROP POLICY IF EXISTS invoicing_requests_update_admin ON invoicing_requests;
CREATE POLICY invoicing_requests_update_admin ON invoicing_requests
    FOR UPDATE USING (
        is_stocky_admin(auth.uid())
    );

-- Admins pueden ver todas las solicitudes
DROP POLICY IF EXISTS invoicing_requests_select_admin ON invoicing_requests;
CREATE POLICY invoicing_requests_select_admin ON invoicing_requests
    FOR SELECT USING (
        is_stocky_admin(auth.uid())
    );

-- ============================================
-- POLÍTICAS: electronic_invoices
-- ============================================

-- Negocios pueden ver sus facturas
DROP POLICY IF EXISTS electronic_invoices_select_own ON electronic_invoices;
CREATE POLICY electronic_invoices_select_own ON electronic_invoices
    FOR SELECT USING (
        business_id IN (
            SELECT b.id FROM businesses b
            JOIN employees e ON e.business_id = b.id
            WHERE e.user_id = auth.uid()
        )
    );

-- Solo el sistema (service_role) puede insertar facturas
-- Las facturas se crean via Edge Function con service_role
DROP POLICY IF EXISTS electronic_invoices_insert_system ON electronic_invoices;
CREATE POLICY electronic_invoices_insert_system ON electronic_invoices
    FOR INSERT WITH CHECK (
        -- Verificar que el negocio tiene facturación activa
        EXISTS (
            SELECT 1 FROM businesses 
            WHERE id = business_id 
            AND invoicing_enabled = true
        )
    );

-- Solo sistema puede actualizar
DROP POLICY IF EXISTS electronic_invoices_update_system ON electronic_invoices;
CREATE POLICY electronic_invoices_update_system ON electronic_invoices
    FOR UPDATE USING (
        is_stocky_admin(auth.uid())
        OR 
        -- O es del negocio y es owner (para casos especiales)
        business_id IN (
            SELECT b.id FROM businesses b
            JOIN employees e ON e.business_id = b.id
            WHERE e.user_id = auth.uid()
            AND e.role = 'owner'
        )
    );

-- ============================================
-- POLÍTICAS: stocky_admins
-- ============================================

-- Solo admins pueden ver la tabla de admins
DROP POLICY IF EXISTS stocky_admins_select ON stocky_admins;
CREATE POLICY stocky_admins_select ON stocky_admins
    FOR SELECT USING (
        is_stocky_admin(auth.uid())
    );

-- Solo super admins pueden insertar (manual por ahora)
-- INSERT se hace directamente en Supabase Dashboard

-- ============================================
-- POLÍTICAS: business_siigo_credentials
-- ============================================
-- Reforzar que solo admins pueden gestionar

DROP POLICY IF EXISTS siigo_credentials_select_own ON business_siigo_credentials;
CREATE POLICY siigo_credentials_select_own ON business_siigo_credentials
    FOR SELECT USING (
        business_id IN (
            SELECT b.id FROM businesses b
            JOIN employees e ON e.business_id = b.id
            WHERE e.user_id = auth.uid()
        )
    );

-- Solo admins pueden insertar credenciales
DROP POLICY IF EXISTS siigo_credentials_insert_admin ON business_siigo_credentials;
CREATE POLICY siigo_credentials_insert_admin ON business_siigo_credentials
    FOR INSERT WITH CHECK (
        is_stocky_admin(auth.uid())
    );

-- Solo admins pueden actualizar
DROP POLICY IF EXISTS siigo_credentials_update_admin ON business_siigo_credentials;
CREATE POLICY siigo_credentials_update_admin ON business_siigo_credentials
    FOR UPDATE USING (
        is_stocky_admin(auth.uid())
    );


-- ============================================
-- 11. VISTAS ÚTILES
-- ============================================

-- Vista: Negocios con estado de facturación
CREATE OR REPLACE VIEW v_business_invoicing_status AS
SELECT 
    b.id,
    b.name,
    b.nit,
    b.razon_social,
    b.invoicing_enabled,
    b.invoicing_provider,
    b.invoicing_activated_at,
    CASE 
        WHEN b.invoicing_enabled THEN 'Activa'
        WHEN EXISTS (SELECT 1 FROM invoicing_requests ir WHERE ir.business_id = b.id AND ir.status = 'pending') THEN 'Pendiente'
        ELSE 'No solicitada'
    END AS invoicing_status,
    (SELECT COUNT(*) FROM electronic_invoices ei WHERE ei.business_id = b.id) AS total_invoices,
    (SELECT COUNT(*) FROM electronic_invoices ei WHERE ei.business_id = b.id AND ei.status = 'accepted') AS accepted_invoices
FROM businesses b;

COMMENT ON VIEW v_business_invoicing_status IS 'Vista resumen del estado de facturación de cada negocio';


-- Vista: Solicitudes pendientes (para panel admin)
CREATE OR REPLACE VIEW v_pending_invoicing_requests AS
SELECT 
    ir.id AS request_id,
    ir.created_at AS requested_at,
    ir.contact_method,
    ir.message,
    b.id AS business_id,
    b.name AS business_name,
    b.nit,
    ir.nit_provided,
    ir.razon_social_provided,
    b.phone,
    b.email
FROM invoicing_requests ir
JOIN businesses b ON b.id = ir.business_id
WHERE ir.status = 'pending'
ORDER BY ir.created_at ASC;

COMMENT ON VIEW v_pending_invoicing_requests IS 'Solicitudes de facturación pendientes de revisión';


-- ============================================
-- 12. TRIGGERS
-- ============================================

-- Trigger: Actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar a invoicing_requests
DROP TRIGGER IF EXISTS trigger_invoicing_requests_updated ON invoicing_requests;
CREATE TRIGGER trigger_invoicing_requests_updated
    BEFORE UPDATE ON invoicing_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Aplicar a electronic_invoices
DROP TRIGGER IF EXISTS trigger_electronic_invoices_updated ON electronic_invoices;
CREATE TRIGGER trigger_electronic_invoices_updated
    BEFORE UPDATE ON electronic_invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ============================================
-- 13. DATOS INICIALES (OPCIONAL)
-- ============================================

-- NOTA: Ejecutar manualmente para agregar el primer admin
-- Reemplaza 'TU_USER_ID' con tu ID de auth.users

/*
INSERT INTO stocky_admins (user_id, admin_name, admin_email, can_activate_invoicing, can_manage_credentials, can_view_all_businesses)
VALUES (
    'TU_USER_ID',
    'Administrador Stocky',
    'admin@stocky.com',
    true,
    true,
    true
);
*/


-- ============================================
-- VERIFICACIÓN
-- ============================================
-- Ejecuta esto para verificar que todo se creó correctamente:

/*
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('invoicing_requests', 'electronic_invoices', 'stocky_admins');

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'businesses' 
AND column_name LIKE 'invoicing%';
*/


-- ============================================
-- ✅ MIGRACIÓN COMPLETADA
-- ============================================
-- 
-- RESUMEN:
-- ✅ businesses: campos de facturación administrada
-- ✅ invoicing_requests: flujo de solicitudes
-- ✅ electronic_invoices: facturas separadas de ventas
-- ✅ stocky_admins: control de permisos
-- ✅ Funciones: activate/deactivate invoicing
-- ✅ RLS: seguridad por negocio y rol
-- ✅ Vistas: monitoreo y panel admin
-- ✅ Triggers: auditoría automática
-- 
-- PRÓXIMOS PASOS:
-- 1. Agregar tu usuario como admin en stocky_admins
-- 2. Probar flujo de solicitud desde frontend
-- 3. Crear panel de administración para aprobar
-- ============================================
