/**
 * 📧 Email Validation & Configuration Utilities
 * 
 * Implementa validaciones robustas y configuración para prevenir
 * bounced emails y mantener buena reputación del dominio.
 * 
 * Recomendaciones de Supabase aplicadas:
 * ✅ Validación estricta de formato de email
 * ✅ Verificación de dominios descartables
 * ✅ Modo testing para desarrollo local
 * ✅ Logging de intentos de envío
 */

// Lista de dominios descartables/temporales comunes
const DISPOSABLE_EMAIL_DOMAINS = [
  'tempmail.com',
  'guerrillamail.com',
  'mailinator.com',
  'throwaway.email',
  '10minutemail.com',
  'temp-mail.org',
  'fakeinbox.com',
  'maildrop.cc',
  'yopmail.com',
  'sharklasers.com'
];

// Lista de dominios válidos comunes (para referencia)
const COMMON_EMAIL_PROVIDERS = [
  'gmail.com',
  'outlook.com',
  'hotmail.com',
  'yahoo.com',
  'icloud.com',
  'live.com',
  'msn.com',
  'protonmail.com'
];

/**
 * Valida el formato de un email con regex estricto
 * @param {string} email - Email a validar
 * @returns {boolean}
 */
export const isValidEmailFormat = (email) => {
  if (!email || typeof email !== 'string') {
    return false;
  }

  // Regex RFC 5322 simplificado pero estricto
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  
  return emailRegex.test(email.trim());
};

/**
 * Verifica si el email es de un dominio descartable/temporal
 * @param {string} email - Email a verificar
 * @returns {boolean}
 */
export const isDisposableEmail = (email) => {
  if (!email || typeof email !== 'string') {
    return true;
  }

  const domain = email.toLowerCase().split('@')[1];
  
  if (!domain) {
    return true;
  }

  return DISPOSABLE_EMAIL_DOMAINS.includes(domain);
};

/**
 * Normaliza un email (lowercase, trim)
 * @param {string} email - Email a normalizar
 * @returns {string}
 */
export const normalizeEmail = (email) => {
  if (!email || typeof email !== 'string') {
    return '';
  }

  return email.trim().toLowerCase();
};

/**
 * Validación completa de email
 * @param {string} email - Email a validar
 * @returns {Object} { valid: boolean, error?: string }
 */
export const validateEmail = (email) => {
  const normalized = normalizeEmail(email);

  // 1. Verificar que no esté vacío
  if (!normalized) {
    return {
      valid: false,
      error: 'El email no puede estar vacío'
    };
  }

  // 2. Verificar formato
  if (!isValidEmailFormat(normalized)) {
    return {
      valid: false,
      error: 'Formato de email inválido'
    };
  }

  // 3. Verificar dominio descartable
  if (isDisposableEmail(normalized)) {
    return {
      valid: false,
      error: 'No se permiten emails temporales o descartables'
    };
  }

  // 4. Verificar longitud
  if (normalized.length > 254) {
    return {
      valid: false,
      error: 'Email demasiado largo (máximo 254 caracteres)'
    };
  }

  // 5. Verificar parte local (antes del @)
  const [localPart, domain] = normalized.split('@');
  
  if (localPart.length > 64) {
    return {
      valid: false,
      error: 'Parte local del email demasiado larga'
    };
  }

  // 6. Verificar que el dominio tenga al menos un punto
  if (!domain.includes('.')) {
    return {
      valid: false,
      error: 'Dominio inválido'
    };
  }

  // 7. Verificar que no haya puntos dobles
  if (normalized.includes('..')) {
    return {
      valid: false,
      error: 'Email contiene puntos consecutivos'
    };
  }

  return {
    valid: true,
    normalized
  };
};

/**
 * Detecta si estamos en modo desarrollo
 * @returns {boolean}
 */
export const isDevelopment = () => {
  // En producción, import.meta.env.DEV es false y MODE es 'production'
  return import.meta.env.DEV || 
         import.meta.env.MODE === 'development' ||
         (typeof window !== 'undefined' && 
          (window.location.hostname === 'localhost' ||
           window.location.hostname === '127.0.0.1' ||
           window.location.hostname.includes('.local')));
};

/**
 * Obtiene un email de testing válido para desarrollo
 * @returns {string}
 */
export const getTestEmail = () => {
  return import.meta.env.VITE_TEST_EMAIL || 'test@example.com';
};

/**
 * Decide si se debe enviar un email real o solo simularlo
 * @param {string} email - Email destinatario
 * @returns {Object} { shouldSend: boolean, reason?: string, testEmail?: string }
 */
export const shouldSendEmail = (email) => {
  const validation = validateEmail(email);

  // Si el email no es válido, no enviar
  if (!validation.valid) {
    return {
      shouldSend: false,
      reason: validation.error
    };
  }

  // En desarrollo, usar email de testing
  if (isDevelopment()) {
    const testEmail = getTestEmail();
    
    console.log(`🧪 [DEV MODE] Email redirigido: ${email} → ${testEmail}`);
    
    return {
      shouldSend: true,
      testEmail,
      reason: 'Modo desarrollo: usando email de testing'
    };
  }

  // En producción, enviar al email real si es válido
  console.log(`📧 [PRODUCTION] Enviando email a: ${validation.normalized}`);
  
  return {
    shouldSend: true,
    email: validation.normalized
  };
};

/**
 * Logger de intentos de envío de email
 * @param {Object} params
 */
export const logEmailAttempt = ({ 
  email, 
  type = 'invoice', 
  success = false, 
  error = null,
  skipped = false 
}) => {
  const isDev = isDevelopment();
  
  const logData = {
    timestamp: new Date().toISOString(),
    environment: isDev ? 'development' : 'production',
    type,
    email: email || 'unknown',
    success,
    skipped,
    error: error?.message || error
  };

  if (isDev) {
    console.log(`📧 [Email ${type}]`, logData);
  }

  // En producción, podrías enviar esto a un servicio de logging
  if (!isDev && error) {
    console.error('[Email Error]', logData);
  }

  // Opcional: guardar en localStorage para debugging
  try {
    const logs = JSON.parse(localStorage.getItem('email_logs') || '[]');
    logs.push(logData);
    // Mantener solo los últimos 50 logs
    localStorage.setItem('email_logs', JSON.stringify(logs.slice(-50)));
  } catch (e) {
    // Ignorar errores de localStorage
  }
};

/**
 * Obtiene estadísticas de emails enviados (para debugging)
 * @returns {Object}
 */
export const getEmailStats = () => {
  try {
    const logs = JSON.parse(localStorage.getItem('email_logs') || '[]');
    
    return {
      total: logs.length,
      success: logs.filter(l => l.success).length,
      failed: logs.filter(l => !l.success && !l.skipped).length,
      skipped: logs.filter(l => l.skipped).length,
      lastAttempt: logs[logs.length - 1] || null
    };
  } catch (e) {
    return {
      total: 0,
      success: 0,
      failed: 0,
      skipped: 0,
      lastAttempt: null
    };
  }
};

/**
 * Limpia los logs de emails (útil para testing)
 */
export const clearEmailLogs = () => {
  try {
    localStorage.removeItem('email_logs');
    console.log('✅ Logs de emails limpiados');
  } catch (e) {
    console.error('❌ Error al limpiar logs:', e);
  }
};
