-- ============================================
-- AGREGAR COLUMNA NIT A TABLA businesses
-- ============================================
-- Fecha: 2026-01-14
-- Descripcion: Agrega campo NIT opcional para negocios

-- Agregar columna NIT (opcional)
ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS nit TEXT;

-- Comentario descriptivo
COMMENT ON COLUMN businesses.nit IS 'NIT del negocio (opcional). Formato: 900.123.456-7';

-- Indice para busquedas por NIT (opcional, solo si necesitas buscar por NIT)
-- CREATE INDEX IF NOT EXISTS idx_businesses_nit ON businesses(nit) WHERE nit IS NOT NULL;

-- ============================================
-- VERIFICACION
-- ============================================
-- Ejecuta esto para verificar que la columna fue creada:
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'businesses' AND column_name = 'nit';
