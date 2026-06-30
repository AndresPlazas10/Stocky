import {
  computeNextRetryAt,
  isPermanentSyncError
} from './salesOutboxRetryPolicy';
import { isConnectivityError } from '../../utils/connectivity';
import type { OutboxEvent } from '../../types';

interface ProcessingPatch extends Partial<OutboxEvent> {
  status: 'processing';
  attempts: number;
  next_retry_at: null;
  updated_at: string;
}

export function buildProcessingOutboxEventPatch(
  currentEvent: OutboxEvent,
  { nowIso = new Date().toISOString() }: { nowIso?: string } = {}
): ProcessingPatch {
  return {
    ...currentEvent,
    status: 'processing',
    attempts: Number(currentEvent?.attempts || 0) + 1,
    next_retry_at: null,
    updated_at: nowIso,
  };
}

interface FailedTransitionResult {
  shouldBreak: boolean;
  patch: Partial<OutboxEvent>;
}

interface FailedTransitionOptions {
  event: OutboxEvent;
  errorMessage: string;
  nowMs?: number;
  nowIso?: string;
}

export function resolveFailedOutboxSyncTransition({
  event,
  errorMessage,
  nowMs = Date.now(),
  nowIso = new Date(nowMs).toISOString()
}: FailedTransitionOptions): FailedTransitionResult {
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
