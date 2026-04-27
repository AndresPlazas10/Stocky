import { supabaseAdapter } from '../adapters/supabaseAdapter.js';
import { createSaleOptimized } from '../../services/salesServiceOptimized.js';
import { findReusableSaleCreateOutboxEvent } from './salesOutboxIdempotency.js';
import { applySaleSyncToSnapshot } from './salesSnapshotSync.js';
import { selectSalesOutboxCandidates } from './salesOutboxCandidates.js';
import {
  isConnectivityError
} from './salesOutboxRetryPolicy.js';
import {
  buildProcessingOutboxEventPatch,
  resolveFailedOutboxSyncTransition
} from './salesOutboxTransitions.js';

const SALES_OUTBOX_KEY = 'stocky.sales.outbox.v1';
const SALES_OUTBOX_EVENT = 'stocky:sales-outbox-updated';
const SALES_SYNC_EVENT = 'stocky:sale-synced';
const SALES_LAST_SUCCESS_SYNC_AT_KEY = 'stocky.sales.outbox.last_success_sync_at';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function canUseLocalStorage() {
  return typeof window !== 'undefined' && !!window.localStorage;
}

function readSalesOutbox() {
  if (!canUseLocalStorage()) return [];
  try {
    const raw = window.localStorage.getItem(SALES_OUTBOX_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSalesOutbox(next) {
  if (!canUseLocalStorage()) return;
  try {
    window.localStorage.setItem(SALES_OUTBOX_KEY, JSON.stringify(Array.isArray(next) ? next : []));
    window.dispatchEvent(new CustomEvent(SALES_OUTBOX_EVENT));
  } catch {
    // no-op
  }
}

function readLastSuccessfulSyncAt() {
  if (!canUseLocalStorage()) return null;
  try {
    const value = String(window.localStorage.getItem(SALES_LAST_SUCCESS_SYNC_AT_KEY) || '').trim();
    return value || null;
  } catch {
    return null;
  }
}

function writeLastSuccessfulSyncAt(value) {
  if (!canUseLocalStorage()) return;
  try {
    const normalized = String(value || '').trim();
    if (!normalized) return;
    window.localStorage.setItem(SALES_LAST_SUCCESS_SYNC_AT_KEY, normalized);
  } catch {
    // no-op
  }
}

function emitSaleSynced({ businessId, tempSaleId, remoteSaleId, syncedAt }) {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(SALES_SYNC_EVENT, {
      detail: {
        businessId,
        tempSaleId,
        remoteSaleId,
        syncedAt: syncedAt || new Date().toISOString()
      }
    }));
  } catch {
    // no-op
  }
}

function makeOfflineSaleId() {
  return `offline-sale-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildOutboxEvent({ businessId, cart, paymentMethod, total, idempotencyKey }) {
  const createdAt = new Date().toISOString();
  return {
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: 'sale.create',
    status: 'pending',
    attempts: 0,
    created_at: createdAt,
    updated_at: createdAt,
    next_retry_at: null,
    last_error: null,
    payload: {
      businessId,
      cart,
      paymentMethod,
      total,
      idempotencyKey,
      tempSaleId: makeOfflineSaleId(),
      queuedAt: createdAt,
    }
  };
}

function enqueueSaleCreateEvent(params) {
  const queue = readSalesOutbox();
  const existing = findReusableSaleCreateOutboxEvent(queue, params?.idempotencyKey);
  if (existing) return existing;

  const event = buildOutboxEvent(params);
  queue.push(event);
  writeSalesOutbox(queue);
  return event;
}

function replaceSalesOutboxEvent(eventId, updater) {
  const queue = readSalesOutbox();
  const next = queue.map((item) => {
    if (item?.id !== eventId) return item;
    return typeof updater === 'function' ? updater(item) : item;
  });
  writeSalesOutbox(next);
}

function removeSalesOutboxEvent(eventId) {
  const queue = readSalesOutbox();
  writeSalesOutbox(queue.filter((item) => item?.id !== eventId));
}

function updateOfflineSalesSnapshotOnSync({ businessId, tempSaleId, remoteSaleId }) {
  if (!canUseLocalStorage()) return;
  try {
    const key = `stocky.offline_snapshot.ventas.list:${businessId}`;
    const raw = window.localStorage.getItem(key);
    const snapshot = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(snapshot)) return;

    const nowIso = new Date().toISOString();
    const { nextSnapshot, updated } = applySaleSyncToSnapshot(snapshot, {
      tempSaleId,
      remoteSaleId,
      syncedAt: nowIso
    });

    if (!updated) return;

    window.localStorage.setItem(key, JSON.stringify(nextSnapshot));
    writeLastSuccessfulSyncAt(nowIso);
    emitSaleSynced({
      businessId,
      tempSaleId,
      remoteSaleId,
      syncedAt: nowIso
    });
  } catch {
    // no-op
  }
}

function buildQueuedSaleResponse(event) {
  const payload = event?.payload || {};
  return {
    success: true,
    data: {
      id: payload.tempSaleId,
      total: Number(payload.total || 0),
      items_count: Array.isArray(payload.cart) ? payload.cart.length : 0,
      created_at: payload.queuedAt || new Date().toISOString(),
      pending_sync: true,
      offline: true,
    }
  };
}

let flushInFlightPromise = null;

export async function flushSalesOutbox({ maxEvents = 20 } = {}) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { synced: 0, pending: readSalesOutbox().length };
  if (flushInFlightPromise) return flushInFlightPromise;

  flushInFlightPromise = (async () => {
    const nowMs = Date.now();
    const queue = readSalesOutbox();
    const candidates = selectSalesOutboxCandidates(queue, {
      nowMs,
      maxEvents
    });

    let synced = 0;

    for (const event of candidates) {
      const payload = event?.payload || {};
      const nowIso = new Date().toISOString();
      const nowMs = Date.parse(nowIso) || Date.now();

      replaceSalesOutboxEvent(event.id, (current) => buildProcessingOutboxEventPatch(current, { nowIso }));

      const result = await createSaleOptimized({
        businessId: payload.businessId,
        cart: payload.cart,
        paymentMethod: payload.paymentMethod,
        total: payload.total,
        idempotencyKey: payload.idempotencyKey,
      });

      if (result?.success) {
        removeSalesOutboxEvent(event.id);
        updateOfflineSalesSnapshotOnSync({
          businessId: payload.businessId,
          tempSaleId: payload.tempSaleId,
          remoteSaleId: result?.data?.id || payload.tempSaleId,
        });
        synced += 1;
        continue;
      }

      const message = String(result?.error || 'Error al sincronizar venta pendiente');
      const failureTransition = resolveFailedOutboxSyncTransition({
        event,
        errorMessage: message,
        nowMs,
        nowIso
      });

      replaceSalesOutboxEvent(event.id, (current) => ({
        ...current,
        ...failureTransition.patch,
      }));

      if (failureTransition.shouldBreak) {
        break;
      }
    }

    return {
      synced,
      pending: readSalesOutbox().length,
    };
  })();

  try {
    return await flushInFlightPromise;
  } finally {
    flushInFlightPromise = null;
  }
}

export function startSalesOutboxAutoSync() {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const onOnline = () => {
    void flushSalesOutbox();
  };

  window.addEventListener('online', onOnline);
  const timer = window.setInterval(() => {
    if (navigator.onLine) {
      void flushSalesOutbox();
    }
  }, 8000);

  void flushSalesOutbox();

  return () => {
    window.removeEventListener('online', onOnline);
    window.clearInterval(timer);
  };
}

async function verifyRemoteSalePersistence({
  saleId,
  businessId,
  retries = 3,
  waitMs = 250
}) {
  if (!saleId || !businessId) {
    return { confirmed: false, indeterminate: true };
  }

  let sawReadError = false;

  for (let attempt = 0; attempt < retries; attempt += 1) {
    const { data, error } = await supabaseAdapter.getSaleSyncStateById({ saleId, businessId });
    if (!error && data?.id) {
      return { confirmed: true, indeterminate: false };
    }
    if (error) {
      sawReadError = true;
    }
    if (attempt < retries - 1) {
      await sleep(waitMs);
    }
  }

  return {
    confirmed: false,
    indeterminate: sawReadError
  };
}

export async function createSaleWithOutbox({
  businessId,
  cart,
  paymentMethod = 'cash',
  total = 0,
  idempotencyKey = null
}) {
  const offlineMode = typeof navigator !== 'undefined' && navigator.onLine === false;

  const resolvedKey = idempotencyKey || (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`);

  if (offlineMode) {
    const event = enqueueSaleCreateEvent({
      businessId,
      cart,
      paymentMethod,
      total,
      idempotencyKey: resolvedKey,
    });
    return buildQueuedSaleResponse(event);
  }

  await flushSalesOutbox();

  const result = await createSaleOptimized({
    businessId,
    cart,
    paymentMethod,
    total,
    idempotencyKey: resolvedKey
  });

  if (!result?.success) {
    if (isConnectivityError(result?.error)) {
      const event = enqueueSaleCreateEvent({
        businessId,
        cart,
        paymentMethod,
        total,
        idempotencyKey: resolvedKey,
      });
      return buildQueuedSaleResponse(event);
    }
    return result;
  }

  const saleId = result?.data?.id || null;
  const persistenceCheck = await verifyRemoteSalePersistence({
    saleId,
    businessId
  });
  if (!persistenceCheck.confirmed && !persistenceCheck.indeterminate) {
    return {
      success: false,
      error: 'La venta no se confirmó en Supabase. Verifica conexión y vuelve a intentar.'
    };
  }

  return result;
}

export function getPendingSalesOutboxCount() {
  return readSalesOutbox().length;
}

export function getSalesOutboxSnapshot() {
  const queue = readSalesOutbox();
  const summary = {
    total: queue.length,
    pending: 0,
    processing: 0,
    error: 0,
    lastSuccessfulSyncAt: readLastSuccessfulSyncAt(),
    byTempSaleId: {}
  };

  queue.forEach((item) => {
    const status = String(item?.status || 'pending').toLowerCase();
    if (status === 'processing') summary.processing += 1;
    else if (status === 'error') summary.error += 1;
    else summary.pending += 1;

    const tempSaleId = String(item?.payload?.tempSaleId || '').trim();
    if (!tempSaleId) return;
    summary.byTempSaleId[tempSaleId] = {
      status,
      last_error: item?.last_error || null,
      attempts: Number(item?.attempts || 0),
      next_retry_at: item?.next_retry_at || null,
      updated_at: item?.updated_at || null,
    };
  });

  return summary;
}

export function subscribeSalesOutboxUpdates(callback) {
  if (typeof window === 'undefined' || typeof callback !== 'function') {
    return () => {};
  }

  const handler = () => {
    callback(getSalesOutboxSnapshot());
  };

  window.addEventListener(SALES_OUTBOX_EVENT, handler);
  return () => {
    window.removeEventListener(SALES_OUTBOX_EVENT, handler);
  };
}

export function subscribeSalesSyncUpdates(callback) {
  if (typeof window === 'undefined' || typeof callback !== 'function') {
    return () => {};
  }

  const handler = (event) => {
    callback(event?.detail || null);
  };

  window.addEventListener(SALES_SYNC_EVENT, handler);
  return () => {
    window.removeEventListener(SALES_SYNC_EVENT, handler);
  };
}

export function retrySalesOutboxEventByTempSaleId(tempSaleId) {
  const targetId = String(tempSaleId || '').trim();
  if (!targetId) return false;

  let updated = false;
  const queue = readSalesOutbox();
  const next = queue.map((item) => {
    if (String(item?.payload?.tempSaleId || '').trim() !== targetId) return item;
    updated = true;
    return {
      ...item,
      status: 'pending',
      last_error: null,
      next_retry_at: null,
      updated_at: new Date().toISOString()
    };
  });

  if (!updated) return false;
  writeSalesOutbox(next);
  void flushSalesOutbox();
  return true;
}

export function retryAllSalesOutboxErrorEvents() {
  const queue = readSalesOutbox();
  let retried = 0;

  const next = queue.map((item) => {
    const status = String(item?.status || 'pending').toLowerCase();
    if (item?.type !== 'sale.create' || status !== 'error') return item;
    retried += 1;
    return {
      ...item,
      status: 'pending',
      last_error: null,
      next_retry_at: null,
      updated_at: new Date().toISOString()
    };
  });

  if (retried === 0) return 0;

  writeSalesOutbox(next);
  void flushSalesOutbox();
  return retried;
}

export async function deleteSaleWithDetails(saleId, businessId = null) {
  const { error: detailsError } = await supabaseAdapter.deleteSaleDetails(saleId);
  if (detailsError) {
    throw new Error(`Error al eliminar detalles: ${detailsError.message}`);
  }

  const { error: saleError } = await supabaseAdapter.deleteSaleById(saleId);
  if (saleError) {
    throw new Error(`Error al eliminar venta: ${saleError.message}`);
  }
  void businessId;
}
