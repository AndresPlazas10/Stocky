import LOCAL_SYNC_CONFIG from '../config/localSync.js';
import { logger } from '../utils/logger.js';
import { getProductsForSale } from '../data/queries/salesQueries.js';
import { getFilteredSales } from './salesService.js';
import { getProductsForPurchase, getSuppliersForBusiness } from '../data/queries/purchasesQueries.js';
import { getFilteredPurchases } from './purchasesService.js';
import { getInventoryProductsByBusiness, getSuppliersByBusiness } from '../data/queries/inventoryQueries.js';
import { fetchComboCatalog, fetchCombos } from './combosService.js';
import { getProductsForOrdersByBusiness, getTablesWithCurrentOrderByBusiness } from '../data/queries/ordersQueries.js';
import { getInvoicesWithItemsByBusiness, getProductsForInvoicesByBusiness } from '../data/queries/invoicesQueries.js';
import { getReportsSnapshot } from '../data/queries/reportsQueries.js';

const DEFAULT_PAGE_SIZE = 50;
const WARMUP_COOLDOWN_MS = 60_000;
const warmupStateByBusiness = new Map();
const listenersByBusiness = new Map();

export const DASHBOARD_WARMUP_PHASE = {
  IDLE: 'idle',
  RUNNING: 'running',
  READY: 'ready',
  ERROR: 'error'
};

const INVOICE_LIST_COLUMNS = `
  id,
  business_id,
  employee_id,
  invoice_number,
  customer_name,
  customer_email,
  customer_id_number,
  payment_method,
  subtotal,
  tax,
  total,
  notes,
  status,
  issued_at,
  created_at,
  sent_at,
  cancelled_at
`;

const INVOICE_ITEM_LIST_COLUMNS = `
  id,
  product_name,
  quantity,
  unit_price,
  total
`;

const PRODUCT_INVOICE_COLUMNS = 'id, code, name, sale_price, stock, business_id, is_active';

function getMonthRange() {
  const end = new Date();
  const start = new Date(end);
  start.setMonth(start.getMonth() - 1);
  return {
    start: start.toISOString(),
    end: end.toISOString()
  };
}

function shouldSkipWarmup(businessId) {
  const state = warmupStateByBusiness.get(businessId);
  if (!state) return false;

  if (state.phase === DASHBOARD_WARMUP_PHASE.RUNNING) return true;
  if (!state.finishedAt) return false;
  return (Date.now() - state.finishedAt) < WARMUP_COOLDOWN_MS;
}

function getDefaultWarmupState(businessId) {
  return {
    businessId,
    phase: DASHBOARD_WARMUP_PHASE.IDLE,
    inProgress: false,
    finishedAt: null,
    updatedAt: Date.now(),
    ok: 0,
    failed: 0,
    total: 0,
    reason: null,
    error: null
  };
}

function notifyWarmupStatus(businessId) {
  const listeners = listenersByBusiness.get(businessId);
  if (!listeners || listeners.size === 0) return;

  const state = getWarmupStatus(businessId);
  listeners.forEach((listener) => {
    try {
      listener(state);
    } catch {
      // no-op
    }
  });
}

function setWarmupStatus(businessId, patch = {}) {
  const prev = warmupStateByBusiness.get(businessId) || getDefaultWarmupState(businessId);
  const next = {
    ...prev,
    ...patch,
    businessId,
    updatedAt: Date.now()
  };
  warmupStateByBusiness.set(businessId, next);
  notifyWarmupStatus(businessId);
  return next;
}

function markWarmupStarted(businessId) {
  return setWarmupStatus(businessId, {
    phase: DASHBOARD_WARMUP_PHASE.RUNNING,
    inProgress: true,
    reason: null,
    error: null
  });
}

function markWarmupFinished(businessId, {
  phase = DASHBOARD_WARMUP_PHASE.READY,
  ok = 0,
  failed = 0,
  total = 0,
  reason = null,
  error = null
} = {}) {
  return setWarmupStatus(businessId, {
    phase,
    inProgress: false,
    finishedAt: Date.now(),
    ok,
    failed,
    total,
    reason,
    error
  });
}

export function getWarmupStatus(businessId) {
  if (!businessId) return getDefaultWarmupState(null);
  return warmupStateByBusiness.get(businessId) || getDefaultWarmupState(businessId);
}

export function subscribeWarmupStatus(businessId, listener) {
  if (!businessId || typeof listener !== 'function') return () => {};

  if (!listenersByBusiness.has(businessId)) {
    listenersByBusiness.set(businessId, new Set());
  }

  const listeners = listenersByBusiness.get(businessId);
  listeners.add(listener);
  listener(getWarmupStatus(businessId));

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      listenersByBusiness.delete(businessId);
    }
  };
}

export async function warmupDashboardData(businessId, { force = false } = {}) {
  if (!businessId) {
    return { warmed: false, reason: 'missing_business_id', status: getDefaultWarmupState(null) };
  }
  if (!LOCAL_SYNC_CONFIG.enabled) {
    const status = setWarmupStatus(businessId, {
      phase: DASHBOARD_WARMUP_PHASE.IDLE,
      inProgress: false,
      reason: 'local_sync_disabled'
    });
    return { warmed: false, reason: 'local_sync_disabled', status };
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    const status = setWarmupStatus(businessId, {
      phase: DASHBOARD_WARMUP_PHASE.IDLE,
      inProgress: false,
      reason: 'offline'
    });
    return { warmed: false, reason: 'offline', status };
  }
  if (!force && shouldSkipWarmup(businessId)) {
    const status = getWarmupStatus(businessId);
    return { warmed: false, reason: 'cooldown_or_in_progress', status };
  }

  markWarmupStarted(businessId);
  const { start, end } = getMonthRange();

  const tasks = [
    () => getProductsForSale(businessId),
    () => fetchComboCatalog(businessId),
    () => getFilteredSales(businessId, {}, {
      limit: DEFAULT_PAGE_SIZE,
      offset: 0,
      includeCount: true,
      countMode: 'planned'
    }),
    () => getProductsForPurchase(businessId),
    () => getSuppliersForBusiness(businessId),
    () => getFilteredPurchases(businessId, {}, {
      limit: DEFAULT_PAGE_SIZE,
      offset: 0,
      includeCount: true,
      countMode: 'planned'
    }),
    () => getInventoryProductsByBusiness(businessId),
    () => getSuppliersByBusiness(businessId),
    () => fetchCombos(businessId),
    () => getProductsForOrdersByBusiness(businessId),
    () => getTablesWithCurrentOrderByBusiness(businessId),
    () => getInvoicesWithItemsByBusiness({
      businessId,
      invoiceColumns: INVOICE_LIST_COLUMNS,
      invoiceItemsColumns: INVOICE_ITEM_LIST_COLUMNS
    }),
    () => getProductsForInvoicesByBusiness(businessId, PRODUCT_INVOICE_COLUMNS),
    () => getReportsSnapshot({ businessId, start, end })
  ];

  try {
    const results = await Promise.allSettled(tasks.map((task) => task()));
    const failed = results.filter((result) => result.status === 'rejected').length;
    const ok = results.length - failed;
    const phase = failed > 0 ? DASHBOARD_WARMUP_PHASE.ERROR : DASHBOARD_WARMUP_PHASE.READY;

    logger.info('[warmup] dashboard cache', {
      businessId,
      ok,
      failed,
      total: results.length
    });

    const status = markWarmupFinished(businessId, {
      phase,
      ok,
      failed,
      total: results.length,
      reason: failed > 0 ? 'partial_or_failed' : null
    });

    return {
      warmed: true,
      ok,
      failed,
      total: results.length,
      status
    };
  } catch (error) {
    const status = markWarmupFinished(businessId, {
      phase: DASHBOARD_WARMUP_PHASE.ERROR,
      reason: 'warmup_exception',
      error: error?.message || String(error)
    });
    return {
      warmed: false,
      reason: 'warmup_exception',
      status
    };
  }
}

export default warmupDashboardData;
