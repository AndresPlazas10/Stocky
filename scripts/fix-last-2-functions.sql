-- =====================================================
-- FIX FINAL: 2 funciones restantes
-- =====================================================

-- 1. check_email_has_access(user_email text)
CREATE OR REPLACE FUNCTION check_email_has_access(user_email TEXT)
RETURNS BOOLEAN 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar si existe en businesses
  IF EXISTS (SELECT 1 FROM businesses WHERE email = user_email) THEN
    RETURN true;
  END IF;
  
  -- Verificar si existe en employee_invitations aprobadas
  IF EXISTS (
    SELECT 1 FROM employee_invitations 
    WHERE email = user_email AND is_approved = true
  ) THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;

-- 2. user_has_business_access(business_uuid, business_email, business_created_by)
CREATE OR REPLACE FUNCTION user_has_business_access(
  business_uuid UUID,
  business_email TEXT,
  business_created_by UUID
)
RETURNS BOOLEAN 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar si el usuario creó el negocio
  IF business_created_by = auth.uid() THEN
    RETURN TRUE;
  END IF;
  
  -- Verificar si el email del negocio coincide
  IF business_email = auth.jwt()->>'email' THEN
    RETURN TRUE;
  END IF;
  
  -- Verificar si el usuario es empleado
  IF EXISTS (
    SELECT 1 FROM employees 
    WHERE business_id = business_uuid 
    AND user_id = auth.uid()
  ) THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$;

-- =====================================================
-- VERIFICACIÓN FINAL
-- =====================================================

SELECT 
  p.proname as "Función",
  pg_get_function_identity_arguments(p.oid) as "Parámetros",
  CASE 
    WHEN p.proconfig IS NOT NULL AND array_to_string(p.proconfig, ',') LIKE '%search_path%'
    THEN '✅ CORRECTO'
    ELSE '❌ FALTA'
  END as "Estado"
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND (
    (p.proname = 'check_email_has_access' AND pg_get_function_identity_arguments(p.oid) = 'user_email text')
    OR
    (p.proname = 'user_has_business_access' AND pg_get_function_identity_arguments(p.oid) = 'business_uuid uuid, business_email text, business_created_by uuid')
  )
ORDER BY "Función", "Parámetros";
