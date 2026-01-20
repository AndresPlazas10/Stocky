-- =====================================================
-- FIX: Agregar search_path a funciones restantes
-- =====================================================
-- Fecha: 19 enero 2026
-- Complemento de 20260119_fix_security_warnings.sql
-- =====================================================

-- Función: is_stocky_admin
CREATE OR REPLACE FUNCTION is_stocky_admin(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM stocky_admins 
        WHERE user_id = check_user_id
    );
END;
$$;

-- Función: activate_business_invoicing
CREATE OR REPLACE FUNCTION activate_business_invoicing(
    p_business_id UUID,
    p_provider TEXT DEFAULT 'siigo',
    p_admin_notes TEXT DEFAULT NULL
)
RETURNS JSONB 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- Función: deactivate_business_invoicing
CREATE OR REPLACE FUNCTION deactivate_business_invoicing(
    p_business_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- =====================================================
-- RESULTADO
-- =====================================================
-- ✅ 3 funciones más con search_path = public
-- Total: 6 funciones corregidas (3 en anterior + 3 aquí)
-- 
-- FUNCIONES RESTANTES (no en migraciones):
-- Las siguientes funciones existen en la DB pero NO están 
-- en las migraciones (creadas manualmente o por triggers):
-- - check_email_has_access (2 versiones)
-- - cleanup_expired_idempotency_requests
-- - increase_stock (2 versiones)
-- - prevent_duplicate_business_creation
-- - prevent_duplicate_employee_creation
-- - reduce_stock (2 versiones)
-- - update_purchase_total
-- - user_has_business_access (2 versiones)
--
-- Estas requieren actualización manual en Supabase SQL Editor.
-- =====================================================
