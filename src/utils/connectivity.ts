import { isConnectivityError } from '@stocky/shared';

export { isConnectivityError };

export function formatLoadError(resourceLabel, errorLike) {
  if (isConnectivityError(errorLike)) {
    return `⚠️ Sin conexión. No se pudieron cargar ${resourceLabel}. Verifica tu internet y reintenta.`;
  }
  return `❌ Error al cargar ${resourceLabel}: ${errorLike?.message || 'Error desconocido'}`;
}
