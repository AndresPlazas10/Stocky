import {
  computeNextRetryAt,
  isConnectivityError,
  isPermanentSyncError
} from './salesOutboxRetryPolicy.js';

export function buildProcessingOutboxEventPatch(currentEvent, { nowIso = new Date().toISOString() } = {}) {
  return {
    ...currentEvent,
    status: 'processing',
    attempts: Number(currentEvent?.attempts || 0) + 1,
    next_retry_at: null,
    updated_at: nowIso,
  };
}

export function resolveFailedOutboxSyncTransition({
  event,
  errorMessage,
  nowMs = Date.now(),
  nowIso = new Date(nowMs).toISOString()
}) {
  const attempts = Number(event?.attempts || 0) + 1;
  const message = String(errorMessage || 'Error al sincronizar venta pendiente');

  if (isConnectivityError(message)) {
    return {
      shouldBreak: true,
      patch: {
        status: 'pending',
        attempts,
        last_error: message,
        next_retry_at: computeNextRetryAt(attempts, { nowMs }),
        updated_at: nowIso,
      }
    };
  }

  if (isPermanentSyncError(message)) {
    return {
      shouldBreak: false,
      patch: {
        status: 'error',
        last_error: message,
        next_retry_at: null,
        updated_at: nowIso,
      }
    };
  }

  return {
    shouldBreak: false,
    patch: {
      status: 'pending',
      attempts,
      last_error: message,
      next_retry_at: computeNextRetryAt(attempts, { nowMs }),
      updated_at: nowIso,
    }
  };
}
