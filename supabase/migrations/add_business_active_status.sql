-- ========================================
-- AGREGAR COLUMNA is_active A TABLA businesses
-- ========================================
-- Esta columna permite deshabilitar temporalmente negocios
-- que no han realizado el pago mensual

-- Agregar columna is_active (por defecto true para negocios existentes)
ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Crear índice para mejorar performance en consultas
CREATE INDEX IF NOT EXISTS idx_businesses_is_active ON businesses(is_active);

-- Comentario en la columna
COMMENT ON COLUMN businesses.is_active IS 'Indica si el negocio está activo. Se deshabilita por falta de pago.';

-- ========================================
-- COMANDOS DE ADMINISTRACIÓN
-- ========================================

-- Para deshabilitar un negocio (cuando no pague):
-- UPDATE businesses SET is_active = false WHERE id = 'uuid-del-negocio';

-- Para reactivar un negocio (después del pago):
-- UPDATE businesses SET is_active = true WHERE id = 'uuid-del-negocio';

-- Para ver todos los negocios deshabilitados:
-- SELECT id, name, owner_name, created_at FROM businesses WHERE is_active = false;
