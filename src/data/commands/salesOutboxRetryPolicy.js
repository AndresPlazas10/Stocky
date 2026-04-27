export const SALES_OUTBOX_BASE_RETRY_MS = 8_000;
export const SALES_OUTBOX_MAX_RETRY_MS = 5 * 60_000;

export function isConnectivityError(errorLike) {
  const message = String(errorLike?.message || errorLike || '').toLowerCase();
  return (
    message.includes('failed to fetch')
    || message.includes('networkerror')
    || message.includes('network request failed')
    || message.includes('load failed')
    || message.includes('fetch failed')
    || message.includes('network')
  );
}

export function computeNextRetryAt(attempts = 0, { nowMs = Date.now() } = {}) {
  const safeAttempts = Math.max(0, Number(attempts || 0));
  const delay = Math.min(
    SALES_OUTBOX_MAX_RETRY_MS,
    SALES_OUTBOX_BASE_RETRY_MS * (2 ** safeAttempts)
  );
  return new Date(nowMs + delay).toISOString();
}

export function isPermanentSyncError(errorLike) {
  const message = String(errorLike?.message || errorLike || '').toLowerCase();
  if (!message) return false;

  if (isConnectivityError(message)) return false;

  return (
    message.includes('datos de venta inválidos')
    || message.includes('datos de venta invalidos')
    || message.includes('sesión no válida')
    || message.includes('sesion no valida')
    || message.includes('unauthorized')
    || message.includes('forbidden')
    || message.includes('permission denied')
    || message.includes('violates row-level security')
    || message.includes('violates check constraint')
    || message.includes('invalid input syntax')
    || message.includes('null value in column')
    || message.includes('violates foreign key constraint')
    || message.includes('item inválido en carrito')
    || message.includes('item invalido en carrito')
    || message.includes('cantidad inválida')
    || message.includes('cantidad invalida')
    || message.includes('precio inválido')
    || message.includes('precio invalido')
  );
}
