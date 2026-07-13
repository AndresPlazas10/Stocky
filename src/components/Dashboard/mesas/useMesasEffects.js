import { useEffect } from 'react';
import { compareTableIdentifiers, MESAS_REMOTE_FALLBACK_POLL_MS, MESA_LOCK_HEARTBEAT_MS } from './mesaHelpers';
import { normalizeTableRecord } from '../../../utils/tableStatus';
import { saveOfflineSnapshot } from '../../../utils/offlineSnapshot.js';
import { supabase } from '../../../supabase/Client';
import { logger } from '@/utils/logger';

export function useMesasEffects({
  businessId,
  mesas,
  _selectedMesa,
  showOrderDetails,
  loadMesas,
  loadClientes,
  getCurrentUser,
  checkIfEmployee,
  refreshMesaLocks,
  applyRealtimeMesaLockBroadcast,
  refreshMesaEditLockHeartbeatWeb,
  releaseMesaEditLockWeb,
  flushPendingRemoteOrderTotals,
  _setMesas,
  _setShowOrderDetails,
  _setCanShowOrderModal,
  heldMesaLockRef,
  activeMesaBroadcastRef,
  mesaSyncBroadcastChannelRef,
  mesaSyncBroadcastReadyRef,
  mesasSnapshotTimerRef,
  mesaLockHeartbeatTimerRef,
  publishMesaLockBroadcast,
}) {
  // Initial Load
  useEffect(() => {
    if (businessId) {
      const loadData = async () => {
        try {
          await Promise.all([loadMesas(), loadClientes()]);
        } catch (err) {
          logger.warn('mesas:effects:initial_data_load failed', err);
        }
      };
      loadData();
      getCurrentUser();
      checkIfEmployee();
    }
  }, [businessId, loadMesas, loadClientes, getCurrentUser, checkIfEmployee]);

  useEffect(() => {
    if (!businessId) return;
    refreshMesaLocks(businessId);
  }, [businessId, refreshMesaLocks]);

  // Broadcast Channel
  useEffect(() => {
    if (!businessId) return undefined;
    const channel = supabase
      .channel(`private:mobile-mesas-sync:${businessId}`)
      .on('broadcast', { event: 'mesa_lock_changed' }, ({ payload }) => {
        applyRealtimeMesaLockBroadcast(payload);
      });
    channel.subscribe((status) => {
      mesaSyncBroadcastReadyRef.current = status === 'SUBSCRIBED';
    });
    mesaSyncBroadcastChannelRef.current = channel;
    return () => {
      mesaSyncBroadcastReadyRef.current = false;
      if (mesaSyncBroadcastChannelRef.current) {
        supabase.removeChannel(mesaSyncBroadcastChannelRef.current);
        mesaSyncBroadcastChannelRef.current = null;
      }
    };
  }, [applyRealtimeMesaLockBroadcast, businessId]);

  // Remote Sync Polling
  useEffect(() => {
    if (!businessId) return undefined;
    const syncFromRemote = () => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      loadMesas().catch((err) => { logger.warn('mesas:effects:remote_sync_poll failed', err); });
    };
    const handleVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        syncFromRemote();
      }
    };
    const timer = setInterval(syncFromRemote, MESAS_REMOTE_FALLBACK_POLL_MS);
    window.addEventListener('online', syncFromRemote);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(timer);
      window.removeEventListener('online', syncFromRemote);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [businessId, loadMesas]);

  // Snapshot Save
  useEffect(() => {
    if (!businessId || !Array.isArray(mesas)) return undefined;
    const runSnapshotSave = () => {
      const normalizedForSnapshot = mesas.map(normalizeTableRecord).sort(compareTableIdentifiers);
      saveOfflineSnapshot(`mesas.list:${businessId}`, normalizedForSnapshot);
    };
    if (mesasSnapshotTimerRef.current) {
      const { type, id } = mesasSnapshotTimerRef.current;
      if (type === 'idle' && typeof window !== 'undefined' && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(id);
      } else {
        clearTimeout(id);
      }
    }
    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
      const idleId = window.requestIdleCallback(runSnapshotSave, { timeout: 800 });
      mesasSnapshotTimerRef.current = { type: 'idle', id: idleId };
    } else {
      const timeoutId = setTimeout(runSnapshotSave, 200);
      mesasSnapshotTimerRef.current = { type: 'timeout', id: timeoutId };
    }
    return () => {
      if (!mesasSnapshotTimerRef.current) return;
      const { type, id } = mesasSnapshotTimerRef.current;
      if (type === 'idle' && typeof window !== 'undefined' && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(id);
      } else {
        clearTimeout(id);
      }
      mesasSnapshotTimerRef.current = null;
    };
  }, [businessId, mesas]);

  // Flush Pending Remote Totals
  useEffect(() => {
    if (!businessId) return undefined;
    const flushIfVisible = () => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      flushPendingRemoteOrderTotals().catch((err) => { logger.warn('mesas:effects:flush_pending_totals_poll failed', err); });
    };
    const handleVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        flushIfVisible();
      }
    };
    const timer = setInterval(flushIfVisible, MESAS_REMOTE_FALLBACK_POLL_MS);
    window.addEventListener('online', flushIfVisible);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(timer);
      window.removeEventListener('online', flushIfVisible);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [businessId, flushPendingRemoteOrderTotals]);

  // Lock Release on Modal Close
  useEffect(() => {
    if (showOrderDetails) return;
    const active = activeMesaBroadcastRef.current;
    const held = heldMesaLockRef.current;
    if (!active?.tableId && !held?.tableId) return;
    if (active?.tableId) {
      publishMesaLockBroadcast({
        tableId: active.tableId,
        locked: false,
        mode: 'confirmed',
        lockToken: active.lockToken || null,
      });
    }
    if (held?.tableId && held?.businessId) {
      void releaseMesaEditLockWeb({
        targetBusinessId: held.businessId,
        tableId: held.tableId,
        lockToken: held.lockToken || null,
      });
    }
    activeMesaBroadcastRef.current = null;
    heldMesaLockRef.current = null;
  }, [publishMesaLockBroadcast, releaseMesaEditLockWeb, showOrderDetails]);

  useEffect(
    () => () => {
      const active = activeMesaBroadcastRef.current;
      const held = heldMesaLockRef.current;
      if (!active?.tableId && !held?.tableId) return;
      if (active?.tableId) {
        publishMesaLockBroadcast({
          tableId: active.tableId,
          locked: false,
          mode: 'confirmed',
          lockToken: active.lockToken || null,
        });
      }
      if (held?.tableId && held?.businessId) {
        void releaseMesaEditLockWeb({
          targetBusinessId: held.businessId,
          tableId: held.tableId,
          lockToken: held.lockToken || null,
        });
      }
      activeMesaBroadcastRef.current = null;
      heldMesaLockRef.current = null;
    },
    [publishMesaLockBroadcast, releaseMesaEditLockWeb],
  );

  // Lock Heartbeat
  useEffect(() => {
    if (!showOrderDetails) return undefined;
    if (mesaLockHeartbeatTimerRef.current) {
      clearInterval(mesaLockHeartbeatTimerRef.current);
      mesaLockHeartbeatTimerRef.current = null;
    }
    mesaLockHeartbeatTimerRef.current = setInterval(() => {
      const held = heldMesaLockRef.current;
      if (!held?.businessId || !held?.tableId) return;
      void refreshMesaEditLockHeartbeatWeb({
        targetBusinessId: held.businessId,
        tableId: held.tableId,
        lockToken: held.lockToken || null,
      }).then((result) => {
        if (!result || result.unsupported) return;
        if (!result.ok && result.lost) {
          heldMesaLockRef.current = null;
        }
      });
    }, MESA_LOCK_HEARTBEAT_MS);
    return () => {
      if (mesaLockHeartbeatTimerRef.current) {
        clearInterval(mesaLockHeartbeatTimerRef.current);
        mesaLockHeartbeatTimerRef.current = null;
      }
    };
  }, [refreshMesaEditLockHeartbeatWeb, showOrderDetails]);
}
