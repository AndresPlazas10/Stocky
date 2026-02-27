import LOCAL_SYNC_CONFIG from '../config/localSync.js';
import { getLocalDbClient } from '../localdb/client.js';
import { invalidateFromOutboxEvent } from '../data/adapters/cacheInvalidation.js';
import { logger } from '../utils/logger.js';

const OFFLINE_SYNC_MARKER_KEY = 'stocky.offline_sync.pending_since';

function isLocalMutationId(value) {
  const mutationId = String(value || '').trim().toLowerCase();
  return mutationId.includes('.local');
}

function isLocalWriteMutation({ payload, mutationId, queuedEvent }) {
  if (payload?.local_write === true) return true;
  if (isLocalMutationId(mutationId)) return true;
  if (isLocalMutationId(queuedEvent?.mutation_id)) return true;
  return false;
}

function persistOfflineSyncMarkerIfNeeded({ localWrite, online }) {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  // El marcador solo representa trabajo generado estando offline.
  // Evita falsos positivos en sesiones online normales.
  if (online) return;
  if (!localWrite) return;

  try {
    const existing = Number(window.sessionStorage.getItem(OFFLINE_SYNC_MARKER_KEY));
    if (Number.isFinite(existing) && existing > 0) return;
    window.sessionStorage.setItem(OFFLINE_SYNC_MARKER_KEY, String(Date.now()));
  } catch {
    // best-effort
  }
}

export async function enqueueOutboxMutation({
  businessId,
  mutationType,
  payload,
  mutationId,
  baseVersions = null
}) {
  if (!LOCAL_SYNC_CONFIG.enabled || !LOCAL_SYNC_CONFIG.shadowWritesEnabled) {
    return null;
  }

  try {
    const db = getLocalDbClient();
    await db.init();
    const queuedEvent = await db.enqueueOutboxEvent({
      businessId,
      mutationType,
      payload,
      mutationId,
      baseVersions
    });

    // Invalidación temprana sin bloquear el camino crítico de escritura local.
    invalidateFromOutboxEvent(queuedEvent).catch((error) => {
      logger.warn('[sync] no se pudo invalidar cache tras enqueue', {
        mutationType,
        error: error?.message || String(error)
      });
    });

    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      const online = typeof navigator === 'undefined' ? true : navigator.onLine === true;
      const localWrite = isLocalWriteMutation({
        payload,
        mutationId,
        queuedEvent
      });
      persistOfflineSyncMarkerIfNeeded({ localWrite, online });
      window.dispatchEvent(new CustomEvent('stocky:outbox-enqueued', {
        detail: {
          mutationType,
          localWrite,
          online
        }
      }));
    }

    return queuedEvent;
  } catch (error) {
    logger.warn('[sync] no se pudo encolar shadow outbox', {
      mutationType,
      error: error?.message || String(error)
    });
    return null;
  }
}

export default enqueueOutboxMutation;
