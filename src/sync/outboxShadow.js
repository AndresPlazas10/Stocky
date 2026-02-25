import LOCAL_SYNC_CONFIG from '../config/localSync.js';
import { getLocalDbClient } from '../localdb/client.js';
import { invalidateFromOutboxEvent } from '../data/adapters/cacheInvalidation.js';
import { logger } from '../utils/logger.js';

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
