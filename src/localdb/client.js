import LOCAL_SYNC_CONFIG from '../config/localSync.js';
import { logger } from '../utils/logger.js';
import schemaSql from './schema.sql?raw';

const STORAGE_KEYS = {
  deviceId: 'stocky.local_sync.device_id',
  outbox: 'stocky.local_sync.outbox_events',
  syncState: 'stocky.local_sync.sync_state',
  conflicts: 'stocky.local_sync.conflict_log',
  cache: 'stocky.local_sync.cache',
  cacheFallback: 'stocky.local_sync.cache_fallback',
  metrics: 'stocky.local_sync.metrics'
};

function nowIso() {
  return new Date().toISOString();
}

function generateId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
}

function parseJson(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function percentile(sortedValues = [], ratio = 0.5) {
  if (!Array.isArray(sortedValues) || sortedValues.length === 0) return null;
  const normalizedRatio = Math.min(1, Math.max(0, Number(ratio) || 0));
  const index = Math.ceil(normalizedRatio * sortedValues.length) - 1;
  return sortedValues[Math.max(0, index)] ?? null;
}

class LocalDbClient {
  constructor() {
    this.initialized = false;
    this.initPromise = null;
    this.adapter = 'memory';
    this.memory = {
      outbox: [],
      syncState: {},
      conflicts: [],
      cache: {},
      metrics: []
    };
    this.pglite = null;
  }

  async init() {
    if (this.initialized) return this;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      if (typeof window === 'undefined') {
        this.adapter = 'memory';
        this.initialized = true;
        return this;
      }

      if (LOCAL_SYNC_CONFIG.preferPGlite) {
        try {
          // Import directo para que Vite resuelva el paquete en build/dev.
          const mod = await import('@electric-sql/pglite');
          const PGlite = mod?.PGlite;
          if (typeof PGlite === 'function') {
            this.pglite = new PGlite('idb://stocky-local-first');
            await this.pglite.exec(schemaSql);
            this.adapter = 'pglite';
            this.initialized = true;
            logger.info('[localdb] adapter=pglite');
            return this;
          }
        } catch (error) {
          logger.warn('[localdb] pglite no disponible, fallback localStorage', error?.message || error);
        }
      }

      this.adapter = 'localstorage';
      this._ensureLocalStorageInitialized();
      this.initialized = true;
      logger.info('[localdb] adapter=localstorage');
      return this;
    })();

    try {
      return await this.initPromise;
    } finally {
      this.initPromise = null;
    }
  }

  _ensureLocalStorageInitialized() {
    if (!window?.localStorage) {
      this.adapter = 'memory';
      return;
    }

    if (!window.localStorage.getItem(STORAGE_KEYS.outbox)) {
      window.localStorage.setItem(STORAGE_KEYS.outbox, JSON.stringify([]));
    }
    if (!window.localStorage.getItem(STORAGE_KEYS.syncState)) {
      window.localStorage.setItem(STORAGE_KEYS.syncState, JSON.stringify({}));
    }
    if (!window.localStorage.getItem(STORAGE_KEYS.conflicts)) {
      window.localStorage.setItem(STORAGE_KEYS.conflicts, JSON.stringify([]));
    }
    if (!window.localStorage.getItem(STORAGE_KEYS.cache)) {
      window.localStorage.setItem(STORAGE_KEYS.cache, JSON.stringify({}));
    }
    if (!window.localStorage.getItem(STORAGE_KEYS.cacheFallback)) {
      window.localStorage.setItem(STORAGE_KEYS.cacheFallback, JSON.stringify({}));
    }
    if (!window.localStorage.getItem(STORAGE_KEYS.metrics)) {
      window.localStorage.setItem(STORAGE_KEYS.metrics, JSON.stringify([]));
    }
  }

  _readFallbackCacheObject() {
    if (typeof window === 'undefined' || !window?.localStorage) return {};
    return parseJson(window.localStorage.getItem(STORAGE_KEYS.cacheFallback), {});
  }

  _writeFallbackCacheObject(value) {
    if (typeof window === 'undefined' || !window?.localStorage) return;
    window.localStorage.setItem(STORAGE_KEYS.cacheFallback, JSON.stringify(value || {}));
  }

  _readLocalArray(key) {
    if (this.adapter === 'memory') return this.memory[key] || [];
    return parseJson(window.localStorage.getItem(STORAGE_KEYS[key]), []);
  }

  _writeLocalArray(key, value) {
    if (this.adapter === 'memory') {
      this.memory[key] = value;
      return;
    }
    window.localStorage.setItem(STORAGE_KEYS[key], JSON.stringify(value));
  }

  _readLocalObject(key) {
    if (this.adapter === 'memory') return this.memory[key] || {};
    return parseJson(window.localStorage.getItem(STORAGE_KEYS[key]), {});
  }

  _writeLocalObject(key, value) {
    if (this.adapter === 'memory') {
      this.memory[key] = value;
      return;
    }
    window.localStorage.setItem(STORAGE_KEYS[key], JSON.stringify(value));
  }

  async getDeviceId() {
    await this.init();
    if (this.adapter === 'memory') {
      if (!this.memory.deviceId) this.memory.deviceId = generateId();
      return this.memory.deviceId;
    }

    let deviceId = window.localStorage.getItem(STORAGE_KEYS.deviceId);
    if (!deviceId) {
      deviceId = generateId();
      window.localStorage.setItem(STORAGE_KEYS.deviceId, deviceId);
    }
    return deviceId;
  }

  async enqueueOutboxEvent({
    businessId,
    mutationType,
    payload,
    mutationId = generateId(),
    baseVersions = null
  }) {
    await this.init();
    const event = {
      id: generateId(),
      business_id: businessId,
      mutation_type: mutationType,
      mutation_id: mutationId,
      payload: payload ?? {},
      base_versions: baseVersions,
      status: 'pending',
      retry_count: 0,
      last_error: null,
      ack_payload: null,
      created_at: nowIso(),
      updated_at: nowIso()
    };

    if (this.adapter === 'pglite') {
      const existing = await this.pglite.query(
        `SELECT *
         FROM outbox_events
         WHERE mutation_id = $1
         LIMIT 1`,
        [event.mutation_id]
      );
      const existingRow = existing?.rows?.[0] || null;
      if (existingRow) {
        if (String(existingRow.status || '').toLowerCase() === 'rejected') {
          const reopenedAt = nowIso();
          await this.pglite.query(
            `UPDATE outbox_events
             SET status = $1,
                 retry_count = 0,
                 last_error = NULL,
                 updated_at = $2
             WHERE id = $3`,
            ['pending', reopenedAt, existingRow.id]
          );
          return {
            ...existingRow,
            status: 'pending',
            retry_count: 0,
            last_error: null,
            updated_at: reopenedAt,
            payload: parseJson(existingRow.payload, {}),
            base_versions: parseJson(existingRow.base_versions, null),
            ack_payload: parseJson(existingRow.ack_payload, null)
          };
        }

        return {
          ...existingRow,
          payload: parseJson(existingRow.payload, {}),
          base_versions: parseJson(existingRow.base_versions, null),
          ack_payload: parseJson(existingRow.ack_payload, null)
        };
      }

      await this.pglite.query(
        `INSERT INTO outbox_events (
          id, business_id, mutation_type, mutation_id, payload, base_versions,
          status, retry_count, last_error, ack_payload, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          event.id,
          event.business_id,
          event.mutation_type,
          event.mutation_id,
          JSON.stringify(event.payload),
          event.base_versions ? JSON.stringify(event.base_versions) : null,
          event.status,
          event.retry_count,
          event.last_error,
          event.ack_payload,
          event.created_at,
          event.updated_at
        ]
      );
      return event;
    }

    const outbox = this._readLocalArray('outbox');
    const existingIndex = outbox.findIndex((item) => item.mutation_id === event.mutation_id);
    if (existingIndex >= 0) {
      const existingEvent = outbox[existingIndex];
      if (String(existingEvent?.status || '').toLowerCase() === 'rejected') {
        const reopenedEvent = {
          ...existingEvent,
          status: 'pending',
          retry_count: 0,
          last_error: null,
          updated_at: nowIso()
        };
        outbox[existingIndex] = reopenedEvent;
        this._writeLocalArray('outbox', outbox);
        return reopenedEvent;
      }
      return existingEvent;
    }

    outbox.push(event);
    this._writeLocalArray('outbox', outbox);
    return event;
  }

  async listOutboxEvents({ status = 'pending', limit = 20 } = {}) {
    await this.init();

    if (this.adapter === 'pglite') {
      const result = await this.pglite.query(
        `SELECT *
         FROM outbox_events
         WHERE status = $1
         ORDER BY created_at ASC
         LIMIT $2`,
        [status, limit]
      );
      const rows = result?.rows || [];
      return rows.map((row) => ({
        ...row,
        payload: parseJson(row.payload, {}),
        base_versions: parseJson(row.base_versions, null),
        ack_payload: parseJson(row.ack_payload, null)
      }));
    }

    const outbox = this._readLocalArray('outbox');
    return outbox
      .filter((item) => item.status === status)
      .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
      .slice(0, limit);
  }

  async listTerminalOutboxEvents({ limit = 100 } = {}) {
    await this.init();
    const normalizedLimit = Number(limit) > 0 ? Number(limit) : 100;

    if (this.adapter === 'pglite') {
      const result = await this.pglite.query(
        `SELECT *
         FROM outbox_events
         WHERE status IN ('acked', 'rejected')
         ORDER BY updated_at DESC
         LIMIT $1`,
        [normalizedLimit]
      );
      const rows = result?.rows || [];
      return rows.map((row) => ({
        ...row,
        payload: parseJson(row.payload, {}),
        base_versions: parseJson(row.base_versions, null),
        ack_payload: parseJson(row.ack_payload, null)
      }));
    }

    const outbox = this._readLocalArray('outbox');
    return outbox
      .filter((item) => item.status === 'acked' || item.status === 'rejected')
      .slice()
      .sort((a, b) => String(b.updated_at || b.created_at).localeCompare(String(a.updated_at || a.created_at)))
      .slice(0, normalizedLimit);
  }

  async updateOutboxEvent(eventId, patch = {}) {
    await this.init();

    if (this.adapter === 'pglite') {
      const current = await this.pglite.query(
        'SELECT * FROM outbox_events WHERE id = $1 LIMIT 1',
        [eventId]
      );
      const currentRow = current?.rows?.[0];
      if (!currentRow) return null;
      const next = {
        ...currentRow,
        ...patch,
        updated_at: nowIso()
      };

      await this.pglite.query(
        `UPDATE outbox_events
         SET status = $1,
             retry_count = $2,
             last_error = $3,
             ack_payload = $4,
             updated_at = $5
         WHERE id = $6`,
        [
          next.status,
          Number(next.retry_count || 0),
          next.last_error ?? null,
          next.ack_payload ? JSON.stringify(next.ack_payload) : null,
          next.updated_at,
          eventId
        ]
      );

      return next;
    }

    const outbox = this._readLocalArray('outbox');
    const index = outbox.findIndex((item) => item.id === eventId);
    if (index < 0) return null;
    const next = {
      ...outbox[index],
      ...patch,
      updated_at: nowIso()
    };
    outbox[index] = next;
    this._writeLocalArray('outbox', outbox);
    return next;
  }

  async markOutboxSyncing(eventId) {
    return this.updateOutboxEvent(eventId, { status: 'syncing' });
  }

  async markOutboxAcked(eventId, ackPayload = null) {
    return this.updateOutboxEvent(eventId, {
      status: 'acked',
      ack_payload: ackPayload,
      last_error: null
    });
  }

  async markOutboxPendingWithRetry(eventId, lastError) {
    await this.init();
    const event = await this.getOutboxEventById(eventId);
    if (!event) return null;
    const retryCount = Number(event.retry_count || 0) + 1;
    return this.updateOutboxEvent(eventId, {
      status: 'pending',
      retry_count: retryCount,
      last_error: String(lastError || 'Error de sincronización')
    });
  }

  async markOutboxRejected(eventId, reason) {
    return this.updateOutboxEvent(eventId, {
      status: 'rejected',
      last_error: String(reason || 'Rechazado')
    });
  }

  async getOutboxEventById(eventId) {
    await this.init();

    if (this.adapter === 'pglite') {
      const result = await this.pglite.query(
        'SELECT * FROM outbox_events WHERE id = $1 LIMIT 1',
        [eventId]
      );
      const row = result?.rows?.[0];
      if (!row) return null;
      return {
        ...row,
        payload: parseJson(row.payload, {}),
        base_versions: parseJson(row.base_versions, null),
        ack_payload: parseJson(row.ack_payload, null)
      };
    }

    const outbox = this._readLocalArray('outbox');
    return outbox.find((item) => item.id === eventId) || null;
  }

  async setSyncState(shapeKey, state = {}) {
    await this.init();

    if (this.adapter === 'pglite') {
      await this.pglite.query(
        `INSERT INTO sync_state(shape_key, cursor, lsn, updated_at)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT(shape_key)
         DO UPDATE SET
           cursor = excluded.cursor,
           lsn = excluded.lsn,
           updated_at = excluded.updated_at`,
        [shapeKey, state.cursor || null, state.lsn || null, nowIso()]
      );
      return;
    }

    const syncState = this._readLocalObject('syncState');
    syncState[shapeKey] = {
      ...(syncState[shapeKey] || {}),
      ...state,
      updated_at: nowIso()
    };
    this._writeLocalObject('syncState', syncState);
  }

  async getSyncState(shapeKey) {
    await this.init();

    if (this.adapter === 'pglite') {
      const result = await this.pglite.query(
        'SELECT * FROM sync_state WHERE shape_key = $1 LIMIT 1',
        [shapeKey]
      );
      return result?.rows?.[0] || null;
    }

    const syncState = this._readLocalObject('syncState');
    return syncState[shapeKey] || null;
  }

  async appendConflictLog({
    businessId = null,
    mutationType = null,
    mutationId = null,
    reason,
    details = null
  }) {
    await this.init();
    const conflictEntry = {
      id: generateId(),
      business_id: businessId,
      mutation_type: mutationType,
      mutation_id: mutationId,
      reason: String(reason || 'Conflicto'),
      details: details || null,
      created_at: nowIso()
    };

    if (this.adapter === 'pglite') {
      await this.pglite.query(
        `INSERT INTO conflict_log (
          id, business_id, mutation_type, mutation_id, reason, details, created_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          conflictEntry.id,
          conflictEntry.business_id,
          conflictEntry.mutation_type,
          conflictEntry.mutation_id,
          conflictEntry.reason,
          conflictEntry.details ? JSON.stringify(conflictEntry.details) : null,
          conflictEntry.created_at
        ]
      );
      return conflictEntry;
    }

    const conflicts = this._readLocalArray('conflicts');
    conflicts.push(conflictEntry);
    this._writeLocalArray('conflicts', conflicts);
    return conflictEntry;
  }

  async listConflicts({ limit = 100 } = {}) {
    await this.init();

    if (this.adapter === 'pglite') {
      const result = await this.pglite.query(
        `SELECT *
         FROM conflict_log
         ORDER BY created_at DESC
         LIMIT $1`,
        [limit]
      );
      return (result?.rows || []).map((row) => ({
        ...row,
        details: parseJson(row.details, null)
      }));
    }

    const conflicts = this._readLocalArray('conflicts');
    return conflicts
      .slice()
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .slice(0, limit);
  }

  async clearConflicts() {
    await this.init();

    if (this.adapter === 'pglite') {
      await this.pglite.query('DELETE FROM conflict_log');
      return;
    }

    this._writeLocalArray('conflicts', []);
  }

  async clearOutbox() {
    await this.init();

    if (this.adapter === 'pglite') {
      await this.pglite.query('DELETE FROM outbox_events');
      return;
    }

    this._writeLocalArray('outbox', []);
  }

  async purgeOutboxEventsForTable({
    businessId = null,
    tableId = null,
    orderIds = [],
    preserveMutationIds = []
  } = {}) {
    await this.init();

    const normalizedBusinessId = String(businessId || '').trim();
    const normalizedTableId = String(tableId || '').trim();
    if (!normalizedBusinessId || !normalizedTableId) return 0;

    const normalizedOrderIds = new Set(
      (Array.isArray(orderIds) ? orderIds : [])
        .map((id) => String(id || '').trim())
        .filter(Boolean)
    );
    const preservedMutationIds = new Set(
      (Array.isArray(preserveMutationIds) ? preserveMutationIds : [])
        .map((id) => String(id || '').trim())
        .filter(Boolean)
    );

    const pending = await this.listOutboxEvents({ status: 'pending', limit: 5000 });
    const syncing = await this.listOutboxEvents({ status: 'syncing', limit: 5000 });
    const rejected = await this.listOutboxEvents({ status: 'rejected', limit: 5000 });
    const terminal = await this.listTerminalOutboxEvents({ limit: 5000 });

    const events = [...pending, ...syncing, ...rejected, ...terminal];
    const seenIds = new Set();
    const eventIdsToDelete = [];

    for (const event of events) {
      const eventId = String(event?.id || '').trim();
      if (!eventId || seenIds.has(eventId)) continue;
      seenIds.add(eventId);

      const eventBusinessId = String(event?.business_id || '').trim();
      if (eventBusinessId !== normalizedBusinessId) continue;

      const mutationId = String(event?.mutation_id || '').trim();
      if (mutationId && preservedMutationIds.has(mutationId)) continue;

      const payload = event?.payload && typeof event.payload === 'object' ? event.payload : {};
      const payloadTableId = String(payload?.table_id || payload?.table?.id || '').trim();
      const payloadOrderId = String(payload?.order_id || payload?.order?.id || '').trim();

      const matchesTable = payloadTableId === normalizedTableId;
      const matchesOrder = payloadOrderId && normalizedOrderIds.has(payloadOrderId);

      if (matchesTable || matchesOrder) {
        eventIdsToDelete.push(eventId);
      }
    }

    if (eventIdsToDelete.length === 0) return 0;

    if (this.adapter === 'pglite') {
      for (const eventId of eventIdsToDelete) {
        await this.pglite.query('DELETE FROM outbox_events WHERE id = $1', [eventId]);
      }
      return eventIdsToDelete.length;
    }

    const toDelete = new Set(eventIdsToDelete);
    const outbox = this._readLocalArray('outbox');
    const nextOutbox = outbox.filter((item) => !toDelete.has(String(item?.id || '').trim()));
    this._writeLocalArray('outbox', nextOutbox);
    return outbox.length - nextOutbox.length;
  }

  async setCacheEntry(cacheKey, payload) {
    await this.init();
    if (!cacheKey) return;

    const updatedAt = nowIso();
    const payloadText = JSON.stringify(payload ?? null);

    if (this.adapter === 'pglite') {
      await this.pglite.query(
        `INSERT INTO local_cache(cache_key, payload, updated_at)
         VALUES ($1,$2,$3)
         ON CONFLICT(cache_key)
         DO UPDATE SET
           payload = excluded.payload,
           updated_at = excluded.updated_at`,
        [cacheKey, payloadText, updatedAt]
      );
      try {
        const fallback = this._readFallbackCacheObject();
        fallback[cacheKey] = {
          payload: payload ?? null,
          updated_at: updatedAt
        };
        this._writeFallbackCacheObject(fallback);
      } catch {
        // best-effort
      }
      return;
    }

    const cache = this._readLocalObject('cache');
    cache[cacheKey] = {
      payload: payload ?? null,
      updated_at: updatedAt
    };
    this._writeLocalObject('cache', cache);

    try {
      const fallback = this._readFallbackCacheObject();
      fallback[cacheKey] = {
        payload: payload ?? null,
        updated_at: updatedAt
      };
      this._writeFallbackCacheObject(fallback);
    } catch {
      // best-effort
    }
  }

  async getCacheEntry(cacheKey, { maxAgeMs = 0 } = {}) {
    await this.init();
    if (!cacheKey) return null;

    let entry = null;
    if (this.adapter === 'pglite') {
      const result = await this.pglite.query(
        'SELECT payload, updated_at FROM local_cache WHERE cache_key = $1 LIMIT 1',
        [cacheKey]
      );
      const row = result?.rows?.[0];
      if (row) {
        entry = {
          payload: parseJson(row.payload, null),
          updated_at: row.updated_at
        };
      }
    } else {
      const cache = this._readLocalObject('cache');
      entry = cache[cacheKey] || null;
    }

    if (!entry) {
      try {
        const fallback = this._readFallbackCacheObject();
        entry = fallback?.[cacheKey] || null;
      } catch {
        entry = null;
      }
    }

    if (!entry) return null;

    if (Number(maxAgeMs) > 0) {
      const entryTime = Date.parse(entry.updated_at || '');
      if (Number.isFinite(entryTime)) {
        const age = Date.now() - entryTime;
        if (age > Number(maxAgeMs)) return null;
      }
    }

    return entry.payload ?? null;
  }

  async getLatestCacheEntryByPrefix(cachePrefix, { maxAgeMs = 0 } = {}) {
    await this.init();
    const normalizedPrefix = String(cachePrefix || '').trim();
    if (!normalizedPrefix) return null;

    let entries = [];

    if (this.adapter === 'pglite') {
      const result = await this.pglite.query(
        `SELECT cache_key, payload, updated_at
         FROM local_cache
         WHERE cache_key LIKE $1
         ORDER BY updated_at DESC
         LIMIT 50`,
        [`${normalizedPrefix}%`]
      );
      entries = (result?.rows || []).map((row) => ({
        cache_key: row.cache_key,
        payload: parseJson(row.payload, null),
        updated_at: row.updated_at
      }));
    } else {
      const cache = this._readLocalObject('cache');
      entries = Object.entries(cache || {})
        .filter(([key]) => String(key || '').startsWith(normalizedPrefix))
        .map(([cacheKey, value]) => ({
          cache_key: cacheKey,
          payload: value?.payload ?? null,
          updated_at: value?.updated_at || null
        }))
        .sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')))
        .slice(0, 50);
    }

    if (!entries.length) {
      try {
        const fallback = this._readFallbackCacheObject();
        entries = Object.entries(fallback || {})
          .filter(([key]) => String(key || '').startsWith(normalizedPrefix))
          .map(([cacheKey, value]) => ({
            cache_key: cacheKey,
            payload: value?.payload ?? null,
            updated_at: value?.updated_at || null
          }))
          .sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')))
          .slice(0, 50);
      } catch {
        entries = [];
      }
    }

    const candidate = entries[0];
    if (!candidate) return null;

    if (Number(maxAgeMs) > 0) {
      const entryTime = Date.parse(candidate.updated_at || '');
      if (Number.isFinite(entryTime)) {
        const age = Date.now() - entryTime;
        if (age > Number(maxAgeMs)) return null;
      }
    }

    return candidate.payload ?? null;
  }

  async clearCache() {
    await this.init();

    if (this.adapter === 'pglite') {
      await this.pglite.query('DELETE FROM local_cache');
      this._writeFallbackCacheObject({});
      return;
    }

    this._writeLocalObject('cache', {});
    this._writeFallbackCacheObject({});
  }

  async recordConvergenceMetric({
    eventId = null,
    mutationType = null,
    durationMs,
    details = null
  } = {}) {
    await this.init();
    const normalizedDuration = Number(durationMs);
    if (!Number.isFinite(normalizedDuration) || normalizedDuration < 0) return null;

    const metric = {
      id: generateId(),
      metric_type: 'time_to_convergence_ms',
      event_id: eventId || null,
      mutation_type: mutationType || null,
      duration_ms: normalizedDuration,
      details: details || null,
      created_at: nowIso()
    };

    if (this.adapter === 'pglite') {
      await this.pglite.query(
        `INSERT INTO sync_metrics(
          id, metric_type, event_id, mutation_type, duration_ms, details, created_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          metric.id,
          metric.metric_type,
          metric.event_id,
          metric.mutation_type,
          metric.duration_ms,
          metric.details ? JSON.stringify(metric.details) : null,
          metric.created_at
        ]
      );
      return metric;
    }

    const metrics = this._readLocalArray('metrics');
    metrics.push(metric);
    if (metrics.length > 1000) {
      metrics.splice(0, metrics.length - 1000);
    }
    this._writeLocalArray('metrics', metrics);
    return metric;
  }

  async listConvergenceMetrics({ limit = 100 } = {}) {
    await this.init();
    const normalizedLimit = Number(limit) > 0 ? Number(limit) : 100;

    if (this.adapter === 'pglite') {
      const result = await this.pglite.query(
        `SELECT *
         FROM sync_metrics
         WHERE metric_type = 'time_to_convergence_ms'
         ORDER BY created_at DESC
         LIMIT $1`,
        [normalizedLimit]
      );
      return (result?.rows || []).map((row) => ({
        ...row,
        details: parseJson(row.details, null)
      }));
    }

    const metrics = this._readLocalArray('metrics');
    return metrics
      .filter((item) => item.metric_type === 'time_to_convergence_ms')
      .slice()
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .slice(0, normalizedLimit);
  }

  async clearConvergenceMetrics() {
    await this.init();

    if (this.adapter === 'pglite') {
      await this.pglite.query(
        `DELETE FROM sync_metrics
         WHERE metric_type = 'time_to_convergence_ms'`
      );
      return;
    }

    const metrics = this._readLocalArray('metrics');
    const filtered = metrics.filter((item) => item.metric_type !== 'time_to_convergence_ms');
    this._writeLocalArray('metrics', filtered);
  }

  _buildConvergenceSummary(metrics = []) {
    const durations = (metrics || [])
      .map((item) => Number(item?.duration_ms))
      .filter((value) => Number.isFinite(value) && value >= 0)
      .sort((a, b) => a - b);

    if (durations.length === 0) {
      return {
        sampleSize: 0,
        lastMs: null,
        avgMs: null,
        p50Ms: null,
        p95Ms: null,
        maxMs: null
      };
    }

    const avgMs = durations.reduce((sum, value) => sum + value, 0) / durations.length;
    const latest = metrics?.[0];
    const lastMs = Number.isFinite(Number(latest?.duration_ms)) ? Number(latest.duration_ms) : null;

    return {
      sampleSize: durations.length,
      lastMs,
      avgMs,
      p50Ms: percentile(durations, 0.5),
      p95Ms: percentile(durations, 0.95),
      maxMs: durations[durations.length - 1] ?? null
    };
  }

  _buildOutboxRateSummary(events = [], { windowSize = 100, windowMinutes = 15 } = {}) {
    const terminal = Array.isArray(events) ? events : [];
    const considered = terminal.length;
    const acked = terminal.filter((item) => item?.status === 'acked').length;
    const rejected = terminal.filter((item) => item?.status === 'rejected').length;
    const ackRate = considered > 0 ? acked / considered : 0;
    const rejectRate = considered > 0 ? rejected / considered : 0;

    return {
      windowSize: Number(windowSize) > 0 ? Number(windowSize) : 100,
      windowMinutes: Number(windowMinutes) > 0 ? Number(windowMinutes) : 15,
      considered,
      acked,
      rejected,
      ackRate,
      rejectRate,
      ackRatePct: ackRate * 100,
      rejectRatePct: rejectRate * 100
    };
  }

  async deleteCacheByPrefix(prefix) {
    await this.init();
    const normalizedPrefix = String(prefix || '').trim();
    if (!normalizedPrefix) return 0;

    if (this.adapter === 'pglite') {
      const result = await this.pglite.query(
        'DELETE FROM local_cache WHERE cache_key LIKE $1 RETURNING cache_key',
        [`${normalizedPrefix}%`]
      );
      return Number(result?.rows?.length || 0);
    }

    const cache = this._readLocalObject('cache');
    const keys = Object.keys(cache || {});
    let deleted = 0;
    keys.forEach((key) => {
      if (String(key).startsWith(normalizedPrefix)) {
        delete cache[key];
        deleted += 1;
      }
    });
    this._writeLocalObject('cache', cache);
    return deleted;
  }

  async deleteCacheByPrefixes(prefixes = []) {
    await this.init();
    const uniquePrefixes = [...new Set((prefixes || []).map((p) => String(p || '').trim()).filter(Boolean))];
    let totalDeleted = 0;
    for (const prefix of uniquePrefixes) {
      totalDeleted += await this.deleteCacheByPrefix(prefix);
    }
    return totalDeleted;
  }

  async health() {
    await this.init();
    const pending = await this.listOutboxEvents({ status: 'pending', limit: 1000 });
    const rejected = await this.listOutboxEvents({ status: 'rejected', limit: 1000 });
    const rateWindowSizeRaw = Number(LOCAL_SYNC_CONFIG.outboxRateWindowSize || 100);
    const rateWindowMinutesRaw = Number(LOCAL_SYNC_CONFIG.outboxRateWindowMinutes || 15);
    const rateWindowSize = Number.isFinite(rateWindowSizeRaw) && rateWindowSizeRaw > 0 ? rateWindowSizeRaw : 100;
    const rateWindowMinutes = Number.isFinite(rateWindowMinutesRaw) && rateWindowMinutesRaw > 0
      ? rateWindowMinutesRaw
      : 15;
    const recentTerminal = await this.listTerminalOutboxEvents({ limit: rateWindowSize });
    const terminalCutoffMs = Date.now() - (rateWindowMinutes * 60 * 1000);
    const terminalInWindow = recentTerminal.filter((item) => {
      const updatedAtMs = Date.parse(item?.updated_at || item?.created_at || '');
      return Number.isFinite(updatedAtMs) && updatedAtMs >= terminalCutoffMs;
    });
    const convergenceMetrics = await this.listConvergenceMetrics({ limit: 200 });
    const cacheCount = this.adapter === 'pglite'
      ? Number((await this.pglite.query('SELECT COUNT(*)::int AS total FROM local_cache'))?.rows?.[0]?.total || 0)
      : Object.keys(this._readLocalObject('cache') || {}).length;
    const oldestPendingMs = pending
      .map((item) => Date.parse(item?.created_at || ''))
      .filter((value) => Number.isFinite(value))
      .sort((a, b) => a - b)[0] || null;

    return {
      initialized: this.initialized,
      adapter: this.adapter,
      pendingCount: pending.length,
      rejectedCount: rejected.length,
      cacheCount,
      outboxOldestPendingSeconds: oldestPendingMs ? Math.max(0, (Date.now() - oldestPendingMs) / 1000) : 0,
      outboxRates: this._buildOutboxRateSummary(terminalInWindow, {
        windowSize: rateWindowSize,
        windowMinutes: rateWindowMinutes
      }),
      convergence: this._buildConvergenceSummary(convergenceMetrics)
    };
  }
}

const localDbClient = new LocalDbClient();

export function getLocalDbClient() {
  return localDbClient;
}

export default localDbClient;
