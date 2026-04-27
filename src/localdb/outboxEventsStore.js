import {
  isLocalDbTableStoreActive,
  readLocalDbTableRows,
  runLocalDbTableTransaction,
  writeLocalDbTableRows
} from './client.js';

const OUTBOX_EVENTS_STORAGE_KEY = 'stocky.localdb.outbox_events.v1';

let inMemoryOutboxEvents = [];

function nowIso() {
  return new Date().toISOString();
}

function canUseLocalStorage() {
  return typeof window !== 'undefined' && !!window.localStorage;
}

function readFromLocalStorage() {
  try {
    const raw = window.localStorage.getItem(OUTBOX_EVENTS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeToLocalStorage(events = []) {
  try {
    window.localStorage.setItem(OUTBOX_EVENTS_STORAGE_KEY, JSON.stringify(Array.isArray(events) ? events : []));
  } catch {
    // no-op
  }
}

function readOutboxEventsStorage() {
  const tableRows = readLocalDbTableRows('outbox_events');
  if (Array.isArray(tableRows)) {
    if (tableRows.length > 0) return tableRows;

    // Migración suave: si la tabla local está vacía, hidratar desde storage legacy.
    const legacyRows = canUseLocalStorage()
      ? readFromLocalStorage()
      : (Array.isArray(inMemoryOutboxEvents) ? [...inMemoryOutboxEvents] : []);

    if (legacyRows.length > 0) {
      writeLocalDbTableRows('outbox_events', legacyRows);
      return legacyRows;
    }

    return tableRows;
  }

  if (canUseLocalStorage()) return readFromLocalStorage();
  return Array.isArray(inMemoryOutboxEvents) ? [...inMemoryOutboxEvents] : [];
}

function writeOutboxEventsStorage(events = []) {
  const normalized = Array.isArray(events) ? events : [];
  if (writeLocalDbTableRows('outbox_events', normalized)) {
    return;
  }

  if (canUseLocalStorage()) {
    writeToLocalStorage(normalized);
    return;
  }
  inMemoryOutboxEvents = [...normalized];
}

function makeOutboxEventId() {
  return `outbox-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeOutboxEventRecord(input = {}) {
  const createdAt = String(input.created_at || input.createdAt || nowIso()).trim() || nowIso();
  const updatedAt = String(input.updated_at || input.updatedAt || createdAt).trim() || createdAt;

  return {
    id: String(input.id || makeOutboxEventId()).trim(),
    business_id: String(input.business_id || input.businessId || '').trim(),
    mutation_type: String(input.mutation_type || input.mutationType || '').trim(),
    payload: input.payload ?? {},
    mutation_id: String(input.mutation_id || input.mutationId || '').trim(),
    base_versions: input.base_versions ?? input.baseVersions ?? null,
    status: String(input.status || 'pending').trim() || 'pending',
    retry_count: Number.isFinite(Number(input.retry_count)) ? Number(input.retry_count) : 0,
    last_error: input.last_error ? String(input.last_error) : null,
    created_at: createdAt,
    updated_at: updatedAt
  };
}

export async function enqueueLocalOutboxEvent({
  businessId,
  mutationType,
  payload,
  mutationId,
  baseVersions = null
}) {
  const business_id = String(businessId || '').trim();
  const mutation_type = String(mutationType || '').trim();
  const mutation_id = String(mutationId || '').trim();

  if (!business_id || !mutation_type || !mutation_id) {
    return null;
  }

  if (isLocalDbTableStoreActive()) {
    const txResult = await runLocalDbTableTransaction('outbox_events', (rows) => {
      const existing = rows.find((event) => String(event?.mutation_id || '').trim() === mutation_id) || null;
      if (existing) {
        return {
          rows,
          result: existing
        };
      }

      const nextRecord = normalizeOutboxEventRecord({
        business_id,
        mutation_type,
        payload: payload ?? {},
        mutation_id,
        base_versions: baseVersions,
        status: 'pending'
      });

      rows.push(nextRecord);
      return {
        rows,
        result: nextRecord
      };
    });

    return txResult || null;
  }

  const events = readOutboxEventsStorage();
  const existing = events.find((event) => String(event?.mutation_id || '').trim() === mutation_id) || null;
  if (existing) return existing;

  const nextRecord = normalizeOutboxEventRecord({
    business_id,
    mutation_type,
    payload: payload ?? {},
    mutation_id,
    base_versions: baseVersions,
    status: 'pending'
  });

  events.push(nextRecord);
  writeOutboxEventsStorage(events);

  return nextRecord;
}

export async function listLocalOutboxEvents({
  businessId = null,
  statuses = null,
  limit = 200
} = {}) {
  const normalizedBusinessId = String(businessId || '').trim() || null;
  const allowedStatuses = Array.isArray(statuses)
    ? new Set(statuses.map((value) => String(value || '').trim().toLowerCase()).filter(Boolean))
    : null;

  return readOutboxEventsStorage()
    .filter((event) => {
      if (normalizedBusinessId && String(event?.business_id || '').trim() !== normalizedBusinessId) return false;
      if (allowedStatuses && !allowedStatuses.has(String(event?.status || '').trim().toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => Date.parse(String(a?.created_at || '')) - Date.parse(String(b?.created_at || '')))
    .slice(0, Math.max(1, Number(limit || 200)));
}

export async function clearLocalOutboxEvents({ businessId = null } = {}) {
  const normalizedBusinessId = String(businessId || '').trim() || null;

  if (isLocalDbTableStoreActive()) {
    await runLocalDbTableTransaction('outbox_events', (rows) => {
      if (!normalizedBusinessId) {
        return {
          rows: [],
          result: true
        };
      }

      const next = rows.filter((event) => String(event?.business_id || '').trim() !== normalizedBusinessId);
      return {
        rows: next,
        result: true
      };
    });
    return true;
  }

  const events = readOutboxEventsStorage();

  if (!normalizedBusinessId) {
    writeOutboxEventsStorage([]);
    return true;
  }

  const next = events.filter((event) => String(event?.business_id || '').trim() !== normalizedBusinessId);
  writeOutboxEventsStorage(next);
  return true;
}

export async function updateLocalOutboxEventStatus({
  eventId,
  status,
  lastError = null,
  retryCount = null
}) {
  const targetId = String(eventId || '').trim();
  const nextStatus = String(status || '').trim();
  if (!targetId || !nextStatus) return null;

  if (isLocalDbTableStoreActive()) {
    const txResult = await runLocalDbTableTransaction('outbox_events', (rows) => {
      let updatedRecord = null;

      const next = rows.map((event) => {
        if (String(event?.id || '').trim() !== targetId) return event;

        updatedRecord = {
          ...event,
          status: nextStatus,
          last_error: lastError ? String(lastError) : null,
          retry_count: Number.isFinite(Number(retryCount)) ? Number(retryCount) : Number(event?.retry_count || 0),
          updated_at: nowIso()
        };
        return updatedRecord;
      });

      return {
        rows: next,
        result: updatedRecord
      };
    });

    return txResult || null;
  }

  const events = readOutboxEventsStorage();
  let updatedRecord = null;

  const next = events.map((event) => {
    if (String(event?.id || '').trim() !== targetId) return event;

    updatedRecord = {
      ...event,
      status: nextStatus,
      last_error: lastError ? String(lastError) : null,
      retry_count: Number.isFinite(Number(retryCount)) ? Number(retryCount) : Number(event?.retry_count || 0),
      updated_at: nowIso()
    };
    return updatedRecord;
  });

  writeOutboxEventsStorage(next);
  return updatedRecord;
}

export function __unsafeResetLocalOutboxStoreForTests() {
  inMemoryOutboxEvents = [];
  writeLocalDbTableRows('outbox_events', []);
}

export default {
  enqueueLocalOutboxEvent,
  listLocalOutboxEvents,
  clearLocalOutboxEvents,
  updateLocalOutboxEventStatus
};
