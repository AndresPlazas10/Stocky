import {
  isLocalDbTableStoreActive,
  readLocalDbTableRows,
  runLocalDbTableTransaction,
  writeLocalDbTableRows
} from './client.js';

const SYNC_STATE_STORAGE_KEY = 'stocky.localdb.sync_state.v1';

let inMemorySyncState = [];

function nowIso() {
  return new Date().toISOString();
}

function canUseLocalStorage() {
  return typeof window !== 'undefined' && !!window.localStorage;
}

function readFromLocalStorage() {
  try {
    const raw = window.localStorage.getItem(SYNC_STATE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeToLocalStorage(rows = []) {
  try {
    window.localStorage.setItem(SYNC_STATE_STORAGE_KEY, JSON.stringify(Array.isArray(rows) ? rows : []));
  } catch {
    // no-op
  }
}

function readSyncStateStorage() {
  const tableRows = readLocalDbTableRows('sync_state');
  if (Array.isArray(tableRows)) {
    if (tableRows.length > 0) return tableRows;

    const legacyRows = canUseLocalStorage()
      ? readFromLocalStorage()
      : (Array.isArray(inMemorySyncState) ? [...inMemorySyncState] : []);

    if (legacyRows.length > 0) {
      writeLocalDbTableRows('sync_state', legacyRows);
      return legacyRows;
    }

    return tableRows;
  }

  if (canUseLocalStorage()) return readFromLocalStorage();
  return Array.isArray(inMemorySyncState) ? [...inMemorySyncState] : [];
}

function writeSyncStateStorage(rows = []) {
  const normalized = Array.isArray(rows) ? rows : [];
  if (writeLocalDbTableRows('sync_state', normalized)) {
    return;
  }

  if (canUseLocalStorage()) {
    writeToLocalStorage(normalized);
    return;
  }
  inMemorySyncState = [...normalized];
}

function buildSyncStateId(businessId, shapeKey) {
  return `sync:${String(businessId || '').trim()}:${String(shapeKey || '').trim()}`;
}

export function normalizeSyncStateRecord(input = {}) {
  const businessId = String(input.business_id || input.businessId || '').trim();
  const shapeKey = String(input.shape_key || input.shapeKey || '').trim();
  const updatedAt = String(input.updated_at || input.updatedAt || nowIso()).trim() || nowIso();

  return {
    id: String(input.id || buildSyncStateId(businessId, shapeKey)).trim(),
    business_id: businessId,
    shape_key: shapeKey,
    cursor_value: input.cursor_value ?? input.cursorValue ?? null,
    last_pulled_at: String(input.last_pulled_at || input.lastPulledAt || updatedAt).trim() || updatedAt,
    pull_count: Number.isFinite(Number(input.pull_count)) ? Number(input.pull_count) : 0,
    last_error: input.last_error ? String(input.last_error) : null,
    updated_at: updatedAt
  };
}

export async function listSyncStateRecords({
  businessId = null,
  limit = 500
} = {}) {
  const normalizedBusinessId = String(businessId || '').trim() || null;

  return readSyncStateStorage()
    .filter((row) => {
      if (!normalizedBusinessId) return true;
      return String(row?.business_id || '').trim() === normalizedBusinessId;
    })
    .sort((a, b) => Date.parse(String(b?.updated_at || '')) - Date.parse(String(a?.updated_at || '')))
    .slice(0, Math.max(1, Number(limit || 500)));
}

export async function getSyncStateRecord({ businessId, shapeKey }) {
  const normalizedBusinessId = String(businessId || '').trim();
  const normalizedShapeKey = String(shapeKey || '').trim();
  if (!normalizedBusinessId || !normalizedShapeKey) return null;

  const id = buildSyncStateId(normalizedBusinessId, normalizedShapeKey);
  return readSyncStateStorage().find((row) => String(row?.id || '').trim() === id) || null;
}

export async function upsertSyncStateRecord({
  businessId,
  shapeKey,
  cursorValue = null,
  pulledAt = null,
  incrementPullCount = true,
  lastError = null
} = {}) {
  const normalizedBusinessId = String(businessId || '').trim();
  const normalizedShapeKey = String(shapeKey || '').trim();
  if (!normalizedBusinessId || !normalizedShapeKey) return null;

  if (isLocalDbTableStoreActive()) {
    const txResult = await runLocalDbTableTransaction('sync_state', (rows) => {
      const id = buildSyncStateId(normalizedBusinessId, normalizedShapeKey);
      const existing = rows.find((row) => String(row?.id || '').trim() === id) || null;

      const next = normalizeSyncStateRecord({
        ...(existing || {}),
        id,
        business_id: normalizedBusinessId,
        shape_key: normalizedShapeKey,
        cursor_value: cursorValue,
        last_pulled_at: pulledAt || nowIso(),
        pull_count: incrementPullCount
          ? Number(existing?.pull_count || 0) + 1
          : Number(existing?.pull_count || 0),
        last_error: lastError ? String(lastError) : null,
        updated_at: nowIso()
      });

      const filtered = rows.filter((row) => String(row?.id || '').trim() !== id);
      filtered.push(next);
      return {
        rows: filtered,
        result: next
      };
    });

    return txResult || null;
  }

  const rows = readSyncStateStorage();
  const id = buildSyncStateId(normalizedBusinessId, normalizedShapeKey);
  const existing = rows.find((row) => String(row?.id || '').trim() === id) || null;

  const next = normalizeSyncStateRecord({
    ...(existing || {}),
    id,
    business_id: normalizedBusinessId,
    shape_key: normalizedShapeKey,
    cursor_value: cursorValue,
    last_pulled_at: pulledAt || nowIso(),
    pull_count: incrementPullCount
      ? Number(existing?.pull_count || 0) + 1
      : Number(existing?.pull_count || 0),
    last_error: lastError ? String(lastError) : null,
    updated_at: nowIso()
  });

  const filtered = rows.filter((row) => String(row?.id || '').trim() !== id);
  filtered.push(next);
  writeSyncStateStorage(filtered);

  return next;
}

export async function clearSyncStateRecords({ businessId = null } = {}) {
  const normalizedBusinessId = String(businessId || '').trim() || null;

  if (isLocalDbTableStoreActive()) {
    await runLocalDbTableTransaction('sync_state', (rows) => {
      if (!normalizedBusinessId) {
        return {
          rows: [],
          result: true
        };
      }

      const next = rows.filter((row) => String(row?.business_id || '').trim() !== normalizedBusinessId);
      return {
        rows: next,
        result: true
      };
    });
    return true;
  }

  const rows = readSyncStateStorage();

  if (!normalizedBusinessId) {
    writeSyncStateStorage([]);
    return true;
  }

  const next = rows.filter((row) => String(row?.business_id || '').trim() !== normalizedBusinessId);
  writeSyncStateStorage(next);
  return true;
}

export function __unsafeResetSyncStateStoreForTests() {
  inMemorySyncState = [];
  writeLocalDbTableRows('sync_state', []);
}

export default {
  listSyncStateRecords,
  getSyncStateRecord,
  upsertSyncStateRecord,
  clearSyncStateRecords
};
