import LOCAL_SYNC_CONFIG from '../config/localSync.js';
import localDbClient, { getLocalDbClient } from '../localdb/client.js';
import { logger } from '../utils/logger.js';
import ElectricSubscriber from './electricSubscriber.js';
import OutboxProcessor from './outboxProcessor.js';
import { createVerificationHandlers } from './verificationHandlers.js';
import { getShapeRegistry } from './shapeRegistry.js';

let syncContext = null;
let bootstrapPromise = null;
const CRITICAL_REMOTE_MUTATION_TYPES = new Set([
  'sale.create',
  'sale.delete',
  'purchase.create',
  'purchase.delete',
  'table.create',
  'table.delete_cascade_orders',
  'order.create',
  'order.total.update',
  'order.item.insert',
  'order.item.update_quantity',
  'order.item.bulk_quantity_update',
  'order.item.delete',
  'order.delete_and_release_table',
  'order.close.single',
  'order.close.split'
]);

function createSyncHandlers() {
  if (!LOCAL_SYNC_CONFIG.outboxRemoteVerifyEnabled) {
    const verificationHandlers = createVerificationHandlers();
    const criticalHandlers = {};
    CRITICAL_REMOTE_MUTATION_TYPES.forEach((mutationType) => {
      if (typeof verificationHandlers[mutationType] === 'function') {
        criticalHandlers[mutationType] = verificationHandlers[mutationType];
      }
    });

    return {
      ...criticalHandlers,
      '*': async (event) => ({
        ok: true,
        ackPayload: {
          mode: 'shadow-fallback',
          mutation_type: event.mutation_type,
          processed_at: new Date().toISOString()
        }
      })
    };
  }

  return {
    ...createVerificationHandlers(),
    '*': async (event) => ({
      ok: true,
      ackPayload: {
        mode: 'shadow-fallback',
        mutation_type: event.mutation_type,
        processed_at: new Date().toISOString()
      }
    })
  };
}

function isShadowAckedPayload(ackPayload) {
  if (!ackPayload || typeof ackPayload !== 'object') return false;
  const mode = String(ackPayload?.mode || '').trim().toLowerCase();
  return mode === 'shadow' || mode === 'shadow-fallback';
}

async function reviveShadowAckedCriticalMutations(db) {
  if (!db?.listTerminalOutboxEvents || !db?.updateOutboxEvent) return 0;

  const terminal = await db.listTerminalOutboxEvents({ limit: 1000 });
  const ackedShadowCritical = (terminal || []).filter((event) => (
    String(event?.status || '').toLowerCase() === 'acked'
    && CRITICAL_REMOTE_MUTATION_TYPES.has(String(event?.mutation_type || '').trim())
    && isShadowAckedPayload(event?.ack_payload)
  ));

  if (ackedShadowCritical.length === 0) return 0;

  await Promise.all(
    ackedShadowCritical.map((event) => db.updateOutboxEvent(event.id, {
      status: 'pending',
      retry_count: 0,
      last_error: null,
      ack_payload: null
    }))
  );

  logger.info('[sync] reactivados eventos shadow críticos para push remoto', {
    count: ackedShadowCritical.length
  });
  return ackedShadowCritical.length;
}

export async function bootstrapLocalSync() {
  if (syncContext) return syncContext;
  if (bootstrapPromise) return bootstrapPromise;

  bootstrapPromise = (async () => {
    if (!LOCAL_SYNC_CONFIG.enabled) {
      syncContext = {
        enabled: false,
        stop: async () => {}
      };
      return syncContext;
    }

    const db = getLocalDbClient();
    await db.init();

    const handlers = createSyncHandlers();
    const outboxProcessor = new OutboxProcessor({
      db,
      handlers,
      pollMs: LOCAL_SYNC_CONFIG.outboxPollMs,
      batchSize: LOCAL_SYNC_CONFIG.outboxBatchSize,
      maxRetries: LOCAL_SYNC_CONFIG.outboxMaxRetries
    });
    outboxProcessor.start();

    const electricSubscriber = new ElectricSubscriber({
      db,
      shapes: getShapeRegistry()
    });
    await electricSubscriber.start();

    syncContext = {
      enabled: true,
      db,
      outboxProcessor,
      electricSubscriber,
      stop: async () => {
        outboxProcessor.stop();
        await electricSubscriber.stop();
        syncContext = null;
      }
    };

    logger.info('[sync] bootstrap local sync ok', {
      adapter: (await db.health()).adapter,
      electricPullEnabled: LOCAL_SYNC_CONFIG.electricPullEnabled,
      outboxRemoteVerifyEnabled: LOCAL_SYNC_CONFIG.outboxRemoteVerifyEnabled
    });

    return syncContext;
  });
  try {
    return await bootstrapPromise;
  } finally {
    bootstrapPromise = null;
  }
}

export async function stopLocalSync() {
  if (!syncContext) return;
  await syncContext.stop();
}

export function getLocalSyncContext() {
  return syncContext;
}

export async function runOutboxTick() {
  if (!LOCAL_SYNC_CONFIG.enabled) return false;
  if (syncContext?.outboxProcessor) {
    try {
      await reviveShadowAckedCriticalMutations(syncContext.db);
    } catch (error) {
      logger.warn('[sync] no se pudieron reactivar eventos shadow', {
        error: error?.message || String(error)
      });
    }
    await syncContext.outboxProcessor.tick();
    return true;
  }

  // Fallback one-shot: útil para devtools cuando el contexto global aún no está activo.
  try {
    await bootstrapLocalSync();
  } catch {
    // Continuar con fallback local one-shot.
  }

  if (syncContext?.outboxProcessor) {
    try {
      await reviveShadowAckedCriticalMutations(syncContext.db);
    } catch (error) {
      logger.warn('[sync] no se pudieron reactivar eventos shadow', {
        error: error?.message || String(error)
      });
    }
    await syncContext.outboxProcessor.tick();
    return true;
  }

  const db = getLocalDbClient();
  await db.init();
  try {
    await reviveShadowAckedCriticalMutations(db);
  } catch (error) {
    logger.warn('[sync] no se pudieron reactivar eventos shadow', {
      error: error?.message || String(error)
    });
  }
  const processor = new OutboxProcessor({
    db,
    handlers: createSyncHandlers(),
    pollMs: LOCAL_SYNC_CONFIG.outboxPollMs,
    batchSize: LOCAL_SYNC_CONFIG.outboxBatchSize,
    maxRetries: LOCAL_SYNC_CONFIG.outboxMaxRetries
  });
  await processor.tick();
  return true;
}

export async function listOutboxEvents({ status = 'pending', limit = 50 } = {}) {
  if (!LOCAL_SYNC_CONFIG.enabled) return [];
  const db = getLocalDbClient();
  await db.init();
  return db.listOutboxEvents({ status, limit });
}

export async function listConflictEvents({ limit = 50 } = {}) {
  if (!LOCAL_SYNC_CONFIG.enabled) return [];
  const db = getLocalDbClient();
  await db.init();
  return db.listConflicts({ limit });
}

export async function clearConflictEvents() {
  if (!LOCAL_SYNC_CONFIG.enabled) return false;
  const db = getLocalDbClient();
  await db.init();
  await db.clearConflicts();
  return true;
}

export async function clearOutboxEvents() {
  if (!LOCAL_SYNC_CONFIG.enabled) return false;
  const db = getLocalDbClient();
  await db.init();
  await db.clearOutbox();
  return true;
}

export async function clearLocalReadCache() {
  if (!LOCAL_SYNC_CONFIG.enabled) return false;
  const db = getLocalDbClient();
  await db.init();
  await db.clearCache();
  return true;
}

export async function listConvergenceMetrics({ limit = 100 } = {}) {
  if (!LOCAL_SYNC_CONFIG.enabled) return [];
  const db = getLocalDbClient();
  await db.init();
  return db.listConvergenceMetrics({ limit });
}

export async function clearConvergenceMetrics() {
  if (!LOCAL_SYNC_CONFIG.enabled) return false;
  const db = getLocalDbClient();
  await db.init();
  await db.clearConvergenceMetrics();
  return true;
}

export async function enqueueDebugMutation({
  businessId = 'debug-business',
  mutationType = 'debug.ping',
  payload = {}
} = {}) {
  if (!LOCAL_SYNC_CONFIG.enabled) return null;
  const db = getLocalDbClient();
  await db.init();
  return db.enqueueOutboxEvent({
    businessId,
    mutationType,
    payload,
    mutationId: `${businessId}:${Date.now()}:${mutationType}`
  });
}

export async function getLocalSyncHealth() {
  if (!LOCAL_SYNC_CONFIG.enabled) {
    return { enabled: false };
  }
  const db = localDbClient;
  await db.init();
  const health = await db.health();
  return {
    enabled: true,
    ...health
  };
}

export default bootstrapLocalSync;
