import { useCallback, useRef } from 'react';
import { logger } from '../../../utils/logger.ts';
import { normalizeEntityId } from './mesaHelpers.js';
import { isOfflineMode, isOfflinePersistenceEnabled } from '../../../utils/offlineSnapshot.js';

export function useMesasRefs({
  businessId,
  currentUser,
  setPendingQuantityUpdates,
  setPendingOrderItemOps,
}) {
  const mesasLengthRef = useRef(0);
  const hasLoadedOnceRef = useRef(false);
  const pendingQuantityUpdatesRef = useRef({});
  const orderItemsDirtyRef = useRef(false);
  const orderItemsRef = useRef([]);
  const selectedMesaRef = useRef(null);
  const productCatalogByIdRef = useRef(new Map());
  const comboCatalogByIdRef = useRef(new Map());
  const orderDetailsRequestRef = useRef(0);
  const lastSyncedOrderTotalsRef = useRef({});
  const pendingRemoteOrderTotalsRef = useRef({});
  const orderTotalSyncQueueRef = useRef({});
  const optimisticTempItemQuantitiesRef = useRef({});
  const pendingOrderItemOpsRef = useRef(0);
  const orderItemWriteQueueRef = useRef({});
  const mesasSnapshotTimerRef = useRef(null);
  const mesaOpenDebugRef = useRef({ stage: 'idle', ts: null });

  const mesaSyncBroadcastChannelRef = useRef(null);
  const mesaSyncBroadcastReadyRef = useRef(false);
  const mesaSyncClientIdRef = useRef(
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : 'cl-' + Date.now().toString(36),
  );
  const activeMesaBroadcastRef = useRef(null);
  const heldMesaLockRef = useRef(null);
  const mesaLockHeartbeatTimerRef = useRef(null);
  const justCompletedSaleRef = useRef(false);

  const isOfflineFirstRuntime = isOfflineMode() && isOfflinePersistenceEnabled();

  const setPendingQuantityUpdatesSafe = useCallback((updater) => {
    const prev = pendingQuantityUpdatesRef.current || {};
    const next = typeof updater === 'function' ? updater(prev) : updater;
    const normalizedNext = next && typeof next === 'object' ? next : {};
    pendingQuantityUpdatesRef.current = normalizedNext;
    setPendingQuantityUpdates(normalizedNext);
  }, []);

  const setMesaOpenDebugStage = useCallback((stage) => {
    mesaOpenDebugRef.current = {
      stage: String(stage || 'unknown'),
      ts: new Date().toISOString(),
    };
  }, []);

  const buildMesaOpenDebugTag = useCallback((errorLike, mesa) => {
    const dbg = mesaOpenDebugRef.current || {};
    const mesaId = normalizeEntityId(mesa?.id) || 'na';
    const navOnline = typeof navigator !== 'undefined' && navigator.onLine === false ? '0' : '1';
    const runtimeOffline = isOfflineMode() ? '1' : '0';
    const persistence = isOfflinePersistenceEnabled() ? '1' : '0';
    const msg = String(errorLike?.message || errorLike || 'unknown')
      .replace(/\s+/g, ' ')
      .slice(0, 80);
    return `MESA_OPEN_DBG|stage=${dbg.stage || 'na'}|mesa=${mesaId}|online=${navOnline}|offline=${runtimeOffline}|persist=${persistence}|msg=${msg}`;
  }, []);

  const sendMesaSyncBroadcast = useCallback((event, payload) => {
    const channel = mesaSyncBroadcastChannelRef.current;
    if (!channel) return;
    const message = { type: 'broadcast', event, payload };
    const canHttpSend = typeof channel?.httpSend === 'function';
    const isReady = mesaSyncBroadcastReadyRef.current === true;
    if (!isReady && canHttpSend) {
      void channel.httpSend(message);
      return;
    }
    const sendResult = channel.send(message);
    if (sendResult && typeof sendResult.then === 'function') {
      void sendResult.catch(() => {
        if (canHttpSend) return channel.httpSend(message);
        return undefined;
      });
    }
  }, []);

  const publishMesaLockBroadcast = useCallback(
    ({ tableId, locked, mode = 'optimistic', lockToken = null }) => {
      const normalizedBusinessId = String(businessId || '').trim();
      const normalizedTableId = String(tableId || '').trim();
      if (!normalizedBusinessId || !normalizedTableId) return;
      const resolvedUserId = normalizeEntityId(currentUser?.id);
      if (!resolvedUserId) return;
      const lockTtlMs = 45_000;
      const lockExpiresAt = locked ? new Date(Date.now() + lockTtlMs).toISOString() : null;
      sendMesaSyncBroadcast('mesa_lock_changed', {
        sender_user_id: resolvedUserId,
        sender_client_id: mesaSyncClientIdRef.current,
        mesa_id: normalizedTableId,
        business_id: normalizedBusinessId,
        locked: Boolean(locked),
        mode,
        lock_owner_user_id: locked ? resolvedUserId : null,
        lock_token: lockToken,
        lock_expires_at: lockExpiresAt,
        lock_ttl_ms: locked ? lockTtlMs : null,
        emitted_at: Date.now(),
      });
    },
    [businessId, currentUser?.id, sendMesaSyncBroadcast],
  );

  const markOrderItemOpStarted = useCallback(() => {
    pendingOrderItemOpsRef.current += 1;
    setPendingOrderItemOps((prev) => prev + 1);
  }, [setPendingOrderItemOps]);

  const markOrderItemOpFinished = useCallback(() => {
    pendingOrderItemOpsRef.current = Math.max(pendingOrderItemOpsRef.current - 1, 0);
    setPendingOrderItemOps((prev) => Math.max(prev - 1, 0));
  }, [setPendingOrderItemOps]);

  const waitForPendingOrderItemOps = useCallback(async ({ timeoutMs = 2000, pollMs = 40 } = {}) => {
    const startedAt = Date.now();
    while (pendingOrderItemOpsRef.current > 0 && Date.now() - startedAt < timeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, pollMs));
    }
    return pendingOrderItemOpsRef.current <= 0;
  }, []);

  const enqueueOrderItemWrite = useCallback((itemId, task) => {
    const normalizedItemId = String(itemId || '').trim();
    if (!normalizedItemId || typeof task !== 'function') return Promise.resolve(null);
    const queueByItem = orderItemWriteQueueRef.current || {};
    const previous = queueByItem[normalizedItemId] || Promise.resolve();
    const next = previous.catch((err) => { logger.warn('mesas:refs:enqueueOrderItemWrite:previous_task_failed', err); }).then(() => task());
    queueByItem[normalizedItemId] = next;
    orderItemWriteQueueRef.current = queueByItem;
    return next.finally(() => {
      if (orderItemWriteQueueRef.current?.[normalizedItemId] === next) {
        delete orderItemWriteQueueRef.current[normalizedItemId];
      }
    });
  }, []);

  return {
    mesasLengthRef,
    hasLoadedOnceRef,
    pendingQuantityUpdatesRef,
    orderItemsDirtyRef,
    orderItemsRef,
    selectedMesaRef,
    productCatalogByIdRef,
    comboCatalogByIdRef,
    orderDetailsRequestRef,
    lastSyncedOrderTotalsRef,
    pendingRemoteOrderTotalsRef,
    orderTotalSyncQueueRef,
    optimisticTempItemQuantitiesRef,
    pendingOrderItemOpsRef,
    orderItemWriteQueueRef,
    mesasSnapshotTimerRef,
    mesaOpenDebugRef,
    mesaSyncBroadcastChannelRef,
    mesaSyncBroadcastReadyRef,
    mesaSyncClientIdRef,
    activeMesaBroadcastRef,
    heldMesaLockRef,
    mesaLockHeartbeatTimerRef,
    justCompletedSaleRef,
    isOfflineFirstRuntime,
    setPendingQuantityUpdatesSafe,
    setMesaOpenDebugStage,
    buildMesaOpenDebugTag,
    sendMesaSyncBroadcast,
    publishMesaLockBroadcast,
    markOrderItemOpStarted,
    markOrderItemOpFinished,
    waitForPendingOrderItemOps,
    enqueueOrderItemWrite,
  };
}
