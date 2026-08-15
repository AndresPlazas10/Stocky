import { useCallback, useRef } from 'react';
import { logger } from '../../../utils/logger';
import { normalizeEntityId, MESA_LOCK_TTL_MS } from './mesaHelpers';
import { isOfflineMode, isOfflinePersistenceEnabled } from '../../../utils/offlineSnapshot.js';

export function useMesasRefs({
  businessId,
  currentUser,
}) {
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
  const emptyReleaseInProgressRef = useRef(null);

  const isOfflineFirstRuntime = isOfflineMode() && isOfflinePersistenceEnabled();

  const setPendingQuantityUpdatesSafe = useCallback((updater) => {
    const prev = pendingQuantityUpdatesRef.current || {};
    const next = typeof updater === 'function' ? updater(prev) : updater;
    const normalizedNext = next && typeof next === 'object' ? next : {};
    pendingQuantityUpdatesRef.current = normalizedNext;
  }, []);

  const setMesaOpenDebugStage = useCallback((stage) => {
    mesaOpenDebugRef.current = {
      stage: String(stage || 'unknown'),
      ts: new Date().toISOString(),
    };
  }, []);

  const buildMesaOpenDebugTag = useCallback((errorLike, mesa) => {
    const dbg = mesaOpenDebugRef.current;
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
    if (!channel) {
      logger.warn('[Broadcast] No channel available for sending', { event });
      return;
    }
    const message = { type: 'broadcast', event, payload };
    const canHttpSend = typeof channel?.httpSend === 'function';
    const isReady = mesaSyncBroadcastReadyRef.current === true;
    
    logger.info('[Broadcast] Sending broadcast', { 
      event, 
      mesaId: payload?.mesa_id, 
      locked: payload?.locked, 
      mode: payload?.mode,
      isReady,
      willUseHttp: !isReady && canHttpSend 
    });
    
    if (!isReady && canHttpSend) {
      logger.warn('[Broadcast] Channel not ready, using HTTP fallback');
      void channel.httpSend(message);
      return;
    }
    const sendResult = channel.send(message);
    if (sendResult && typeof sendResult.then === 'function') {
      void sendResult.catch((err) => {
        logger.error('[Broadcast] Send failed, trying HTTP fallback', err);
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
      const lockTtlMs = MESA_LOCK_TTL_MS;
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

  return {
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
    mesasSnapshotTimerRef,
    mesaOpenDebugRef,
    mesaSyncBroadcastChannelRef,
    mesaSyncBroadcastReadyRef,
    mesaSyncClientIdRef,
    activeMesaBroadcastRef,
    heldMesaLockRef,
    mesaLockHeartbeatTimerRef,
    justCompletedSaleRef,
    emptyReleaseInProgressRef,
    isOfflineFirstRuntime,
    setPendingQuantityUpdatesSafe,
    setMesaOpenDebugStage,
    buildMesaOpenDebugTag,
    sendMesaSyncBroadcast,
    publishMesaLockBroadcast,
  };
}
