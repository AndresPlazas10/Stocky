import { logger } from '@/utils/logger';

interface EmailValidationResult {
  valid: boolean;
  error?: string;
  normalized?: string;
}

interface ShouldSendEmailResult {
  shouldSend: boolean;
  reason?: string;
  testEmail?: string;
  email?: string;
}

interface EmailLogEntry {
  timestamp: string;
  environment: string;
  type: string;
  email: string;
  success: boolean;
  skipped: boolean;
  error?: string | Error | null;
}

interface EmailStats {
  total: number;
  success: number;
  failed: number;
  skipped: number;
  lastAttempt: EmailLogEntry | null;
}

// Lista de dominios descartables/temporales comunes
const DISPOSABLE_EMAIL_DOMAINS: string[] = [
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

/**
 * Valida el formato de un email con regex estricto
 */
export const isValidEmailFormat = (email: string | null | undefined): boolean => {
  if (!email || typeof email !== 'string') {
    return false;
  }

  // Regex RFC 5322 simplificado pero estricto
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  
  return emailRegex.test(email.trim());
};

/**
 * Verifica si el email es de un dominio descartable/temporal
 */
export const isDisposableEmail = (email: string | null | undefined): boolean => {
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
 */
export const normalizeEmail = (email: string | null | undefined): string => {
  if (!email || typeof email !== 'string') {
    return '';
  }

  return email.trim().toLowerCase();
};

/**
 * Validación completa de email
 */
export const validateEmail = (email: string | null | undefined): EmailValidationResult => {
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
 */
export const isDevelopment = (): boolean => {
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
 */
export const getTestEmail = (): string => {
  // Fallback corporativo para evitar redirecciones accidentales a correos personales.
  return import.meta.env.VITE_TEST_EMAIL || 'soporte@stockypos.app';
};

const isEmailTestRedirectEnabled = (): boolean => {
  const raw = String(
    import.meta.env.VITE_EMAIL_REDIRECT_TO_TEST
    ?? import.meta.env.VITE_FORCE_TEST_EMAIL
    ?? ''
  ).trim().toLowerCase();

  return raw === '1' || raw === 'true' || raw === 'yes';
};

/**
 * Decide si se debe enviar un email real o solo simularlo
 */
export const shouldSendEmail = (email: string | null | undefined): ShouldSendEmailResult => {
  const validation = validateEmail(email);

  // Si el email no es válido, no enviar
  if (!validation.valid) {
    return {
      shouldSend: false,
      reason: validation.error
    };
  }

  // Solo redirigir a email de testing cuando se habilite explícitamente.
  if (isEmailTestRedirectEnabled()) {
    const testEmail = getTestEmail();
    
    return {
      shouldSend: true,
      testEmail,
      reason: 'Redirección a email de testing habilitada por configuración'
    };
  }

  // Por defecto (dev/prod), enviar al email real validado.
  return {
    shouldSend: true,
    email: validation.normalized
  };
};

/**
 * Logger de intentos de envío de email
 */
export const logEmailAttempt = ({ 
  email, 
  type = 'invoice', 
  success = false, 
  error = null,
  skipped = false 
}: {
  email: string | null | undefined;
  type?: string;
  success?: boolean;
  error?: Error | string | null;
  skipped?: boolean;
}): void => {
  const isDev = isDevelopment();
  
  const logData: EmailLogEntry = {
    timestamp: new Date().toISOString(),
    environment: isDev ? 'development' : 'production',
    type,
    email: email || 'unknown',
    success,
    skipped,
    error: error instanceof Error ? error.message : error
  };

  // En producción, enviar a servicio de logging si hay error
  if (!isDev && error) {
    // TODO: Integrar con servicio de monitoreo (Sentry, etc)
  }

  // Opcional: guardar en localStorage para debugging
  try {
    const logs: EmailLogEntry[] = JSON.parse(localStorage.getItem('email_logs') || '[]');
    logs.push(logData);
    // Mantener solo los últimos 50 logs
    localStorage.setItem('email_logs', JSON.stringify(logs.slice(-50)));
  } catch (err) {
    logger.warn('utils:emailValidation:logAttempt localStorage failed', err);
  }
};

/**
 * Obtiene estadísticas de emails enviados (para debugging)
 */
export const getEmailStats = (): EmailStats => {
  try {
    const logs: EmailLogEntry[] = JSON.parse(localStorage.getItem('email_logs') || '[]');
    
    return {
      total: logs.length,
      success: logs.filter(l => l.success).length,
      failed: logs.filter(l => !l.success && !l.skipped).length,
      skipped: logs.filter(l => l.skipped).length,
      lastAttempt: logs[logs.length - 1] || null
    };
  } catch (err) {
    logger.warn('utils:emailValidation:getEmailStats localStorage failed', err);
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
export const clearEmailLogs = (): void => {
  try {
    localStorage.removeItem('email_logs');
  } catch (err) {
    logger.warn('utils:emailValidation:clearLogs localStorage failed', err);
  }
};
