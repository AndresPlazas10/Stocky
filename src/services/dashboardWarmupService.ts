import { logger } from '@/utils/logger';

const warmupStateByBusiness = new Map<string, WarmupStatus>();
const listenersByBusiness = new Map<string, Set<(state: WarmupStatus) => void>>();
const WARMUP_DISABLED_REASON = 'online_only_no_warmup';

export const DASHBOARD_WARMUP_PHASE = {
  IDLE: 'idle',
  RUNNING: 'running',
  READY: 'ready',
  ERROR: 'error'
} as const;

export type WarmupPhase = typeof DASHBOARD_WARMUP_PHASE[keyof typeof DASHBOARD_WARMUP_PHASE];

export interface WarmupStatus {
  businessId: string | null;
  phase: WarmupPhase;
  inProgress: boolean;
  finishedAt: number;
  updatedAt: number;
  ok: number;
  failed: number;
  total: number;
  reason: string;
  error: unknown;
}

export interface WarmupResult {
  warmed: boolean;
  reason: string;
  status: WarmupStatus;
}

type WarmupListener = (state: WarmupStatus) => void;

function getDefaultWarmupState(businessId: string | null): WarmupStatus {
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

function notifyWarmupStatus(businessId: string): void {
  const listeners = listenersByBusiness.get(businessId);
  if (!listeners || listeners.size === 0) return;

  const state = getWarmupStatus(businessId);
  listeners.forEach((listener) => {
    try {
      listener(state);
    } catch (err) {
      logger.warn('services:dashboard_warmup:listener_failed', err);
    }
  });
}

function setWarmupStatus(businessId: string, patch: Partial<WarmupStatus> = {}): WarmupStatus {
  const prev = warmupStateByBusiness.get(businessId) || getDefaultWarmupState(businessId);
  const next: WarmupStatus = {
    ...prev,
    ...patch,
    businessId,
    updatedAt: Date.now()
  };
  warmupStateByBusiness.set(businessId, next);
  notifyWarmupStatus(businessId);
  return next;
}

export function getWarmupStatus(businessId: string | null): WarmupStatus {
  if (!businessId) return getDefaultWarmupState(null);
  return warmupStateByBusiness.get(businessId) || getDefaultWarmupState(businessId);
}

export function subscribeWarmupStatus(businessId: string | null, listener: WarmupListener): () => void {
  if (!businessId || typeof listener !== 'function') return () => {};

  if (!listenersByBusiness.has(businessId)) {
    listenersByBusiness.set(businessId, new Set());
  }

  const listeners = listenersByBusiness.get(businessId)!;
  listeners.add(listener);
  listener(getWarmupStatus(businessId));

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      listenersByBusiness.delete(businessId);
    }
  };
}

export async function warmupDashboardData(businessId: string | null): Promise<WarmupResult> {
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
