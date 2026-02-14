/**
 * Sistema de logging para producción
 * Reemplaza console.log/error/warn con logging condicional basado en entorno
 */

const IS_PRODUCTION = import.meta.env.PROD;
const IS_DEVELOPMENT = import.meta.env.DEV;

/**
 * Logger que solo funciona en desarrollo
 */
export const logger = {
  log: (...args) => {
    if (IS_DEVELOPMENT) {
      console.log(...args);
    }
  },
  
  error: (message, error) => {
    if (IS_DEVELOPMENT) {
      console.error(message, error);
    }
    // En producción, podrías enviar a un servicio como Sentry
    if (IS_PRODUCTION && error) {
      // TODO: Integrar con servicio de monitoreo
    }
  },
  
  warn: (...args) => {
    if (IS_DEVELOPMENT) {
      console.warn(...args);
    }
  },
  
  info: (...args) => {
    if (IS_DEVELOPMENT) {
      console.info(...args);
    }
  }
};

/**
 * Manejador de errores silencioso para producción
 * @param {Error} error - Error a manejar
 * @param {string} context - Contexto donde ocurrió el error
 */
export const handleError = (error, context = '') => {
  if (IS_DEVELOPMENT) {
    console.error('Error:', context, error);
  }
  
  // En producción, registrar sin exponer detalles al usuario
  if (IS_PRODUCTION) {
    // TODO: Enviar a servicio de monitoreo (Sentry, LogRocket, etc.)
  }
};

export default logger;
