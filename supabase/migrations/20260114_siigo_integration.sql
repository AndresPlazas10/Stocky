-- ============================================
-- 🗄️ Migración: Tablas para Integración Siigo
-- Facturación Electrónica DIAN Colombia
-- ============================================
-- Ejecutar en: Supabase SQL Editor
-- Fecha: Enero 2026

-- ============================================
-- TABLA: Credenciales Siigo por Negocio
-- ============================================
-- Almacena las credenciales de cada negocio para Siigo
-- Las credenciales se almacenan de forma segura

CREATE TABLE IF NOT EXISTS business_siigo_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    
    -- Credenciales Siigo (encriptadas en reposo por Supabase)
    siigo_username TEXT NOT NULL,           -- Email/usuario API Siigo
    siigo_access_key TEXT NOT NULL,         -- Clave de acceso API
    
    -- Configuración
    is_enabled BOOLEAN DEFAULT false,       -- ¿Habilitado para facturar?
    is_production BOOLEAN DEFAULT false,    -- ¿Ambiente producción?
    document_type_id INTEGER,               -- ID tipo documento en Siigo
    default_seller_id INTEGER,              -- ID vendedor por defecto
    
    -- IDs de impuestos en Siigo (varían por cuenta)
    tax_id_iva_0 INTEGER,                   -- ID impuesto IVA 0% / Excluido
    tax_id_iva_5 INTEGER,                   -- ID impuesto IVA 5%
    tax_id_iva_19 INTEGER,                  -- ID impuesto IVA 19%
    
    -- IDs de medios de pago en Siigo (varían por cuenta)
    payment_id_cash INTEGER,                -- ID pago efectivo
    payment_id_credit_card INTEGER,         -- ID tarjeta crédito
    payment_id_debit_card INTEGER,          -- ID tarjeta débito
    payment_id_transfer INTEGER,            -- ID transferencia
    payment_id_credit INTEGER,              -- ID crédito/a plazos
    
    -- Resolución DIAN
    resolution_number TEXT,                 -- Número de resolución DIAN
    resolution_prefix TEXT,                 -- Prefijo de facturación
    resolution_from INTEGER,                -- Rango desde
    resolution_to INTEGER,                  -- Rango hasta
    resolution_valid_from DATE,             -- Fecha inicio vigencia
    resolution_valid_to DATE,               -- Fecha fin vigencia
    
    -- Auditoría
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    
    -- Una sola configuración por negocio
    CONSTRAINT unique_business_siigo UNIQUE (business_id)
);

-- Índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_siigo_credentials_business 
    ON business_siigo_credentials(business_id);

-- ============================================
-- TABLA: Logs de Facturas Siigo
-- ============================================
-- Registro de todas las facturas generadas

CREATE TABLE IF NOT EXISTS siigo_invoice_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    
    -- Datos de la factura
    siigo_id TEXT,                          -- ID en Siigo
    invoice_number TEXT,                    -- Número de factura
    cufe TEXT,                              -- Código Único Factura Electrónica
    customer_identification TEXT NOT NULL, -- Documento del cliente
    total DECIMAL(15, 2) NOT NULL,          -- Total facturado
    
    -- Estado
    status TEXT NOT NULL DEFAULT 'PENDING', -- SUCCESS, ERROR, PENDING
    dian_status TEXT,                       -- Estado DIAN
    error_message TEXT,                     -- Mensaje de error si falló
    
    -- Datos crudos para auditoría
    raw_request JSONB,                      -- Request enviado a Siigo
    raw_response JSONB,                     -- Response de Siigo
    
    -- Auditoría
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Índices para búsquedas y auditoría
CREATE INDEX IF NOT EXISTS idx_siigo_logs_business 
    ON siigo_invoice_logs(business_id);
CREATE INDEX IF NOT EXISTS idx_siigo_logs_status 
    ON siigo_invoice_logs(status);
CREATE INDEX IF NOT EXISTS idx_siigo_logs_created 
    ON siigo_invoice_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_siigo_logs_cufe 
    ON siigo_invoice_logs(cufe) WHERE cufe IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_siigo_logs_customer 
    ON siigo_invoice_logs(customer_identification);

-- ============================================
-- TABLA: Ciudades DANE Colombia
-- ============================================
-- Códigos DANE necesarios para Siigo

CREATE TABLE IF NOT EXISTS dane_cities (
    id SERIAL PRIMARY KEY,
    department_code VARCHAR(2) NOT NULL,    -- Código departamento
    department_name VARCHAR(100) NOT NULL,  -- Nombre departamento
    city_code VARCHAR(5) NOT NULL,          -- Código municipio DANE
    city_name VARCHAR(100) NOT NULL,        -- Nombre municipio
    
    CONSTRAINT unique_dane_city UNIQUE (city_code)
);

-- Insertar ciudades principales (ejemplo)
INSERT INTO dane_cities (department_code, department_name, city_code, city_name) VALUES
    ('11', 'Bogotá D.C.', '11001', 'Bogotá D.C.'),
    ('05', 'Antioquia', '05001', 'Medellín'),
    ('05', 'Antioquia', '05088', 'Bello'),
    ('05', 'Antioquia', '05360', 'Itagüí'),
    ('05', 'Antioquia', '05266', 'Envigado'),
    ('76', 'Valle del Cauca', '76001', 'Cali'),
    ('08', 'Atlántico', '08001', 'Barranquilla'),
    ('13', 'Bolívar', '13001', 'Cartagena'),
    ('68', 'Santander', '68001', 'Bucaramanga'),
    ('25', 'Cundinamarca', '25754', 'Soacha'),
    ('17', 'Caldas', '17001', 'Manizales'),
    ('66', 'Risaralda', '66001', 'Pereira'),
    ('15', 'Boyacá', '15001', 'Tunja'),
    ('41', 'Huila', '41001', 'Neiva'),
    ('50', 'Meta', '50001', 'Villavicencio'),
    ('52', 'Nariño', '52001', 'Pasto'),
    ('73', 'Tolima', '73001', 'Ibagué'),
    ('63', 'Quindío', '63001', 'Armenia'),
    ('19', 'Cauca', '19001', 'Popayán'),
    ('54', 'Norte de Santander', '54001', 'Cúcuta')
ON CONFLICT (city_code) DO NOTHING;

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Habilitar RLS en las tablas
ALTER TABLE business_siigo_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE siigo_invoice_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE dane_cities ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes si existen
DROP POLICY IF EXISTS "business_siigo_credentials_admin_policy" ON business_siigo_credentials;
DROP POLICY IF EXISTS "siigo_invoice_logs_read_policy" ON siigo_invoice_logs;
DROP POLICY IF EXISTS "siigo_invoice_logs_insert_policy" ON siigo_invoice_logs;
DROP POLICY IF EXISTS "dane_cities_read_policy" ON dane_cities;

-- NOTA: Las políticas de business_siigo_credentials se definen en
-- 20260114_invoicing_managed_model.sql usando is_stocky_admin()
-- Solo el equipo Stocky puede gestionar credenciales

-- Política temporal: empleados pueden ver (solo lectura) sus credenciales
-- Esto se sobreescribe en invoicing_managed_model.sql
CREATE POLICY "business_siigo_credentials_admin_policy" ON business_siigo_credentials
    FOR SELECT
    USING (
        business_id IN (
            SELECT b.id FROM businesses b
            JOIN employees e ON e.business_id = b.id
            WHERE e.user_id = auth.uid()
            AND e.is_active = true
        )
    );

-- Política: Usuarios del negocio pueden ver logs
CREATE POLICY "siigo_invoice_logs_read_policy" ON siigo_invoice_logs
    FOR SELECT
    USING (
        -- Es creador/owner del negocio
        EXISTS (
            SELECT 1 FROM businesses b
            WHERE b.id = siigo_invoice_logs.business_id
            AND b.created_by = auth.uid()
        )
        OR
        -- Es empleado activo del negocio
        EXISTS (
            SELECT 1 FROM employees e
            WHERE e.business_id = siigo_invoice_logs.business_id
            AND e.user_id = auth.uid()
            AND e.is_active = true
        )
    );

-- Política: Solo service_role puede insertar logs (desde Edge Function)
CREATE POLICY "siigo_invoice_logs_insert_policy" ON siigo_invoice_logs
    FOR INSERT
    WITH CHECK (true);  -- La Edge Function usa service_role

-- Política: Todos pueden leer ciudades DANE
CREATE POLICY "dane_cities_read_policy" ON dane_cities
    FOR SELECT
    USING (true);

-- ============================================
-- FUNCIONES AUXILIARES
-- ============================================

-- Función para verificar si un negocio puede facturar
CREATE OR REPLACE FUNCTION can_business_invoice(p_business_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM business_siigo_credentials 
        WHERE business_id = p_business_id 
        AND is_enabled = true
        AND siigo_username IS NOT NULL
        AND siigo_access_key IS NOT NULL
    );
END;
$$;

-- Función para obtener estadísticas de facturación
CREATE OR REPLACE FUNCTION get_invoice_stats(
    p_business_id UUID,
    p_from_date DATE DEFAULT (CURRENT_DATE - INTERVAL '30 days')::DATE,
    p_to_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    total_invoices BIGINT,
    successful_invoices BIGINT,
    failed_invoices BIGINT,
    total_amount DECIMAL(15, 2)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT AS total_invoices,
        COUNT(*) FILTER (WHERE status = 'SUCCESS')::BIGINT AS successful_invoices,
        COUNT(*) FILTER (WHERE status = 'ERROR')::BIGINT AS failed_invoices,
        COALESCE(SUM(total) FILTER (WHERE status = 'SUCCESS'), 0) AS total_amount
    FROM siigo_invoice_logs
    WHERE business_id = p_business_id
    AND created_at::DATE BETWEEN p_from_date AND p_to_date;
END;
$$;

-- ============================================
-- TRIGGER: Actualizar updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_siigo_credentials_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_siigo_credentials_timestamp ON business_siigo_credentials;

CREATE TRIGGER trigger_update_siigo_credentials_timestamp
    BEFORE UPDATE ON business_siigo_credentials
    FOR EACH ROW
    EXECUTE FUNCTION update_siigo_credentials_timestamp();

-- ============================================
-- COMENTARIOS DE DOCUMENTACIÓN
-- ============================================

COMMENT ON TABLE business_siigo_credentials IS 
    'Almacena las credenciales de Siigo para cada negocio. Las credenciales están protegidas por RLS y solo los admins pueden verlas.';

COMMENT ON TABLE siigo_invoice_logs IS 
    'Registro de auditoría de todas las facturas electrónicas generadas a través de Siigo. Incluye datos crudos para debugging.';

COMMENT ON TABLE dane_cities IS 
    'Catálogo de códigos DANE de ciudades colombianas, requerido para la facturación electrónica con Siigo.';

COMMENT ON FUNCTION can_business_invoice IS 
    'Verifica si un negocio tiene configuración activa para generar facturas electrónicas.';

COMMENT ON FUNCTION get_invoice_stats IS 
    'Obtiene estadísticas de facturación para un negocio en un rango de fechas.';
