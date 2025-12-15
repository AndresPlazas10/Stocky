-- =====================================================
-- CREAR NEGOCIO PARA andres_plazas100
-- =====================================================
-- Este script crea el negocio para el usuario actual
-- =====================================================

-- Crear negocio para el usuario andres_plazas100
INSERT INTO businesses (
  id,
  name,
  email,
  username,
  created_by,
  created_at
)
VALUES (
  gen_random_uuid(),
  'Negocio de Andrés',  -- Puedes cambiar este nombre
  'andres_plazas100@stockly-app.com',
  'andres_plazas100',
  '60bc26ce-1356-4a6d-ba05-9a991ee8fce6',  -- Tu user_id
  NOW()
)
RETURNING id, name, username;

-- Verificar que se creó correctamente
SELECT 
  'Negocio creado exitosamente' as mensaje,
  id as business_id,
  name as nombre,
  created_by as owner_user_id
FROM businesses
WHERE created_by = '60bc26ce-1356-4a6d-ba05-9a991ee8fce6';
