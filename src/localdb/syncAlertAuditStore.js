import { readLocalDbTableRows, writeLocalDbTableRows } from './client.js';

const SYNC_ALERT_AUDIT_STORAGE_KEY = 'stocky.localdb.sync_alert_audit.v1';

let inMemoryAuditRows = [];

function nowIso() {
  return new Date().toISOString();
}

function makeAuditId() {
  return `sync-alert-audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function canUseLocalStorage() {
  return typeof window !== 'undefined' && !!window.localStorage;
}

function readFromLocalStorage() {
  try {
    const raw = window.localStorage.getItem(SYNC_ALERT_AUDIT_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeToLocalStorage(rows = []) {
  try {
    window.localStorage.setItem(SYNC_ALERT_AUDIT_STORAGE_KEY, JSON.stringify(Array.isArray(rows) ? rows : []));
  } catch {
    // no-op
  }
}

function readStorage() {
  const tableRows = readLocalDbTableRows('sync_alert_audit');
  if (Array.isArray(tableRows)) {
    if (tableRows.length > 0) return tableRows;

    const legacyRows = canUseLocalStorage()
      ? readFromLocalStorage()
      : (Array.isArray(inMemoryAuditRows) ? [...inMemoryAuditRows] : []);

    if (legacyRows.length > 0) {
      writeLocalDbTableRows('sync_alert_audit', legacyRows);
      return legacyRows;
    }

    return tableRows;
  }

  if (canUseLocalStorage()) return readFromLocalStorage();
  return Array.isArray(inMemoryAuditRows) ? [...inMemoryAuditRows] : [];
}

function writeStorage(rows = []) {
  const normalized = Array.isArray(rows) ? rows : [];
  if (writeLocalDbTableRows('sync_alert_audit', normalized)) {
    return;
  }

  if (canUseLocalStorage()) {
    writeToLocalStorage(normalized);
    return;
  }
  inMemoryAuditRows = [...normalized];
}

function normalizeAuditRecord(input = {}) {
  const createdAt = String(input.created_at || input.createdAt || nowIso()).trim() || nowIso();
  return {
    id: String(input.id || makeAuditId()).trim(),
    business_id: String(input.business_id || input.businessId || '').trim() || null,
    action: String(input.action || '').trim() || 'unknown',
    details: input.details && typeof input.details === 'object' ? input.details : null,
    created_at: createdAt
  };
}

export async function appendSyncAlertAuditRecord(input = {}) {
  const normalized = normalizeAuditRecord(input);
  const rows = readStorage();
  rows.push(normalized);
  writeStorage(rows);
  return normalized;
}

export async function listSyncAlertAuditRecords({ businessId = null, limit = 50 } = {}) {
  const normalizedBusinessId = String(businessId || '').trim() || null;
  return readStorage()
    .filter((row) => {
      if (!normalizedBusinessId) return true;
      return String(row?.business_id || '').trim() === normalizedBusinessId;
    })
    .sort((a, b) => Date.parse(String(b?.created_at || '')) - Date.parse(String(a?.created_at || '')))
    .slice(0, Math.max(1, Number(limit || 50)));
}

export async function clearSyncAlertAuditRecords({ businessId = null } = {}) {
  const normalizedBusinessId = String(businessId || '').trim() || null;
  if (!normalizedBusinessId) {
    writeStorage([]);
    return true;
  }

  const next = readStorage().filter((row) => String(row?.business_id || '').trim() !== normalizedBusinessId);
  writeStorage(next);
  return true;
}

export function __unsafeResetSyncAlertAuditStoreForTests() {
  inMemoryAuditRows = [];
  writeLocalDbTableRows('sync_alert_audit', []);
}

export default {
  appendSyncAlertAuditRecord,
  listSyncAlertAuditRecords,
  clearSyncAlertAuditRecords
};
