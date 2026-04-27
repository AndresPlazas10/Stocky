import { LOCAL_SYNC_CONFIG } from '../config/localSync.js';
import { listLocalOutboxEvents, updateLocalOutboxEventStatus } from '../localdb/outboxEventsStore.js';
import { dispatchOutboxMutation } from './outboxMutationHandlers.js';

let salesOutboxApiPromise = null;

async function getSalesOutboxApi() {
  if (!salesOutboxApiPromise) {
    salesOutboxApiPromise = import('../data/commands/salesCommands.js')
      .catch(() => null);
  }
  return salesOutboxApiPromise;
}

async function readSalesSnapshotSafe() {
  const api = await getSalesOutboxApi();
  if (!api || typeof api.getSalesOutboxSnapshot !== 'function') {
    return { total: 0, pending: 0, processing: 0, error: 0 };
  }
  return api.getSalesOutboxSnapshot();
}

async function flushSalesOutboxSafe({ maxEvents = 20 } = {}) {
  const api = await getSalesOutboxApi();
  if (!api || typeof api.flushSalesOutbox !== 'function') {
    return { synced: 0, pending: 0 };
  }
  return api.flushSalesOutbox({ maxEvents });
}

async function defaultOutboxMutationHandler() {
  return dispatchOutboxMutation(...arguments);
}

async function getLocalOutboxSummary() {
  const [pending, syncing, rejected, acked] = await Promise.all([
    listLocalOutboxEvents({ statuses: ['pending'], limit: 5000 }),
    listLocalOutboxEvents({ statuses: ['syncing'], limit: 5000 }),
    listLocalOutboxEvents({ statuses: ['rejected'], limit: 5000 }),
    listLocalOutboxEvents({ statuses: ['acked'], limit: 5000 })
  ]);

  return {
    pending: pending.length,
    syncing: syncing.length,
    rejected: rejected.length,
    acked: acked.length,
    total: pending.length + syncing.length + rejected.length + acked.length
  };
}

export async function processLocalOutboxEvents({
  maxEvents = 20,
  handler = defaultOutboxMutationHandler
} = {}) {
  const candidates = await listLocalOutboxEvents({
    statuses: ['pending'],
    limit: Math.max(1, Number(maxEvents || 20))
  });

  let processed = 0;
  let acked = 0;
  let rejected = 0;

  for (const event of candidates) {
    const eventId = String(event?.id || '').trim();
    if (!eventId) continue;

    await updateLocalOutboxEventStatus({
      eventId,
      status: 'syncing',
      lastError: null,
      retryCount: Number(event?.retry_count || 0)
    });

    processed += 1;

    try {
      const result = await handler(event);
      if (result?.ack === false) {
        const retryable = result?.retryable === true;
        if (!retryable) {
          rejected += 1;
        }
        await updateLocalOutboxEventStatus({
          eventId,
          status: retryable ? 'pending' : 'rejected',
          lastError: String(result?.error || 'Rejected by handler'),
          retryCount: Number(event?.retry_count || 0) + 1
        });
        continue;
      }

      acked += 1;
      await updateLocalOutboxEventStatus({
        eventId,
        status: 'acked',
        lastError: null,
        retryCount: Number(event?.retry_count || 0)
      });
    } catch (error) {
      const message = String(error?.message || error || 'Unknown outbox error');
      const retryable = String(message).toLowerCase().includes('network') || String(message).toLowerCase().includes('fetch');
      if (!retryable) {
        rejected += 1;
      }
      await updateLocalOutboxEventStatus({
        eventId,
        status: retryable ? 'pending' : 'rejected',
        lastError: message,
        retryCount: Number(event?.retry_count || 0) + 1
      });
    }
  }

  const summary = await getLocalOutboxSummary();
  return {
    processed,
    acked,
    rejected,
    ...summary
  };
}

/**
 * Tick de outbox (scaffold Fase B).
 *
 * En esta etapa conecta el nuevo módulo de sync con la cola ya productiva
 * de ventas para no introducir regresiones.
 */
export async function processOutboxTick({ maxEvents = 20 } = {}) {
  const salesSnapshot = await readSalesSnapshotSafe();

  if (!LOCAL_SYNC_CONFIG?.enabled) {
    const localSummary = await getLocalOutboxSummary();
    return {
      enabled: false,
      synced: 0,
      pending: Number(salesSnapshot?.total || 0),
      source: 'salesOutbox',
      localOutbox: localSummary
    };
  }

  const localResult = LOCAL_SYNC_CONFIG?.shadowWritesEnabled
    ? await processLocalOutboxEvents({ maxEvents })
    : await getLocalOutboxSummary();

  const result = await flushSalesOutboxSafe({ maxEvents });
  const snapshot = await readSalesSnapshotSafe();

  return {
    enabled: true,
    synced: Number(result?.synced || 0) + Number(localResult?.acked || 0),
    pending: Number(snapshot?.total || 0),
    source: 'salesOutbox+localOutbox',
    localOutbox: localResult
  };
}

export async function getOutboxProcessorHealth() {
  const snapshot = await readSalesSnapshotSafe();
  const localSummary = await getLocalOutboxSummary();
  return {
    source: 'salesOutbox+localOutbox',
    pending: Number(snapshot?.pending || 0),
    processing: Number(snapshot?.processing || 0),
    error: Number(snapshot?.error || 0),
    total: Number(snapshot?.total || 0),
    localOutbox: localSummary
  };
}

export default {
  processOutboxTick,
  getOutboxProcessorHealth
};
