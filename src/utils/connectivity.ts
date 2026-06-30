export function isConnectivityError(errorLike: unknown): boolean {
  const message = String((errorLike as Error)?.message || errorLike || '').toLowerCase();
  return (
    message.includes('failed to fetch')
    || message.includes('networkerror')
    || message.includes('network request failed')
    || message.includes('fetch failed')
    || message.includes('load failed')
    || message.includes('network')
    || message.includes('sin conexión')
    || message.includes('sin conexion')
  );
}

export function formatLoadError(resourceLabel, errorLike) {
  if (isConnectivityError(errorLike)) {
    return `⚠️ Sin conexión. No se pudieron cargar ${resourceLabel}. Verifica tu internet y reintenta.`;
  }
  return `❌ Error al cargar ${resourceLabel}: ${errorLike?.message || 'Error desconocido'}`;
}
