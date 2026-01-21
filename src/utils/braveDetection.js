/**
 * Utilidades para detectar y manejar Brave browser
 * Brave tiene configuraciones de privacidad que pueden afectar la app
 */

export async function isBraveBrowser() {
  try {
    // Brave tiene una API especial
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return false;
    }
    
    // Verificar que el objeto brave existe y tiene el método isBrave
    if (!navigator.brave || typeof navigator.brave.isBrave !== 'function') {
      return false;
    }
    
    // Llamar la función asíncrona con timeout de seguridad
    const timeoutPromise = new Promise(resolve => setTimeout(() => resolve(false), 1000));
    const bravePromise = navigator.brave.isBrave();
    
    return await Promise.race([bravePromise, timeoutPromise]);
  } catch (error) {
    // Si hay error, asumir que no es Brave para no romper la app
    console.warn('Error detectando Brave:', error);
    return false;
  }
}

export async function checkBraveShields() {
  if (!isBraveBrowser()) return { isBrave: false };

  try {
    const isBrave = await navigator.brave.isBrave();
    return {
      isBrave,
      shields: {
        // Brave puede bloquear fingerprinting, cookies, etc.
        detected: true,
        message: 'Brave detectado. Si tienes problemas, desactiva Shields para este sitio.'
      }
    };
  } catch (error) {
    return { isBrave: true, error: 'No se pudo verificar Brave Shields' };
  }
}

export function showBraveInstructions() {
  return `
    🛡️ Detectamos que estás usando Brave.
    
    Si la app no carga correctamente:
    1. Haz clic en el icono del león (Brave Shields) en la barra de direcciones
    2. Desactiva los Shields para este sitio
    3. Recarga la página
    
    Esto permitirá que la app funcione correctamente mientras mantienes
    tu privacidad en otros sitios.
  `;
}
