import {
  isLocalDbTableStoreActive,
  readLocalDbTableRows,
  runLocalDbTableTransaction,
  writeLocalDbTableRows
} from './client.js';

const SHAPE_MATERIALIZATION_STORAGE_KEY = 'stocky.localdb.shape_materialization.v1';

let inMemoryMaterializedRows = [];

function nowIso() {
  return new Date().toISOString();
}

function canUseLocalStorage() {
  return typeof window !== 'undefined' && !!window.localStorage;
}

function readFromLocalStorage() {
  try {
    const raw = window.localStorage.getItem(SHAPE_MATERIALIZATION_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeToLocalStorage(rows = []) {
  try {
    window.localStorage.setItem(SHAPE_MATERIALIZATION_STORAGE_KEY, JSON.stringify(Array.isArray(rows) ? rows : []));
  } catch {
    // no-op
  }
}

function readStorage() {
  const tableRows = readLocalDbTableRows('shape_materialization');
  if (Array.isArray(tableRows)) {
    if (tableRows.length > 0) return tableRows;

    const legacyRows = canUseLocalStorage()
      ? readFromLocalStorage()
      : (Array.isArray(inMemoryMaterializedRows) ? [...inMemoryMaterializedRows] : []);

    if (legacyRows.length > 0) {
      writeLocalDbTableRows('shape_materialization', legacyRows);
      return legacyRows;
    }

    return tableRows;
  }

  if (canUseLocalStorage()) return readFromLocalStorage();
  return Array.isArray(inMemoryMaterializedRows) ? [...inMemoryMaterializedRows] : [];
}

function writeStorage(rows = []) {
  const normalized = Array.isArray(rows) ? rows : [];
  if (writeLocalDbTableRows('shape_materialization', normalized)) {
    return;
  }

  if (canUseLocalStorage()) {
    writeToLocalStorage(normalized);
    return;
  }
  inMemoryMaterializedRows = [...normalized];
}

function parseSortableDate(value) {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function isIncomingRowNewer(current, incoming, cursorColumn = 'updated_at') {
  const currentCursor = current?.[cursorColumn] || current?.updated_at || null;
  const incomingCursor = incoming?.[cursorColumn] || incoming?.updated_at || null;

  const currentTs = parseSortableDate(currentCursor);
  const incomingTs = parseSortableDate(incomingCursor);

  if (currentTs !== null && incomingTs !== null) {
    return incomingTs >= currentTs;
  }

  return String(incomingCursor || '') >= String(currentCursor || '');
}

function normalizeRecord(input = {}) {
  return {
    id: String(input.id || '').trim(),
    business_id: String(input.business_id || '').trim(),
    shape_key: String(input.shape_key || '').trim(),
    row_id: String(input.row_id || '').trim(),
    row: input.row ?? null,
    updated_at: String(input.updated_at || nowIso()).trim() || nowIso(),
    last_synced_at: String(input.last_synced_at || nowIso()).trim() || nowIso()
  };
}

export async function upsertShapeRows({
  businessId,
  shapeKey,
  rows = [],
  cursorColumn = 'updated_at'
} = {}) {
  const normalizedBusinessId = String(businessId || '').trim();
  const normalizedShapeKey = String(shapeKey || '').trim();
  const inputRows = Array.isArray(rows) ? rows : [];

  if (!normalizedBusinessId || !normalizedShapeKey || inputRows.length === 0) {
    return { upserted: 0 };
  }

  if (isLocalDbTableStoreActive()) {
    const txResult = await runLocalDbTableTransaction('shape_materialization', (storage) => {
      let upserted = 0;

      for (const row of inputRows) {
        const rowId = String(row?.id || '').trim();
        if (!rowId) continue;

        const recordId = `${normalizedBusinessId}:${normalizedShapeKey}:${rowId}`;
        const incoming = normalizeRecord({
          id: recordId,
          business_id: normalizedBusinessId,
          shape_key: normalizedShapeKey,
          row_id: rowId,
          row,
          updated_at: String(row?.[cursorColumn] || row?.updated_at || nowIso()),
          last_synced_at: nowIso()
        });

        const index = storage.findIndex((entry) => String(entry?.id || '').trim() === recordId);
        if (index < 0) {
          storage.push(incoming);
          upserted += 1;
          continue;
        }

        const current = storage[index];
        if (isIncomingRowNewer(current?.row, incoming?.row, cursorColumn)) {
          storage[index] = incoming;
          upserted += 1;
        }
      }

      return {
        rows: storage,
        result: { upserted }
      };
    });

    return txResult || { upserted: 0 };
  }

  const storage = readStorage();
  let upserted = 0;

  for (const row of inputRows) {
    const rowId = String(row?.id || '').trim();
    if (!rowId) continue;

    const recordId = `${normalizedBusinessId}:${normalizedShapeKey}:${rowId}`;
    const incoming = normalizeRecord({
      id: recordId,
      business_id: normalizedBusinessId,
      shape_key: normalizedShapeKey,
      row_id: rowId,
      row,
      updated_at: String(row?.[cursorColumn] || row?.updated_at || nowIso()),
      last_synced_at: nowIso()
    });

    const index = storage.findIndex((entry) => String(entry?.id || '').trim() === recordId);
    if (index < 0) {
      storage.push(incoming);
      upserted += 1;
      continue;
    }

    const current = storage[index];
    if (isIncomingRowNewer(current?.row, incoming?.row, cursorColumn)) {
      storage[index] = incoming;
      upserted += 1;
    }
  }

  writeStorage(storage);
  return { upserted };
}

export async function listShapeRows({
  businessId,
  shapeKey,
  limit = 200
} = {}) {
  const normalizedBusinessId = String(businessId || '').trim() || null;
  const normalizedShapeKey = String(shapeKey || '').trim() || null;

  return readStorage()
    .filter((entry) => {
      if (normalizedBusinessId && String(entry?.business_id || '').trim() !== normalizedBusinessId) return false;
      if (normalizedShapeKey && String(entry?.shape_key || '').trim() !== normalizedShapeKey) return false;
      return true;
    })
    .sort((a, b) => Date.parse(String(b?.updated_at || '')) - Date.parse(String(a?.updated_at || '')))
    .slice(0, Math.max(1, Number(limit || 200)))
    .map((entry) => entry.row);
}

export async function getShapeMaterializationStats({ businessId = null } = {}) {
  const normalizedBusinessId = String(businessId || '').trim() || null;
  const rows = readStorage().filter((entry) => {
    if (!normalizedBusinessId) return true;
    return String(entry?.business_id || '').trim() === normalizedBusinessId;
  });

  const byShape = rows.reduce((acc, row) => {
    const key = String(row?.shape_key || '').trim() || 'unknown';
    acc[key] = Number(acc[key] || 0) + 1;
    return acc;
  }, {});

  return {
    totalRows: rows.length,
    shapes: Object.keys(byShape).length,
    byShape
  };
}

export async function clearShapeMaterializationRows({
  businessId = null,
  shapeKey = null
} = {}) {
  const normalizedBusinessId = String(businessId || '').trim() || null;
  const normalizedShapeKey = String(shapeKey || '').trim() || null;

  if (isLocalDbTableStoreActive()) {
    await runLocalDbTableTransaction('shape_materialization', (rows) => {
      const next = rows.filter((entry) => {
        const sameBusiness = normalizedBusinessId
          ? String(entry?.business_id || '').trim() === normalizedBusinessId
          : true;
        const sameShape = normalizedShapeKey
          ? String(entry?.shape_key || '').trim() === normalizedShapeKey
          : true;

        // remover si coincide con el filtro; conservar el resto.
        return !(sameBusiness && sameShape);
      });

      return {
        rows: next,
        result: true
      };
    });
    return true;
  }

  const rows = readStorage();
  const next = rows.filter((entry) => {
    const sameBusiness = normalizedBusinessId
      ? String(entry?.business_id || '').trim() === normalizedBusinessId
      : true;
    const sameShape = normalizedShapeKey
      ? String(entry?.shape_key || '').trim() === normalizedShapeKey
      : true;

    // remover si coincide con el filtro; conservar el resto.
    return !(sameBusiness && sameShape);
  });

  writeStorage(next);
  return true;
}

export function __unsafeResetShapeMaterializationStoreForTests() {
  inMemoryMaterializedRows = [];
  writeLocalDbTableRows('shape_materialization', []);
}

export default {
  upsertShapeRows,
  listShapeRows,
  getShapeMaterializationStats,
  clearShapeMaterializationRows
};
