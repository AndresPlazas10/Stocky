import baseLogger from './logger.js';

/**
 * Compat layer para código legado que importe productionLogger.
 * Toda la salida queda centralizada y controlada por src/utils/logger.js.
 */
export const logger = {
  log: (...args) => baseLogger.success(...args),
  error: (...args) => baseLogger.error(...args),
  warn: (...args) => baseLogger.warn(...args),
  info: (...args) => baseLogger.info(...args)
};

/**
 * Manejador de errores silencioso para producción.
 * En dev conserva trazabilidad usando el logger central.
 */
export const handleError = (error, context = '') => {
  logger.error('[production-logger] error', { context, error });
};

export default logger;
