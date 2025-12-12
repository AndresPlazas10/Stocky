-- =====================================================
-- 🔧 ASIGNAR NEGOCIO AL USUARIO ACTUAL
-- =====================================================
-- Este script asigna el negocio actual al usuario que
-- está autenticado en la aplicación
-- =====================================================

-- PASO 1: Ver el estado actual
SELECT 
  'ANTES' as momento,
  id,
  name as negocio,
  username,
  created_by as owner_actual,
  email
FROM businesses
ORDER BY created_at DESC
LIMIT 5;

-- PASO 2: Actualizar el created_by del negocio
-- ⚠️ IMPORTANTE: Ejecuta esto desde la APLICACIÓN, no desde SQL Editor
-- O reemplaza 'TU-USER-ID' con tu user_id real

-- Para obtener tu user_id desde la app, abre la consola del navegador y ejecuta:
-- const { data: { user } } = await supabase.auth.getUser();
-- console.log(user.id);

/*
-- Luego ejecuta esto reemplazando TU-USER-ID:
UPDATE businesses
SET created_by = 'TU-USER-ID'
WHERE id = 'TU-BUSINESS-ID';
*/

-- PASO 3: Verificar el cambio
SELECT 
  'DESPUÉS' as momento,
  id,
  name as negocio,
  username,
  created_by as owner_actual,
  email
FROM businesses
ORDER BY created_at DESC
LIMIT 5;

-- =====================================================
-- ALTERNATIVA: Script para ejecutar desde la app
-- =====================================================
-- Copia este código y ejecútalo en la consola del navegador
-- (F12 → Console):
/*
const { data: { user } } = await supabase.auth.getUser();
console.log('Mi user_id:', user.id);

// Ver negocios actuales
const { data: businesses } = await supabase
  .from('businesses')
  .select('*');
console.log('Negocios:', businesses);

// Si hay un negocio, actualizar su created_by
if (businesses && businesses.length > 0) {
  const businessId = businesses[0].id;
  const { data, error } = await supabase
    .from('businesses')
    .update({ created_by: user.id })
    .eq('id', businessId)
    .select();
  
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('✅ Negocio actualizado:', data);
    // Recargar la página
    window.location.reload();
  }
}
*/
