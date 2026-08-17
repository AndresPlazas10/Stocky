// Constantes compartidas del módulo de mesas (web + móvil)
/** Ventana en ms en la que un call_requested_at se considera "activo" (cocina llamando). */
export const CALL_WINDOW_MS = 10 * 60 * 1000;
/** TTL del lock de edición de mesa (segundos). */
export const MESA_LOCK_TTL_SECONDS = 45;
/** TTL del lock de edición de mesa (ms). */
export const MESA_LOCK_TTL_MS = MESA_LOCK_TTL_SECONDS * 1000;
/** Intervalo del heartbeat de renovación del lock de edición (ms). */
export const MESA_LOCK_HEARTBEAT_MS = 20000;
/** Intervalo del poll de fallback de mesas (ms). */
export const MESAS_REMOTE_FALLBACK_POLL_MS = 15000;
//# sourceMappingURL=mesaConstants.js.map