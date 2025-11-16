-- ============================================
-- 🔓 SOLUCIÓN RÁPIDA - DESHABILITAR RLS TEMPORALMENTE
-- ============================================
-- Ejecutar SOLO estas líneas para acceso inmediato

-- OPCIÓN 1: Deshabilitar RLS en businesses (MÁS RÁPIDO)
ALTER TABLE businesses DISABLE ROW LEVEL SECURITY;

-- OPCIÓN 2: Si prefieres mantener seguridad, ejecuta esto en su lugar:
-- DROP POLICY IF EXISTS "Users can view their business" ON businesses;
-- CREATE POLICY "Users can view their business"
-- ON businesses FOR SELECT
-- TO authenticated
-- USING (true);  -- Permite ver todos los negocios a usuarios autenticados
