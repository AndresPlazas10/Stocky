import { readLocalDbTableRows, writeLocalDbTableRows } from './client.js';

const CONFLICT_LOG_STORAGE_KEY = 'stocky.localdb.conflict_log.v1';

let inMemoryConflictLog = [];

function nowIso() {
  return new Date().toISOString();
}

function makeConflictId() {
  return `conflict-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function canUseLocalStorage() {
  return typeof window !== 'undefined' && !!window.localStorage;
}

function readFromLocalStorage() {
  try {
    const raw = window.localStorage.getItem(CONFLICT_LOG_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeToLocalStorage(items = []) {
  try {
    window.localStorage.setItem(CONFLICT_LOG_STORAGE_KEY, JSON.stringify(Array.isArray(items) ? items : []));
  } catch {
    // no-op
  }
}

function readConflictStorage() {
  const tableRows = readLocalDbTableRows('conflict_log');
  if (Array.isArray(tableRows)) {
    if (tableRows.length > 0) return tableRows;

    const legacyRows = canUseLocalStorage()
      ? readFromLocalStorage()
      : (Array.isArray(inMemoryConflictLog) ? [...inMemoryConflictLog] : []);

    if (legacyRows.length > 0) {
      writeLocalDbTableRows('conflict_log', legacyRows);
      return legacyRows;
    }

    return tableRows;
  }

  if (canUseLocalStorage()) return readFromLocalStorage();
  return Array.isArray(inMemoryConflictLog) ? [...inMemoryConflictLog] : [];
}

function writeConflictStorage(items = []) {
  const normalized = Array.isArray(items) ? items : [];
  if (writeLocalDbTableRows('conflict_log', normalized)) {
    return;
  }

  if (canUseLocalStorage()) {
    writeToLocalStorage(normalized);
    return;
  }
  inMemoryConflictLog = [...normalized];
}

export function normalizeConflictRecord(input = {}) {
  const createdAt = String(input.created_at || input.createdAt || nowIso()).trim() || nowIso();

  return {
    id: String(input.id || makeConflictId()).trim(),
    business_id: String(input.business_id || input.businessId || '').trim(),
    mutation_id: String(input.mutation_id || input.mutationId || '').trim() || null,
    mutation_type: String(input.mutation_type || input.mutationType || '').trim() || null,
    conflict_type: String(input.conflict_type || input.conflictType || 'sync.conflict').trim() || 'sync.conflict',
    reason: String(input.reason || '').trim(),
    details: input.details ?? input.payload ?? null,
    created_at: createdAt
  };
}

export async function appendConflictLogRecord(input = {}) {
  const normalized = normalizeConflictRecord(input);
  if (!normalized.business_id || !normalized.reason) return null;

  const rows = readConflictStorage();
  rows.push(normalized);
  writeConflictStorage(rows);
  return normalized;
}

export async function listConflictLogRecords({
  businessId = null,
  limit = 500
} = {}) {
  const normalizedBusinessId = String(businessId || '').trim() || null;

  return readConflictStorage()
    .filter((row) => {
      if (!normalizedBusinessId) return true;
      return String(row?.business_id || '').trim() === normalizedBusinessId;
    })
    .sort((a, b) => Date.parse(String(b?.created_at || '')) - Date.parse(String(a?.created_at || '')))
    .slice(0, Math.max(1, Number(limit || 500)));
}

export async function clearConflictLogRecords({ businessId = null } = {}) {
  const normalizedBusinessId = String(businessId || '').trim() || null;
  const rows = readConflictStorage();

  if (!normalizedBusinessId) {
    writeConflictStorage([]);
    return true;
  }

  const next = rows.filter((row) => String(row?.business_id || '').trim() !== normalizedBusinessId);
  writeConflictStorage(next);
  return true;
}

export function __unsafeResetConflictLogStoreForTests() {
  inMemoryConflictLog = [];
  writeLocalDbTableRows('conflict_log', []);
}

export default {
  appendConflictLogRecord,
  listConflictLogRecords,
  clearConflictLogRecords
};
