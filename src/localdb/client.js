import { LOCAL_SYNC_CONFIG } from '../config/localSync.js';

const TABLE_STORAGE_PREFIX = 'stocky.localdb.table.v1';

const DB_STATE = {
  ready: false,
  engine: null,
  connection: null,
  meta: {
    mode: 'disabled', // disabled | pglite | memory
    initializedAt: null,
  }
};

function nowIso() {
  return new Date().toISOString();
}

function canUseLocalStorage() {
  return typeof window !== 'undefined' && !!window.localStorage;
}

function getTableStorageKey(mode, tableName) {
  return `${TABLE_STORAGE_PREFIX}:${String(mode || 'memory')}:${String(tableName || '').trim()}`;
}

function readTableFromLocalStorage(mode, tableName) {
  if (!canUseLocalStorage()) return [];
  try {
    const raw = window.localStorage.getItem(getTableStorageKey(mode, tableName));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeTableToLocalStorage(mode, tableName, rows = []) {
  if (!canUseLocalStorage()) return;
  try {
    window.localStorage.setItem(
      getTableStorageKey(mode, tableName),
      JSON.stringify(Array.isArray(rows) ? rows : [])
    );
  } catch {
    // no-op
  }
}

function cloneRows(rows = []) {
  return Array.isArray(rows)
    ? rows.map((row) => ({ ...(row || {}) }))
    : [];
}

function getTableQueuesMap() {
  return DB_STATE.connection?.txQueues instanceof Map
    ? DB_STATE.connection.txQueues
    : null;
}

function ensureTableQueue(tableName) {
  const queues = getTableQueuesMap();
  if (!queues) return null;

  const normalizedTable = String(tableName || '').trim();
  if (!normalizedTable) return null;

  if (!queues.has(normalizedTable)) {
    queues.set(normalizedTable, Promise.resolve());
  }

  return normalizedTable;
}

function isTableStoreActive() {
  return Boolean(
    DB_STATE.ready
    && DB_STATE.meta?.mode !== 'disabled'
    && DB_STATE.connection
    && DB_STATE.connection.tables instanceof Map
  );
}

/**
 * Inicializa el cliente local DB.
 * - Por defecto no impacta el runtime actual (modo disabled).
 * - Queda preparado para activar PGlite por feature flag en fases siguientes.
 */
export async function initLocalDbClient() {
  if (DB_STATE.ready) return DB_STATE;

  if (!LOCAL_SYNC_CONFIG?.enabled) {
    DB_STATE.ready = true;
    DB_STATE.meta = {
      mode: 'disabled',
      initializedAt: nowIso()
    };
    return DB_STATE;
  }

  // Placeholder: en la siguiente iteración se activa PGlite real.
  // Mantener this branch evita romper el flujo actual mientras
  // se implementa migración progresiva.
  if (LOCAL_SYNC_CONFIG?.preferPGlite) {
    DB_STATE.ready = true;
    DB_STATE.connection = {
      tables: new Map(),
      txQueues: new Map()
    };
    DB_STATE.meta = {
      mode: 'pglite',
      initializedAt: nowIso()
    };
    return DB_STATE;
  }

  DB_STATE.ready = true;
  DB_STATE.connection = {
    tables: new Map(),
    txQueues: new Map()
  };
  DB_STATE.meta = {
    mode: 'memory',
    initializedAt: nowIso()
  };
  return DB_STATE;
}

export function getLocalDbClientState() {
  return {
    ready: DB_STATE.ready,
    engine: DB_STATE.engine,
    hasConnection: Boolean(DB_STATE.connection),
    meta: { ...DB_STATE.meta }
  };
}

export async function closeLocalDbClient() {
  DB_STATE.ready = false;
  DB_STATE.engine = null;
  DB_STATE.connection = null;
  DB_STATE.meta = {
    mode: 'disabled',
    initializedAt: null
  };
  return true;
}

export function isLocalDbTableStoreActive() {
  return isTableStoreActive();
}

export function readLocalDbTableRows(tableName) {
  const normalizedTable = String(tableName || '').trim();
  if (!normalizedTable || !isTableStoreActive()) return null;

  const tables = DB_STATE.connection.tables;
  if (!tables.has(normalizedTable)) {
    const initialRows = readTableFromLocalStorage(DB_STATE.meta?.mode, normalizedTable);
    tables.set(normalizedTable, cloneRows(initialRows));
  }

  return cloneRows(tables.get(normalizedTable) || []);
}

export function writeLocalDbTableRows(tableName, rows = []) {
  const normalizedTable = String(tableName || '').trim();
  if (!normalizedTable || !isTableStoreActive()) return false;

  const normalizedRows = cloneRows(rows);
  DB_STATE.connection.tables.set(normalizedTable, normalizedRows);
  writeTableToLocalStorage(DB_STATE.meta?.mode, normalizedTable, normalizedRows);
  return true;
}

export async function runLocalDbTableTransaction(tableName, handler) {
  const normalizedTable = ensureTableQueue(tableName);
  if (!normalizedTable || typeof handler !== 'function' || !isTableStoreActive()) {
    return null;
  }

  const queues = getTableQueuesMap();
  if (!queues) return null;

  const previous = queues.get(normalizedTable) || Promise.resolve();
  const run = previous
    .catch(() => {
      // Evitar bloqueo permanente de la cola si la transacción previa falló.
    })
    .then(async () => {
      const currentRows = readLocalDbTableRows(normalizedTable) || [];
      const draftRows = cloneRows(currentRows);
      const txOutcome = await handler(draftRows);

      let nextRows = draftRows;
      let result = txOutcome;

      if (txOutcome && typeof txOutcome === 'object' && Array.isArray(txOutcome.rows)) {
        nextRows = txOutcome.rows;
        result = txOutcome.result;
      }

      writeLocalDbTableRows(normalizedTable, nextRows);
      return result;
    });

  queues.set(normalizedTable, run);
  return run;
}

export default {
  initLocalDbClient,
  getLocalDbClientState,
  closeLocalDbClient,
  readLocalDbTableRows,
  writeLocalDbTableRows,
  isLocalDbTableStoreActive,
  runLocalDbTableTransaction
};
