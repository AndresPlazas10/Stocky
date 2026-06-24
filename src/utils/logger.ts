/**
 * Sistema de logging centralizado
 * En desarrollo: muestra logs en consola
 * En producción: solo errores críticos (y se pueden enviar a servicio de monitoring)
 */

const isDev = import.meta.env.DEV;

class Logger {
  private isDev: boolean;

  constructor() {
    this.isDev = isDev;
  }

  /**
   * Logs informativos (solo en desarrollo)
   */
  info(...args: unknown[]): void {
    if (this.isDev) {
      console.info(...args); // eslint-disable-line no-console
    }
  }

  /**
   * Warnings (solo en desarrollo)
   */
  warn(...args: unknown[]): void {
    if (this.isDev) {
      console.warn(...args); // eslint-disable-line no-console
    }
  }

  /**
   * Errores (siempre se registran)
   * En producción podrían enviarse a Sentry, LogRocket, etc.
   */
  error(...args: unknown[]): void {
    if (this.isDev) {
      console.error(...args); // eslint-disable-line no-console
    }
    // En producción: silencioso o enviar a servicio de monitoring
    // Para integrar: Sentry.captureException(args[0])
  }

  /**
   * Debug (solo en desarrollo)
   */
  debug(...args: unknown[]): void {
    if (this.isDev) {
      console.debug(...args); // eslint-disable-line no-console
    }
  }

  /**
   * Success messages (solo en desarrollo)
   */
  success(...args: unknown[]): void {
    if (this.isDev) {
      console.log(...args); // eslint-disable-line no-console
    }
  }

  /**
   * Método para enviar a servicio de monitoring (placeholder)
   */
  sendToMonitoring(level: string, data: unknown): void {
    void level;
    void data;
    // Implementar integración con Sentry, LogRocket, etc.
    // Sentry.captureException(data);
  }
}

export const logger = new Logger();

// Re-exportar como default para compatibilidad
export default logger;
