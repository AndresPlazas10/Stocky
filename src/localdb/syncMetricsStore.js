import { readLocalDbTableRows, writeLocalDbTableRows } from './client.js';

const SYNC_METRICS_STORAGE_KEY = 'stocky.localdb.sync_metrics.v1';

let inMemorySyncMetrics = [];

function nowIso() {
  return new Date().toISOString();
}

function makeMetricId() {
  return `sync-metric-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function canUseLocalStorage() {
  return typeof window !== 'undefined' && !!window.localStorage;
}

function readFromLocalStorage() {
  try {
    const raw = window.localStorage.getItem(SYNC_METRICS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeToLocalStorage(rows = []) {
  try {
    window.localStorage.setItem(SYNC_METRICS_STORAGE_KEY, JSON.stringify(Array.isArray(rows) ? rows : []));
  } catch {
    // no-op
  }
}

function readStorage() {
  const tableRows = readLocalDbTableRows('sync_metrics');
  if (Array.isArray(tableRows)) {
    if (tableRows.length > 0) return tableRows;

    const legacyRows = canUseLocalStorage()
      ? readFromLocalStorage()
      : (Array.isArray(inMemorySyncMetrics) ? [...inMemorySyncMetrics] : []);

    if (legacyRows.length > 0) {
      writeLocalDbTableRows('sync_metrics', legacyRows);
      return legacyRows;
    }

    return tableRows;
  }

  if (canUseLocalStorage()) return readFromLocalStorage();
  return Array.isArray(inMemorySyncMetrics) ? [...inMemorySyncMetrics] : [];
}

function writeStorage(rows = []) {
  const normalized = Array.isArray(rows) ? rows : [];
  if (writeLocalDbTableRows('sync_metrics', normalized)) {
    return;
  }

  if (canUseLocalStorage()) {
    writeToLocalStorage(normalized);
    return;
  }
  inMemorySyncMetrics = [...normalized];
}

function normalizeMetricRecord(input = {}) {
  const createdAt = String(input.created_at || input.createdAt || nowIso()).trim() || nowIso();
  const snapshot = input.snapshot && typeof input.snapshot === 'object' ? input.snapshot : {};

  return {
    id: String(input.id || makeMetricId()).trim(),
    business_id: String(input.business_id || input.businessId || snapshot.business_id || '').trim() || null,
    created_at: createdAt,
    snapshot
  };
}

export async function appendSyncMetricSnapshot({
  snapshot = {},
  businessId = null,
  maxEntries = 300
} = {}) {
  const normalized = normalizeMetricRecord({
    business_id: businessId,
    snapshot
  });

  const rows = readStorage();
  rows.push(normalized);

  const cap = Math.max(10, Number(maxEntries || 300));
  if (rows.length > cap) {
    const ordered = rows.sort((a, b) => Date.parse(String(a?.created_at || '')) - Date.parse(String(b?.created_at || '')));
    const trimmed = ordered.slice(Math.max(0, ordered.length - cap));
    writeStorage(trimmed);
  } else {
    writeStorage(rows);
  }

  return normalized;
}

export async function listSyncMetricSnapshots({
  businessId = null,
  limit = 40
} = {}) {
  const normalizedBusinessId = String(businessId || '').trim() || null;

  return readStorage()
    .filter((row) => {
      if (!normalizedBusinessId) return true;
      return String(row?.business_id || '').trim() === normalizedBusinessId;
    })
    .sort((a, b) => Date.parse(String(b?.created_at || '')) - Date.parse(String(a?.created_at || '')))
    .slice(0, Math.max(1, Number(limit || 40)));
}

export async function clearSyncMetricSnapshots({ businessId = null } = {}) {
  const normalizedBusinessId = String(businessId || '').trim() || null;
  if (!normalizedBusinessId) {
    writeStorage([]);
    return true;
  }

  const next = readStorage().filter((row) => String(row?.business_id || '').trim() !== normalizedBusinessId);
  writeStorage(next);
  return true;
}

export function __unsafeResetSyncMetricsStoreForTests() {
  inMemorySyncMetrics = [];
  writeLocalDbTableRows('sync_metrics', []);
}

export default {
  appendSyncMetricSnapshot,
  listSyncMetricSnapshots,
  clearSyncMetricSnapshots
};
