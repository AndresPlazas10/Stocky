/**
 * Helper para cerrar modal inmediatamente y ejecutar trabajo en background
 * Uso: closeModalImmediate(() => setIsOpen(false), () => doHeavyWork())
 */
import { logger } from '@/utils/logger';
export function closeModalImmediate(closeFn: () => void, backgroundFn?: () => void): void {
  // Cerrar UI inmediatamente
  try {
    closeFn();
  } catch (err) {
    logger.warn('utils:closeModalImmediate:closeFn failed', err);
  }

  // Deferir trabajo que puede bloquear el cierre
  const runBackground = (): void => {
    try {
      if (typeof backgroundFn === 'function') backgroundFn();
    } catch (err) {
      logger.warn('utils:closeModalImmediate:backgroundFn failed', err);
    }
  };

  // Give browser a chance to paint the closing state first
  if (typeof requestAnimationFrame !== 'undefined') {
    requestAnimationFrame(() => setTimeout(runBackground, 0));
  } else {
    setTimeout(runBackground, 0);
  }
}
