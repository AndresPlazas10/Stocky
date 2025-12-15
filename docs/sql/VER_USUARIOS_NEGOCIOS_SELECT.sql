-- =====================================================
-- VER TODOS LOS USUARIOS Y NEGOCIOS
-- =====================================================
-- Versión con SELECT para ver en Results
-- =====================================================

-- 1. TODOS LOS USUARIOS
SELECT 
  '👥 USUARIOS' as tipo,
  id as user_id,
  email,
  created_at,
  email_confirmed_at
FROM auth.users
ORDER BY created_at DESC;

-- 2. TODOS LOS NEGOCIOS
SELECT 
  '🏢 NEGOCIOS' as tipo,
  id as business_id,
  name as nombre,
  created_by as owner_user_id,
  email,
  username,
  created_at
FROM businesses
ORDER BY created_at DESC;

-- 3. RELACIÓN USUARIO → NEGOCIO
SELECT 
  '🔗 RELACIÓN' as tipo,
  u.id as user_id,
  u.email as user_email,
  b.id as business_id,
  b.name as business_name,
  b.username as business_username,
  CASE 
    WHEN b.id IS NOT NULL THEN '✅ Tiene negocio'
    ELSE '❌ Sin negocio'
  END as estado
FROM auth.users u
LEFT JOIN businesses b ON b.created_by = u.id
ORDER BY u.created_at DESC;

-- 4. CONTEO
SELECT 
  '📊 RESUMEN' as tipo,
  (SELECT COUNT(*) FROM auth.users) as total_usuarios,
  (SELECT COUNT(*) FROM businesses) as total_negocios,
  CASE 
    WHEN (SELECT COUNT(*) FROM auth.users) > (SELECT COUNT(*) FROM businesses) 
    THEN '⚠️ Hay usuarios sin negocio'
    WHEN (SELECT COUNT(*) FROM auth.users) < (SELECT COUNT(*) FROM businesses)
    THEN '⚠️ Hay negocios sin usuario (error)'
    ELSE '✅ Cada usuario tiene su negocio'
  END as diagnostico;
