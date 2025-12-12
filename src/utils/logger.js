/**
 * Sistema de logging centralizado
 * En desarrollo: muestra logs en consola
 * En producción: solo errores críticos (y se pueden enviar a servicio de monitoring)
 */

const isDev = import.meta.env.DEV;

class Logger {
  constructor() {
    this.isDev = isDev;
  }

  /**
   * Logs informativos (solo en desarrollo)
   */
  info(...args) {
    if (this.isDev) {
      console.log('ℹ️', ...args);
    }
  }

  /**
   * Warnings (solo en desarrollo)
   */
  warn(...args) {
    if (this.isDev) {
      console.warn('⚠️', ...args);
    }
  }

  /**
   * Errores (siempre se registran)
   * En producción podrían enviarse a Sentry, LogRocket, etc.
   */
  error(...args) {
    if (this.isDev) {
      console.error('❌', ...args);
    }
    // En producción: silencioso o enviar a servicio de monitoring
    // Para integrar: Sentry.captureException(args[0])
  }

  /**
   * Debug (solo en desarrollo)
   */
  debug(...args) {
    if (this.isDev) {
      console.debug('🐛', ...args);
    }
  }

  /**
   * Success messages (solo en desarrollo)
   */
  success(...args) {
    if (this.isDev) {
      console.log('✅', ...args);
    }
  }

  /**
   * Método para enviar a servicio de monitoring (placeholder)
   */
  sendToMonitoring(level, data) {
    // Implementar integración con Sentry, LogRocket, etc.
    // Sentry.captureException(data);
  }
}

export const logger = new Logger();

// Re-exportar como default para compatibilidad
export default logger;
