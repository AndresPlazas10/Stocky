const warmupStateByBusiness = new Map();
const listenersByBusiness = new Map();
const WARMUP_DISABLED_REASON = 'online_only_no_warmup';

export const DASHBOARD_WARMUP_PHASE = {
  IDLE: 'idle',
  RUNNING: 'running',
  READY: 'ready',
  ERROR: 'error'
};

function getDefaultWarmupState(businessId) {
  return {
    businessId,
    phase: DASHBOARD_WARMUP_PHASE.READY,
    inProgress: false,
    finishedAt: Date.now(),
    updatedAt: Date.now(),
    ok: 0,
    failed: 0,
    total: 0,
    reason: WARMUP_DISABLED_REASON,
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

export async function warmupDashboardData(businessId) {
  if (!businessId) {
    return { warmed: false, reason: 'missing_business_id', status: getDefaultWarmupState(null) };
  }
  const status = setWarmupStatus(businessId, {
    phase: DASHBOARD_WARMUP_PHASE.READY,
    inProgress: false,
    finishedAt: Date.now(),
    ok: 0,
    failed: 0,
    total: 0,
    reason: WARMUP_DISABLED_REASON,
    error: null
  });
  return { warmed: false, reason: WARMUP_DISABLED_REASON, status };
}

export default warmupDashboardData;
