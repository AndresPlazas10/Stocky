// Helper para cerrar modal inmediatamente y ejecutar trabajo en background
// Uso: closeModalImmediate(() => setIsOpen(false), () => doHeavyWork())
export function closeModalImmediate(closeFn, backgroundFn) {
  // Cerrar UI inmediatamente
  try {
    closeFn();
  } catch (e) {
    console.error('closeFn failed', e);
  }

  // Deferir trabajo que puede bloquear el cierre
  const runBackground = () => {
    try {
      if (typeof backgroundFn === 'function') backgroundFn();
    } catch (e) {
      console.error('backgroundFn failed', e);
    }
  };

  // Give browser a chance to paint the closing state first
  if (typeof requestAnimationFrame !== 'undefined') {
    requestAnimationFrame(() => setTimeout(runBackground, 0));
  } else {
    setTimeout(runBackground, 0);
  }
}
