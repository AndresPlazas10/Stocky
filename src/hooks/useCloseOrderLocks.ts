import { useCallback, useEffect, useRef } from 'react';
import { logger } from '@/utils/logger';
import {
  DEFAULT_CLOSE_ORDER_LOCK_TTL_MS,
  isCloseOrderLockActive,
  sanitizeCloseOrderLocksRecord,
  removeCloseOrderLockFromRecord,
  upsertCloseOrderLockInRecord,
} from '../utils/closeOrderLocks.js';

const CLOSE_ORDER_LOCK_TTL_MS = DEFAULT_CLOSE_ORDER_LOCK_TTL_MS;
const CLOSE_ORDER_LOCKS_STORAGE_KEY = 'stocky.orders.close.locks.v1';

export function useCloseOrderLocks() {
  const closeOrderInFlightRef = useRef(new Map());

  const readPersistedCloseOrderLocks = useCallback(() => {
    if (typeof window === 'undefined' || !window.localStorage) return {};
    try {
      const raw = window.localStorage.getItem(CLOSE_ORDER_LOCKS_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }, []);

  const writePersistedCloseOrderLocks = useCallback((next) => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      window.localStorage.setItem(CLOSE_ORDER_LOCKS_STORAGE_KEY, JSON.stringify(next && typeof next === 'object' ? next : {}));
    } catch (err) {
      logger.warn('hooks:closeOrderLocks:write failed', err);
    }
  }, []);

  const acquireCloseOrderLock = useCallback((lockKey) => {
    const key = String(lockKey || '').trim();
    if (!key) return false;

    const now = Date.now();
    const current = closeOrderInFlightRef.current.get(key);

    if (isCloseOrderLockActive(current?.ts, { now, ttlMs: CLOSE_ORDER_LOCK_TTL_MS })) {
      return false;
    }

    const persisted = readPersistedCloseOrderLocks();
    const persistedTs = Number(persisted?.[key] || 0);
    const persistedIsActive = isCloseOrderLockActive(persistedTs, { now, ttlMs: CLOSE_ORDER_LOCK_TTL_MS });
    if (persistedIsActive) {
      closeOrderInFlightRef.current.set(key, { ts: persistedTs });
      return false;
    }

    if (persisted?.[key]) {
      writePersistedCloseOrderLocks(removeCloseOrderLockFromRecord(persisted, key));
    }

    closeOrderInFlightRef.current.set(key, { ts: now });
    writePersistedCloseOrderLocks(upsertCloseOrderLockInRecord(persisted, key, now));
    return true;
  }, [readPersistedCloseOrderLocks, writePersistedCloseOrderLocks]);

  const releaseCloseOrderLock = useCallback((lockKey) => {
    const key = String(lockKey || '').trim();
    if (!key) return;
    closeOrderInFlightRef.current.delete(key);
    const persisted = readPersistedCloseOrderLocks();
    if (!persisted?.[key]) return;
    writePersistedCloseOrderLocks(removeCloseOrderLockFromRecord(persisted, key));
  }, [readPersistedCloseOrderLocks, writePersistedCloseOrderLocks]);

  const purgeExpiredCloseOrderLocks = useCallback(() => {
    const now = Date.now();

    closeOrderInFlightRef.current.forEach((value, key) => {
      if (!isCloseOrderLockActive(value?.ts, { now, ttlMs: CLOSE_ORDER_LOCK_TTL_MS })) {
        closeOrderInFlightRef.current.delete(key);
      }
    });

    const persisted = readPersistedCloseOrderLocks();
    const nextPersisted = sanitizeCloseOrderLocksRecord(persisted, {
      now,
      ttlMs: CLOSE_ORDER_LOCK_TTL_MS
    });

    if (Object.keys(nextPersisted).length !== Object.keys(persisted).length) {
      writePersistedCloseOrderLocks(nextPersisted);
    }
  }, [readPersistedCloseOrderLocks, writePersistedCloseOrderLocks]);

  useEffect(() => {
    purgeExpiredCloseOrderLocks();
  }, [purgeExpiredCloseOrderLocks]);

  return {
    closeOrderInFlightRef,
    acquireCloseOrderLock,
    releaseCloseOrderLock,
  };
}
