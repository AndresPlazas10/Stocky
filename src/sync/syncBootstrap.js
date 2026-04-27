import { LOCAL_SYNC_CONFIG } from '../config/localSync.js';
import { initLocalDbClient, closeLocalDbClient, getLocalDbClientState } from '../localdb/client.js';
import { processOutboxTick } from './outboxProcessor.js';
import { listReconciliationConflicts, reconcileLocalState } from './reconciler.js';
import { clearLocalOutboxEvents, listLocalOutboxEvents } from '../localdb/outboxEventsStore.js';
import { clearConflictLogRecords } from '../localdb/conflictLogStore.js';
import { clearSyncStateRecords, listSyncStateRecords } from '../localdb/syncStateStore.js';
import { clearShapeMaterializationRows, getShapeMaterializationStats } from '../localdb/shapeMaterializationStore.js';
import {
  appendSyncMetricSnapshot,
  clearSyncMetricSnapshots,
  listSyncMetricSnapshots
} from '../localdb/syncMetricsStore.js';
import {
  appendSyncAlertAuditRecord,
  clearSyncAlertAuditRecords,
  listSyncAlertAuditRecords
} from '../localdb/syncAlertAuditStore.js';
import {
  getElectricSubscriberState,
  startElectricSubscriber,
  stopElectricSubscriber
} from './electricSubscriber.js';

let runtimeContext = null;

const HEALTH_LEVEL_WEIGHT = {
  ok: 0,
  warn: 1,
  critical: 2
};

function mergeHealth(base, incoming) {
  if (!incoming) return base;
  if (!base) return incoming;
  const incomingWeight = HEALTH_LEVEL_WEIGHT[incoming.status] ?? 0;
  const baseWeight = HEALTH_LEVEL_WEIGHT[base.status] ?? 0;
  if (incomingWeight > baseWeight) return incoming;
  if (incomingWeight < baseWeight) return base;
  return {
    status: base.status,
    reasons: [...(base.reasons || []), ...(incoming.reasons || [])]
  };
}

export function evaluateConvergenceHealth(snapshot = {}) {
  let health = { status: 'ok', reasons: [] };

  if (!snapshot?.enabled) {
    health = mergeHealth(health, {
      status: 'warn',
      reasons: ['Sync local desactivado en runtime']
    });
  }

  if (LOCAL_SYNC_CONFIG?.electricPullEnabled && !snapshot?.electricRunning) {
    health = mergeHealth(health, {
      status: 'critical',
      reasons: ['Electric subscriber detenido con pull habilitado']
    });
  }

  const pending = Number(snapshot?.outboxPendingCount || 0);
  const oldestSeconds = Number(snapshot?.outboxOldestPendingSeconds || 0);
  if (pending >= 100 || oldestSeconds >= 600) {
    health = mergeHealth(health, {
      status: 'critical',
      reasons: ['Backlog de outbox alto o envejecido']
    });
  } else if (pending > 0 || oldestSeconds >= 120) {
    health = mergeHealth(health, {
      status: 'warn',
      reasons: ['Outbox con pendientes por drenar']
    });
  }

  const conflicts = Number(snapshot?.conflicts || 0);
  if (conflicts >= 10) {
    health = mergeHealth(health, {
      status: 'critical',
      reasons: ['Conflictos de reconciliación por encima del umbral crítico']
    });
  } else if (conflicts > 0) {
    health = mergeHealth(health, {
      status: 'warn',
      reasons: ['Conflictos de reconciliación detectados']
    });
  }

  return {
    status: health.status,
    reasons: Array.from(new Set(health.reasons || []))
  };
}

export async function bootstrapLocalSync() {
  if (runtimeContext) return runtimeContext;

  if (!LOCAL_SYNC_CONFIG?.enabled) {
    runtimeContext = {
      enabled: false,
      stop: stopLocalSync
    };
    return runtimeContext;
  }

  await initLocalDbClient();

  if (LOCAL_SYNC_CONFIG.electricPullEnabled) {
    await startElectricSubscriber({
      pollMs: Math.max(3000, Number(LOCAL_SYNC_CONFIG.outboxPollMs || 5000) * 2)
    });
  }

  runtimeContext = {
    enabled: true,
    startedAt: new Date().toISOString(),
    stop: stopLocalSync
  };
  return runtimeContext;
}

export async function stopLocalSync() {
  runtimeContext = null;
  await stopElectricSubscriber();
  await closeLocalDbClient();
}

export function getLocalSyncContext() {
  return runtimeContext;
}

export async function runOutboxTick(options = {}) {
  const result = await processOutboxTick(options);
  return Number(result?.synced || 0) > 0;
}

export async function listOutboxEvents() {
  return listLocalOutboxEvents({ limit: 500 });
}

export async function listConflictEvents(options = {}) {
  return listReconciliationConflicts(options);
}

export async function clearConflictEvents(options = {}) {
  return clearConflictLogRecords(options);
}

export async function clearOutboxEvents() {
  return clearLocalOutboxEvents();
}

export async function clearLocalReadCache() {
  await Promise.all([
    clearSyncStateRecords(),
    clearShapeMaterializationRows()
  ]);
  return true;
}

export async function clearConvergenceTimeline(options = {}) {
  return clearSyncMetricSnapshots(options);
}

export async function listConvergenceTimeline({ limit = 40, businessId = null } = {}) {
  return listSyncMetricSnapshots({ limit, businessId });
}

export async function appendSyncAlertAudit(input = {}) {
  return appendSyncAlertAuditRecord(input);
}

export async function listSyncAlertAudit({ businessId = null, limit = 50 } = {}) {
  return listSyncAlertAuditRecords({ businessId, limit });
}

export async function clearSyncAlertAudit({ businessId = null } = {}) {
  return clearSyncAlertAuditRecords({ businessId });
}

async function getOutboxBacklogStats() {
  const pending = await listLocalOutboxEvents({ statuses: ['pending'], limit: 5000 });
  const now = Date.now();
  const oldestPendingMs = pending.reduce((acc, row) => {
    const ts = Date.parse(String(row?.created_at || ''));
    if (!Number.isFinite(ts)) return acc;
    if (acc === null) return now - ts;
    return Math.max(acc, now - ts);
  }, null);

  return {
    pendingCount: pending.length,
    oldestPendingSeconds: Number.isFinite(Number(oldestPendingMs))
      ? Math.max(0, Math.round(Number(oldestPendingMs) / 1000))
      : 0
  };
}

export async function listConvergenceMetrics() {
  const reconciliation = await reconcileLocalState();
  const localDb = getLocalDbClientState();
  const electric = getElectricSubscriberState();
  const syncState = await listSyncStateRecords({ limit: 1000 });
  const materialized = await getShapeMaterializationStats();
  const outboxBacklog = await getOutboxBacklogStats();

  const snapshot = {
    key: 'sync.runtime',
    enabled: Boolean(runtimeContext?.enabled),
    dbMode: localDb?.meta?.mode || 'disabled',
    electricRunning: Boolean(electric?.running),
    electricTicks: Number(electric?.ticks || 0),
    electricPulled: Number(electric?.lastPullSummary?.pulled || 0),
    electricUpserted: Number(electric?.lastPullSummary?.upserted || 0),
    syncedShapes: Array.isArray(syncState) ? syncState.length : 0,
    materializedShapes: Number(materialized?.shapes || 0),
    materializedRows: Number(materialized?.totalRows || 0),
    outboxPendingCount: Number(outboxBacklog?.pendingCount || 0),
    outboxOldestPendingSeconds: Number(outboxBacklog?.oldestPendingSeconds || 0),
    reconciled: Number(reconciliation?.reconciled || 0),
    conflicts: Number(reconciliation?.conflicts || 0)
  };

  const health = evaluateConvergenceHealth(snapshot);

  const enrichedSnapshot = {
    ...snapshot,
    healthStatus: health.status,
    healthReasons: health.reasons
  };

  await appendSyncMetricSnapshot({
    snapshot: enrichedSnapshot
  });

  return [{
    ...enrichedSnapshot
  }];
}
