import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabaseClient } from '../../../lib/supabase';
import type { MesaRecord, MesaEditLock } from '../../../services/mesasService';
import {
  fetchMesasByBusinessId,
  compareMesaTableIdentifiers,
  resolveMesaSyncVersion,
  listActiveMesaEditLocks,
} from '../../../services/mesasService';
import {
  loadOpenOrderSnapshot,
  normalizeOrderItemQuantity,
  normalizeOrderItemSubtotal,
  normalizeOrderReference,
} from '../../../services/mesaOrderService';

const MESA_SYNC_TRACE_ENABLED = __DEV__;

type RealtimeUiTrace = {
  source: 'tables' | 'orders' | 'order_items' | 'mesa_broadcast' | 'mesa_lock';
  eventType: string;
  rowRef: string;
  receivedAt: number;
  commitLagMs: number | null;
};

export type HeldMesaLock = {
  businessId: string;
  tableId: string;
  lockToken: string | null;
};

export interface UseMesaRealtimeParams {
  businessId: string;
  userId: string;
  isOrderFlowActive: boolean;
  setMesas: React.Dispatch<React.SetStateAction<MesaRecord[]>>;
  setMesaLocksByTableId: React.Dispatch<React.SetStateAction<Record<string, MesaEditLock>>>;
  setSelectedMesa: React.Dispatch<React.SetStateAction<MesaRecord | null>>;
  setShowOrderModal?: React.Dispatch<React.SetStateAction<boolean>>;
  setShowCloseOrderChoiceModal?: React.Dispatch<React.SetStateAction<boolean>>;
  setShowPaymentModal?: React.Dispatch<React.SetStateAction<boolean>>;
  setShowSplitBillModal?: React.Dispatch<React.SetStateAction<boolean>>;
  setShowPaymentMethodMenu?: React.Dispatch<React.SetStateAction<boolean>>;
  setPaymentMethod?: React.Dispatch<React.SetStateAction<any>>;
  setAmountReceived?: React.Dispatch<React.SetStateAction<string>>;
  setOrderItems?: React.Dispatch<React.SetStateAction<any[]>>;
  setSearchCatalog?: React.Dispatch<React.SetStateAction<string>>;
  setIsSearchFocused?: React.Dispatch<React.SetStateAction<boolean>>;
  setMutatingOrderItemId?: React.Dispatch<React.SetStateAction<string | null>>;
  setOrderModalError?: React.Dispatch<React.SetStateAction<string | null>>;
  publishMesaLockBroadcast?: (input: {
    businessId: string;
    tableId: string;
    locked: boolean;
    mode?: 'optimistic' | 'confirmed' | 'rollback';
    lockToken?: string | null;
    lockExpiresAt?: string | null;
  }) => void;
  selectedMesaIdRef: React.MutableRefObject<string>;
  heldMesaLockRef: React.MutableRefObject<HeldMesaLock | null>;
}

export interface UseMesaRealtimeReturn {
  scheduleMesasRealtimeRefresh: () => void;
  scheduleMesaLocksRefresh: (businessId: string) => void;
  scheduleOrderRealtimeSummaryHydration: (orderId: string) => void;
  refreshMesasRealtime: () => Promise<void>;
  mesasSyncBroadcastReadyRef: React.MutableRefObject<boolean>;
  mesasSyncBroadcastChannelRef: React.MutableRefObject<any>;
  pendingUiTraceRef: React.MutableRefObject<RealtimeUiTrace | null>;
  realtimeClientInstanceIdRef: React.MutableRefObject<string>;
  traceAsyncDuration: (label: string, startMs: number, extra?: Record<string, unknown>) => void;
}

function parseCommitLagMs(payload: any): number | null {
  const commitTimestamp = String(payload?.commit_timestamp || '').trim();
  if (!commitTimestamp) return null;
  const commitMs = Date.parse(commitTimestamp);
  if (!Number.isFinite(commitMs)) return null;
  return Math.max(0, Date.now() - commitMs);
}

function resolveRealtimeRowRef(payload: any): string {
  const rowId = String(payload?.new?.id || payload?.old?.id || '').trim();
  if (rowId) return rowId;
  const tableId = String(payload?.new?.table_id || payload?.old?.table_id || '').trim();
  if (tableId) return `table:${tableId}`;
  const orderId = String(payload?.new?.order_id || payload?.old?.order_id || '').trim();
  if (orderId) return `order:${orderId}`;
  return 'unknown';
}

function traceMesaSync(label: string, data: Record<string, unknown>) {
  if (!MESA_SYNC_TRACE_ENABLED) return;
  const safeData = Object.entries(data || {}).reduce<Record<string, unknown>>(
    (acc, [key, value]) => {
      if (value === undefined) return acc;
      acc[key] = value;
      return acc;
    },
    {},
  );
  console.warn(`[mesa-sync] ${label}`, safeData);
}

export function useMesaRealtime({
  businessId: _businessId,
  userId,
  isOrderFlowActive,
  setMesas,
  setMesaLocksByTableId,
  setSelectedMesa,
  selectedMesaIdRef,
  heldMesaLockRef,
}: UseMesaRealtimeParams): UseMesaRealtimeReturn {
  const mesasRealtimeRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mesaLocksRealtimeRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const orderRealtimeSummaryTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const mesasSyncBroadcastChannelRef = useRef<any>(null);
  const mesasSyncBroadcastReadyRef = useRef(false);
  const [realtimeClientInstanceId] = useState(
    () => `mesa-client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  );
  const realtimeClientInstanceIdRef = useRef(realtimeClientInstanceId);
  const pendingUiTraceRef = useRef<RealtimeUiTrace | null>(null);
  const mesaLockPlaceholderTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const recentlyReleasedLocksRef = useRef<Map<string, number>>(new Map());

  const businessId = String(_businessId || '').trim();

  // -------------------------------------------------------------------
  // markRealtimeIngress
  // -------------------------------------------------------------------

  const markRealtimeIngress = useCallback((source: RealtimeUiTrace['source'], payload: any) => {
    const eventType =
      String(payload?.eventType || '')
        .trim()
        .toUpperCase() || 'UNKNOWN';
    const rowRef = resolveRealtimeRowRef(payload);
    const commitLagMs = parseCommitLagMs(payload);
    const receivedAt = Date.now();
    pendingUiTraceRef.current = {
      source,
      eventType,
      rowRef,
      receivedAt,
      commitLagMs,
    };
    traceMesaSync('realtime_in', {
      source,
      eventType,
      rowRef,
      commitLagMs,
    });
  }, []);

  const traceAsyncDuration = useCallback(
    (label: string, startMs: number, extra?: Record<string, unknown>) => {
      traceMesaSync(label, {
        durationMs: Math.max(0, Date.now() - startMs),
        ...(extra || {}),
      });
    },
    [],
  );

  // -------------------------------------------------------------------
  // applyMesaLocks
  // -------------------------------------------------------------------

  const applyMesaLocks = useCallback(
    (locks: MesaEditLock[]) => {
      const next: Record<string, MesaEditLock> = {};
      (Array.isArray(locks) ? locks : []).forEach((lock) => {
        const tableId = String(lock?.table_id || '').trim();
        if (!tableId) return;
        next[tableId] = lock;
      });
      setMesaLocksByTableId((prev) => {
        if (!prev || Object.keys(prev).length === 0) return next;
        const nowMs = Date.now();
        Object.entries(prev).forEach(([tableId, lock]) => {
          if (next[tableId]) return;
          const token = String(lock?.lock_token || '').trim();
          const expiresAtMs = Date.parse(String(lock?.lock_expires_at || '').trim());
          if (!Number.isFinite(expiresAtMs) || expiresAtMs <= nowMs) return;
          const isPending = token.startsWith('pending-') || token.startsWith('broadcast-');
          const updatedAtMs = Date.parse(String(lock?.updated_at || '').trim());
          const isFresh = Number.isFinite(updatedAtMs) && nowMs - updatedAtMs <= 4000;
          if (isPending || isFresh) {
            next[tableId] = lock;
          }
        });
        return next;
      });
    },
    [setMesaLocksByTableId],
  );

  // -------------------------------------------------------------------
  // clearMesaLockPlaceholderTimer / applyMesaLockPlaceholder
  // -------------------------------------------------------------------

  const clearMesaLockPlaceholderTimer = useCallback((mesaId: string) => {
    const timers = mesaLockPlaceholderTimersRef.current;
    const existing = timers[mesaId];
    if (existing) {
      clearTimeout(existing);
      delete timers[mesaId];
    }
  }, []);

  const applyMesaLockPlaceholder = useCallback(
    (mesaId: string, lockBusinessId: string) => {
      if (!mesaId || !lockBusinessId) return;
      const releasedAt = recentlyReleasedLocksRef.current.get(mesaId);
      if (releasedAt && Date.now() - releasedAt < 2000) {
        recentlyReleasedLocksRef.current.delete(mesaId);
        return;
      }
      const token = `pending-${mesaId}-${Date.now()}`;
      const expiresAt = new Date(Date.now() + 3500).toISOString();
      const updatedAt = new Date().toISOString();

      setMesaLocksByTableId((prev) => {
        if (prev[mesaId]) return prev;
        return {
          ...prev,
          [mesaId]: {
            table_id: mesaId,
            business_id: lockBusinessId,
            lock_owner_user_id: '',
            lock_owner_name: 'Alguien',
            lock_token: token,
            lock_expires_at: expiresAt,
            updated_at: updatedAt,
          },
        };
      });

      clearMesaLockPlaceholderTimer(mesaId);
      mesaLockPlaceholderTimersRef.current[mesaId] = setTimeout(() => {
        setMesaLocksByTableId((prev) => {
          const current = prev[mesaId];
          if (!current) return prev;
          if (String(current.lock_token || '') !== token) return prev;
          const next = { ...prev };
          delete next[mesaId];
          return next;
        });
        clearMesaLockPlaceholderTimer(mesaId);
      }, 3800);
    },
    [clearMesaLockPlaceholderTimer, setMesaLocksByTableId],
  );

  // -------------------------------------------------------------------
  // refreshMesaLocks
  // -------------------------------------------------------------------

  const refreshMesaLocks = useCallback(
    async (lockBusinessId: string) => {
      const normalizedBusinessId = String(lockBusinessId || '').trim();
      if (!normalizedBusinessId) {
        setMesaLocksByTableId({});
        return;
      }
      try {
        const locks = await listActiveMesaEditLocks(normalizedBusinessId);
        applyMesaLocks(locks);
      } catch {
        // no-op: no bloquear flujo principal por locks
      }
    },
    [applyMesaLocks, setMesaLocksByTableId],
  );

  // -------------------------------------------------------------------
  // applyRealtimeMesaLockHint
  // -------------------------------------------------------------------

  const applyRealtimeMesaLockHint = useCallback(
    (payload: any) => {
      const mesaId = String(payload?.mesa_id || '').trim();
      if (!mesaId) return;

      const status = String(payload?.status || '')
        .trim()
        .toLowerCase();
      if (status === 'available') {
        setMesaLocksByTableId((prev) => {
          if (!prev[mesaId]) return prev;
          const next = { ...prev };
          delete next[mesaId];
          return next;
        });
        return;
      }

      const ownerUserId = String(payload?.editing_user_id || payload?.sender_user_id || '').trim();
      if (!ownerUserId) return;

      const ownerName =
        String(payload?.editing_user_name || payload?.sender_user_name || 'Usuario').trim() ||
        'Usuario';
      const hintBusinessId = String(payload?.business_id || '').trim();
      const lockToken = String(payload?.editing_lock_token || '').trim() || null;
      const expiresAtRaw = String(payload?.editing_lock_expires_at || '').trim();
      const lockTtlMs = Math.max(15_000, Number(payload?.editing_lock_ttl_ms || 45_000));
      const lockExpiresAt = expiresAtRaw || new Date(Date.now() + lockTtlMs).toISOString();
      const updatedAt = new Date().toISOString();

      setMesaLocksByTableId((prev) => ({
        ...prev,
        [mesaId]: {
          table_id: mesaId,
          business_id: hintBusinessId || String(prev[mesaId]?.business_id || '').trim(),
          lock_owner_user_id: ownerUserId,
          lock_owner_name: ownerName,
          lock_token: lockToken,
          lock_expires_at: lockExpiresAt,
          updated_at: updatedAt,
        },
      }));
    },
    [setMesaLocksByTableId],
  );

  // -------------------------------------------------------------------
  // applyRealtimeMesaLockEvent
  // -------------------------------------------------------------------

  const applyRealtimeMesaLockEvent = useCallback(
    (payload: any) => {
      const eventType = String(payload?.eventType || '')
        .trim()
        .toUpperCase();
      const nextRow = payload?.new && typeof payload.new === 'object' ? payload.new : null;
      const prevRow = payload?.old && typeof payload.old === 'object' ? payload.old : null;
      const tableId = String(nextRow?.table_id || prevRow?.table_id || '').trim();
      if (!tableId) return;

      if (eventType === 'DELETE') {
        setMesaLocksByTableId((prev) => {
          if (!prev[tableId]) return prev;
          const next = { ...prev };
          delete next[tableId];
          return next;
        });
        return;
      }

      const lockOwnerUserId = String(nextRow?.lock_owner_user_id || '').trim();
      if (!lockOwnerUserId) {
        setMesaLocksByTableId((prev) => {
          if (!prev[tableId]) return prev;
          const next = { ...prev };
          delete next[tableId];
          return next;
        });
        return;
      }

      const rawExpiresAt = String(nextRow?.lock_expires_at || '').trim();
      if (rawExpiresAt) {
        const expiresAtMs = Date.parse(rawExpiresAt);
        if (Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now()) {
          setMesaLocksByTableId((prev) => {
            if (!prev[tableId]) return prev;
            const next = { ...prev };
            delete next[tableId];
            return next;
          });
          return;
        }
      }

      const lock: MesaEditLock = {
        table_id: tableId,
        business_id: String(nextRow?.business_id || prevRow?.business_id || '').trim(),
        lock_owner_user_id: lockOwnerUserId,
        lock_owner_name: String(nextRow?.lock_owner_name || 'Usuario').trim() || 'Usuario',
        lock_token: String(nextRow?.lock_token || '').trim() || null,
        lock_expires_at: rawExpiresAt || null,
        updated_at: String(nextRow?.updated_at || '').trim() || new Date().toISOString(),
      };

      setMesaLocksByTableId((prev) => ({
        ...prev,
        [tableId]: lock,
      }));
    },
    [setMesaLocksByTableId],
  );

  // -------------------------------------------------------------------
  // applyRealtimeMesaLockBroadcast
  // -------------------------------------------------------------------

  const applyRealtimeMesaLockBroadcast = useCallback(
    (payload: any) => {
      const senderClientId = String(payload?.sender_client_id || '').trim();
      if (
        senderClientId &&
        senderClientId === String(realtimeClientInstanceIdRef.current || '').trim()
      )
        return;

      const activeBusinessId = businessId;
      const payloadBusinessId = String(payload?.business_id || '').trim();
      if (activeBusinessId && (!payloadBusinessId || payloadBusinessId !== activeBusinessId)) {
        return;
      }

      const mesaId = String(payload?.mesa_id || '').trim();
      if (!mesaId) return;

      const locked =
        payload?.locked === true ||
        String(payload?.locked || '')
          .trim()
          .toLowerCase() === 'true';

      if (!locked) {
        setMesaLocksByTableId((prev) => {
          if (!prev[mesaId]) return prev;
          const next = { ...prev };
          delete next[mesaId];
          return next;
        });
        recentlyReleasedLocksRef.current.set(mesaId, Date.now());
        return;
      }

      const ownerUserId = String(
        payload?.lock_owner_user_id || payload?.sender_user_id || '',
      ).trim();
      if (!ownerUserId) return;

      const resolvedBusinessId = activeBusinessId || String(payload?.business_id || '').trim();
      const lockToken = String(payload?.lock_token || '').trim() || null;
      const rawExpiresAt = String(payload?.lock_expires_at || '').trim();
      const lockTtlMs = Math.min(120_000, Math.max(15_000, Number(payload?.lock_ttl_ms || 45_000)));
      const nowMs = Date.now();
      const parsedExpiresAt = rawExpiresAt ? Date.parse(rawExpiresAt) : Number.NaN;
      const safeExpiresAtMs = Number.isFinite(parsedExpiresAt)
        ? Math.min(parsedExpiresAt, nowMs + lockTtlMs)
        : nowMs + lockTtlMs;
      const lockExpiresAt = new Date(safeExpiresAtMs).toISOString();

      setMesaLocksByTableId((prev) => ({
        ...prev,
        [mesaId]: {
          table_id: mesaId,
          business_id: resolvedBusinessId || String(prev[mesaId]?.business_id || '').trim(),
          lock_owner_user_id: ownerUserId,
          lock_owner_name: 'Alguien',
          lock_token: lockToken,
          lock_expires_at: lockExpiresAt,
          updated_at: new Date().toISOString(),
        },
      }));
    },
    [businessId, setMesaLocksByTableId],
  );

  // -------------------------------------------------------------------
  // refreshMesasRealtime
  // -------------------------------------------------------------------

  const refreshMesasRealtime = useCallback(async () => {
    if (!businessId) return;

    try {
      const refreshStart = Date.now();
      const incoming = (await fetchMesasByBusinessId(businessId)).sort(compareMesaTableIdentifiers);
      traceAsyncDuration('refresh_fetch_mesas', refreshStart, {
        businessId,
        rows: incoming.length,
      });
      const selectedMesaId = isOrderFlowActive
        ? String(selectedMesaIdRef.current || '').trim()
        : '';

      setMesas((prev) => {
        const previousById = new Map(prev.map((mesa) => [String(mesa.id || ''), mesa]));
        return incoming.map((mesa) => {
          const mesaId = String(mesa.id || '').trim();
          const previousMesa = previousById.get(mesaId);
          if (selectedMesaId && String(mesa.id || '') === selectedMesaId) {
            return previousById.get(selectedMesaId) || mesa;
          }
          if (previousMesa) {
            const previousSyncVersion = resolveMesaSyncVersion(previousMesa);
            const incomingSyncVersion = resolveMesaSyncVersion(mesa);
            if (previousSyncVersion > incomingSyncVersion) {
              traceMesaSync('refresh_drop_stale_row', {
                mesaId,
                previousSyncVersion,
                incomingSyncVersion,
              });
              return previousMesa;
            }
          }
          return mesa;
        });
      });
    } catch {
      // no-op
    }
  }, [businessId, isOrderFlowActive, selectedMesaIdRef, setMesas, traceAsyncDuration]);

  // -------------------------------------------------------------------
  // scheduleMesasRealtimeRefresh
  // -------------------------------------------------------------------

  const scheduleMesasRealtimeRefresh = useCallback(() => {
    if (mesasRealtimeRefreshTimerRef.current) return;
    mesasRealtimeRefreshTimerRef.current = setTimeout(() => {
      mesasRealtimeRefreshTimerRef.current = null;
      void refreshMesasRealtime();
    }, 80);
  }, [refreshMesasRealtime]);

  // -------------------------------------------------------------------
  // scheduleMesaLocksRefresh
  // -------------------------------------------------------------------

  const scheduleMesaLocksRefresh = useCallback(
    (lockBusinessId: string) => {
      const normalizedBusinessId = String(lockBusinessId || '').trim();
      if (!normalizedBusinessId) return;
      if (mesaLocksRealtimeRefreshTimerRef.current) return;
      mesaLocksRealtimeRefreshTimerRef.current = setTimeout(() => {
        mesaLocksRealtimeRefreshTimerRef.current = null;
        void refreshMesaLocks(normalizedBusinessId);
      }, 140);
    },
    [refreshMesaLocks],
  );

  // -------------------------------------------------------------------
  // hydrateOrderRealtimeSummary / scheduleOrderRealtimeSummaryHydration
  // -------------------------------------------------------------------

  const hydrateOrderRealtimeSummary = useCallback(
    async (orderId: string) => {
      const normalizedOrderId = normalizeOrderReference(orderId);
      if (!normalizedOrderId) return;

      try {
        const hydrateStart = Date.now();
        const snapshot = await loadOpenOrderSnapshot(normalizedOrderId, { forceRefresh: true });
        traceAsyncDuration('hydrate_order_summary', hydrateStart, {
          orderId: normalizedOrderId,
        });
        const total = Math.max(0, Number(snapshot?.total || 0));

        setMesas((prev) => {
          let changed = false;
          const next = prev.map((mesa) => {
            if (normalizeOrderReference(mesa?.current_order_id) !== normalizedOrderId) return mesa;
            changed = true;
            return {
              ...mesa,
              status: 'occupied',
              orders: {
                ...(mesa.orders || {}),
                id: normalizedOrderId,
                status: String(mesa?.orders?.status || 'open'),
                total,
              },
            };
          });
          return changed ? next : prev;
        });

        setSelectedMesa((prev) => {
          if (!prev || normalizeOrderReference(prev?.current_order_id) !== normalizedOrderId)
            return prev;
          return {
            ...prev,
            status: 'occupied',
            orders: {
              ...(prev.orders || {}),
              id: normalizedOrderId,
              status: String(prev?.orders?.status || 'open'),
              total,
            },
          };
        });
      } catch {
        // no-op
      }
    },
    [setMesas, setSelectedMesa, traceAsyncDuration],
  );

  const scheduleOrderRealtimeSummaryHydration = useCallback(
    (orderId: string) => {
      const normalizedOrderId = normalizeOrderReference(orderId);
      if (!normalizedOrderId) return;

      const timers = orderRealtimeSummaryTimersRef.current;
      const previousTimer = timers[normalizedOrderId];
      if (previousTimer) {
        clearTimeout(previousTimer);
      }

      timers[normalizedOrderId] = setTimeout(() => {
        delete timers[normalizedOrderId];
        void hydrateOrderRealtimeSummary(normalizedOrderId);
      }, 40);
    },
    [hydrateOrderRealtimeSummary],
  );

  // -------------------------------------------------------------------
  // applyRealtimeTableEvent
  // -------------------------------------------------------------------

  const applyRealtimeTableEvent = useCallback(
    (payload: any) => {
      const eventType = String(payload?.eventType || '')
        .trim()
        .toUpperCase();
      const nextRow = payload?.new && typeof payload.new === 'object' ? payload.new : null;
      const prevRow = payload?.old && typeof payload.old === 'object' ? payload.old : null;
      const mesaId = String(nextRow?.id || prevRow?.id || '').trim();
      if (!mesaId) return;

      const hasNextCurrentOrderId = Boolean(
        nextRow && Object.prototype.hasOwnProperty.call(nextRow, 'current_order_id'),
      );
      const nextCurrentOrderId = hasNextCurrentOrderId
        ? String(nextRow?.current_order_id || '').trim() || null
        : undefined;
      const hasNextStatus = Boolean(
        nextRow && Object.prototype.hasOwnProperty.call(nextRow, 'status'),
      );
      const nextStatus = hasNextStatus
        ? String(nextRow?.status || '')
            .trim()
            .toLowerCase() || undefined
        : undefined;

      const hasNextTableNumber = Boolean(
        nextRow && Object.prototype.hasOwnProperty.call(nextRow, 'table_number'),
      );
      const hasNextName = Boolean(nextRow && Object.prototype.hasOwnProperty.call(nextRow, 'name'));
      const hasNextSyncVersion = Boolean(
        nextRow && Object.prototype.hasOwnProperty.call(nextRow, 'sync_version'),
      );
      const nextSyncVersion = hasNextSyncVersion
        ? resolveMesaSyncVersion({ sync_version: nextRow?.sync_version } as Partial<MesaRecord>)
        : undefined;

      setMesas((prev) => {
        const index = prev.findIndex((mesa) => String(mesa?.id || '').trim() === mesaId);

        if (eventType === 'DELETE') {
          if (index === -1) return prev;
          const next = prev.filter((mesa) => String(mesa?.id || '').trim() !== mesaId);
          return next;
        }

        if (index === -1) {
          if (!nextRow) return prev;
          const insertedMesa: MesaRecord = {
            id: mesaId,
            business_id: String(nextRow?.business_id || '').trim(),
            table_number: hasNextTableNumber ? (nextRow?.table_number ?? null) : null,
            name: hasNextName ? (nextRow?.name ?? null) : null,
            status: String(nextStatus || 'available'),
            current_order_id: hasNextCurrentOrderId ? nextCurrentOrderId : null,
            sync_version: hasNextSyncVersion ? nextSyncVersion : undefined,
            orders: null,
          };
          return [...prev, insertedMesa].sort(compareMesaTableIdentifiers);
        }

        const current = prev[index];
        if (hasNextSyncVersion) {
          const currentSyncVersion = resolveMesaSyncVersion(current);
          const incomingSyncVersion = nextSyncVersion || 0;
          if (incomingSyncVersion < currentSyncVersion) {
            traceMesaSync('drop_stale_table_event', {
              mesaId,
              currentSyncVersion,
              incomingSyncVersion,
              eventType,
            });
            return prev;
          }
        }
        const resolvedCurrentOrderId = hasNextCurrentOrderId
          ? nextCurrentOrderId
          : (current.current_order_id ?? null);
        const resolvedStatus = String(nextStatus || current.status || 'available');
        const nextMesa: MesaRecord = {
          ...current,
          status: resolvedStatus,
          current_order_id: resolvedCurrentOrderId,
          table_number: hasNextTableNumber ? (nextRow?.table_number ?? null) : current.table_number,
          name: hasNextName ? (nextRow?.name ?? null) : current.name,
          sync_version: hasNextSyncVersion ? nextSyncVersion : current.sync_version,
          orders: (() => {
            if (!resolvedCurrentOrderId || resolvedStatus === 'available') return null;
            if (
              String(current?.orders?.id || '').trim() ===
              String(resolvedCurrentOrderId || '').trim()
            ) {
              return current.orders || null;
            }
            return {
              ...(current.orders || {}),
              id: resolvedCurrentOrderId,
              status: String(current?.orders?.status || 'open'),
              total: Number(current?.orders?.total || 0),
            };
          })(),
        };

        const next = [...prev];
        next[index] = nextMesa;
        return next.sort(compareMesaTableIdentifiers);
      });

      setSelectedMesa((prev) => {
        if (!prev || String(prev?.id || '').trim() !== mesaId || eventType === 'DELETE')
          return prev;
        if (hasNextSyncVersion) {
          const currentSyncVersion = resolveMesaSyncVersion(prev);
          const incomingSyncVersion = nextSyncVersion || 0;
          if (incomingSyncVersion < currentSyncVersion) return prev;
        }
        const resolvedCurrentOrderId = hasNextCurrentOrderId
          ? nextCurrentOrderId
          : (prev.current_order_id ?? null);
        const resolvedStatus = String(nextStatus || prev.status || 'available');
        return {
          ...prev,
          status: resolvedStatus,
          current_order_id: resolvedCurrentOrderId,
          table_number: hasNextTableNumber ? (nextRow?.table_number ?? null) : prev.table_number,
          name: hasNextName ? (nextRow?.name ?? null) : prev.name,
          sync_version: hasNextSyncVersion ? nextSyncVersion : prev.sync_version,
          orders: !resolvedCurrentOrderId || resolvedStatus === 'available' ? null : prev.orders,
        };
      });

      if (eventType !== 'DELETE' && hasNextStatus) {
        const normalizedStatus = String(nextStatus || '')
          .trim()
          .toLowerCase();
        const tableBusinessId = String(
          nextRow?.business_id || prevRow?.business_id || businessId || '',
        ).trim();
        if (normalizedStatus === 'available') {
          clearMesaLockPlaceholderTimer(mesaId);
          setMesaLocksByTableId((prev) => {
            if (!prev[mesaId]) return prev;
            const next = { ...prev };
            delete next[mesaId];
            return next;
          });
        }
        if (normalizedStatus === 'occupied' && tableBusinessId) {
          const selectedMesaId = String(selectedMesaIdRef.current || '').trim();
          const held = heldMesaLockRef.current;
          const hasHeldLock = Boolean(
            held && held.tableId === mesaId && held.businessId === tableBusinessId,
          );
          if (!hasHeldLock && (!selectedMesaId || selectedMesaId !== mesaId)) {
            applyMesaLockPlaceholder(mesaId, tableBusinessId);
          }
        }
      }
      if (eventType !== 'DELETE' && (hasNextStatus || hasNextCurrentOrderId)) {
        const tableBusinessId = String(
          nextRow?.business_id || prevRow?.business_id || businessId || '',
        ).trim();
        if (tableBusinessId) {
          scheduleMesaLocksRefresh(tableBusinessId);
        }
      }
    },
    [
      applyMesaLockPlaceholder,
      businessId,
      clearMesaLockPlaceholderTimer,
      heldMesaLockRef,
      scheduleMesaLocksRefresh,
      selectedMesaIdRef,
      setMesas,
      setMesaLocksByTableId,
      setSelectedMesa,
    ],
  );

  // -------------------------------------------------------------------
  // applyRealtimeOrderEvent
  // -------------------------------------------------------------------

  const applyRealtimeOrderEvent = useCallback(
    (payload: any) => {
      const nextRow = payload?.new && typeof payload.new === 'object' ? payload.new : null;
      const prevRow = payload?.old && typeof payload.old === 'object' ? payload.old : null;
      const orderId = String(nextRow?.id || prevRow?.id || '').trim();
      if (!orderId) return;

      const nextStatus =
        String(nextRow?.status || prevRow?.status || '')
          .trim()
          .toLowerCase() || undefined;
      const hasNextTotal = Boolean(
        nextRow && Object.prototype.hasOwnProperty.call(nextRow, 'total'),
      );
      const nextTotal = hasNextTotal ? Number(nextRow?.total || 0) : null;
      const tableId = String(nextRow?.table_id || prevRow?.table_id || '').trim();
      const tableBusinessId = String(
        nextRow?.business_id || prevRow?.business_id || businessId || '',
      ).trim();

      if (tableId && tableBusinessId) {
        const normalizedStatus = String(nextStatus || '')
          .trim()
          .toLowerCase();
        if (normalizedStatus === 'open') {
          const selectedMesaId = String(selectedMesaIdRef.current || '').trim();
          const held = heldMesaLockRef.current;
          const hasHeldLock = Boolean(
            held && held.tableId === tableId && held.businessId === tableBusinessId,
          );
          if (!hasHeldLock && (!selectedMesaId || selectedMesaId !== tableId)) {
            applyMesaLockPlaceholder(tableId, tableBusinessId);
          }
        } else if (normalizedStatus) {
          clearMesaLockPlaceholderTimer(tableId);
          setMesaLocksByTableId((prev) => {
            const current = prev[tableId];
            if (!current) return prev;
            const currentToken = String(current.lock_token || '').trim();
            if (!currentToken.startsWith('pending-')) return prev;
            const next = { ...prev };
            delete next[tableId];
            return next;
          });
        }
      }

      setMesas((prev) =>
        prev.map((mesa) => {
          if (String(mesa?.current_order_id || '').trim() !== orderId) return mesa;
          return {
            ...mesa,
            orders: {
              ...(mesa.orders || {}),
              id: orderId,
              status: nextStatus || String(mesa?.orders?.status || 'open'),
              total: nextTotal === null ? Number(mesa?.orders?.total || 0) : Number(nextTotal || 0),
            },
          };
        }),
      );
    },
    [
      applyMesaLockPlaceholder,
      businessId,
      clearMesaLockPlaceholderTimer,
      heldMesaLockRef,
      selectedMesaIdRef,
      setMesas,
      setMesaLocksByTableId,
    ],
  );

  // -------------------------------------------------------------------
  // applyRealtimeOrderItemDelta
  // -------------------------------------------------------------------

  const applyRealtimeOrderItemDelta = useCallback(
    (payload: any) => {
      const eventType = String(payload?.eventType || '')
        .trim()
        .toUpperCase();
      const nextRow = payload?.new && typeof payload.new === 'object' ? payload.new : null;
      const prevRow = payload?.old && typeof payload.old === 'object' ? payload.old : null;

      const deltasByOrderId = new Map<string, { deltaUnits: number; deltaTotal: number }>();
      const pushDelta = (orderId: unknown, deltaUnits: number, deltaTotal: number) => {
        const normalizedOrderId = normalizeOrderReference(orderId);
        if (!normalizedOrderId) return;
        const previous = deltasByOrderId.get(normalizedOrderId) || { deltaUnits: 0, deltaTotal: 0 };
        deltasByOrderId.set(normalizedOrderId, {
          deltaUnits: previous.deltaUnits + deltaUnits,
          deltaTotal: previous.deltaTotal + deltaTotal,
        });
      };

      const nextOrderId = normalizeOrderReference(nextRow?.order_id);
      const previousOrderId = normalizeOrderReference(prevRow?.order_id);

      if (eventType === 'INSERT') {
        pushDelta(
          nextOrderId,
          normalizeOrderItemQuantity(nextRow?.quantity),
          normalizeOrderItemSubtotal(nextRow),
        );
      } else if (eventType === 'DELETE') {
        pushDelta(
          previousOrderId,
          -normalizeOrderItemQuantity(prevRow?.quantity),
          -normalizeOrderItemSubtotal(prevRow),
        );
      } else {
        const nextQuantity = normalizeOrderItemQuantity(nextRow?.quantity);
        const previousQuantity = normalizeOrderItemQuantity(prevRow?.quantity);
        const nextSubtotal = normalizeOrderItemSubtotal(nextRow);
        const previousSubtotal = normalizeOrderItemSubtotal(prevRow);

        if (nextOrderId && previousOrderId && nextOrderId !== previousOrderId) {
          pushDelta(previousOrderId, -previousQuantity, -previousSubtotal);
          pushDelta(nextOrderId, nextQuantity, nextSubtotal);
        } else {
          pushDelta(
            nextOrderId || previousOrderId,
            nextQuantity - previousQuantity,
            nextSubtotal - previousSubtotal,
          );
        }
      }

      if (deltasByOrderId.size === 0) return;

      const normalizeTotal = (value: number) => Math.max(0, Math.round(value * 100) / 100);

      setMesas((prev) => {
        let changed = false;
        const next = prev.map((mesa) => {
          const orderId = normalizeOrderReference(mesa?.current_order_id);
          if (!orderId) return mesa;
          const delta = deltasByOrderId.get(orderId);
          if (!delta) return mesa;

          const currentTotal = Number(mesa?.orders?.total || 0);
          const safeCurrentTotal = Number.isFinite(currentTotal) ? currentTotal : 0;
          const nextTotal = normalizeTotal(safeCurrentTotal + delta.deltaTotal);

          if (nextTotal === safeCurrentTotal) return mesa;
          changed = true;
          return {
            ...mesa,
            status: 'occupied',
            orders: {
              ...(mesa.orders || {}),
              id: orderId,
              status: String(mesa?.orders?.status || 'open'),
              total: nextTotal,
            },
          };
        });
        return changed ? next : prev;
      });

      setSelectedMesa((prev) => {
        if (!prev) return prev;
        const selectedOrderId = normalizeOrderReference(prev?.current_order_id);
        if (!selectedOrderId) return prev;
        const delta = deltasByOrderId.get(selectedOrderId);
        if (!delta) return prev;

        const currentTotal = Number(prev?.orders?.total || 0);
        const safeCurrentTotal = Number.isFinite(currentTotal) ? currentTotal : 0;
        const nextTotal = normalizeTotal(safeCurrentTotal + delta.deltaTotal);

        if (nextTotal === safeCurrentTotal) return prev;

        return {
          ...prev,
          status: 'occupied',
          orders: {
            ...(prev.orders || {}),
            id: selectedOrderId,
            status: String(prev?.orders?.status || 'open'),
            total: nextTotal,
          },
        };
      });
    },
    [setMesas, setSelectedMesa],
  );

  // -------------------------------------------------------------------
  // applyRealtimeMesaBroadcast
  // -------------------------------------------------------------------

  const applyRealtimeMesaBroadcast = useCallback(
    (payload: any) => {
      const senderClientId = String(payload?.sender_client_id || '').trim();
      if (
        senderClientId &&
        senderClientId === String(realtimeClientInstanceIdRef.current || '').trim()
      )
        return;

      const mesaId = String(payload?.mesa_id || '').trim();
      if (!mesaId) return;

      const activeBusinessId = businessId;
      const payloadBusinessId = String(payload?.business_id || '').trim();
      if (activeBusinessId && (!payloadBusinessId || payloadBusinessId !== activeBusinessId)) {
        return;
      }

      applyRealtimeMesaLockHint(payload);

      applyRealtimeTableEvent({
        eventType: 'UPDATE',
        old: {
          current_order_id: payload?.previous_order_id ?? null,
        },
        new: {
          id: mesaId,
          business_id: payload?.business_id ?? null,
          status: payload?.status ?? null,
          current_order_id: payload?.current_order_id ?? null,
          table_number: payload?.table_number ?? null,
          name: payload?.name ?? null,
          sync_version: payload?.sync_version ?? null,
        },
      });

      if (payload?.current_order_id) {
        applyRealtimeOrderEvent({
          eventType: 'UPDATE',
          new: {
            id: payload.current_order_id,
            status: payload?.order_status ?? 'open',
            total: payload?.order_total ?? 0,
          },
        });
      }
    },
    [applyRealtimeMesaLockHint, applyRealtimeOrderEvent, applyRealtimeTableEvent, businessId],
  );

  // -------------------------------------------------------------------
  // Main realtime useEffect (channel creation, subscription, fallback polling)
  // -------------------------------------------------------------------

  useEffect(() => {
    if (!businessId) {
      setMesaLocksByTableId({});
      return undefined;
    }

    let cancelled = false;
    let fallbackTimer: ReturnType<typeof setInterval> | null = null;

    let client;
    try {
      client = getSupabaseClient();
    } catch {
      return undefined;
    }

    const scheduleRefresh = () => {
      if (cancelled) return;
      scheduleMesasRealtimeRefresh();
    };

    const scheduleLocks = () => {
      if (cancelled) return;
      scheduleMesaLocksRefresh(businessId);
    };

    const channel = client
      .channel(`mobile-mesas:${businessId}:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tables',
          filter: `business_id=eq.${businessId}`,
        },
        (payload: any) => {
          if (cancelled) return;
          markRealtimeIngress('tables', payload);
          applyRealtimeTableEvent(payload);
          scheduleRefresh();
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `business_id=eq.${businessId}`,
        },
        (payload: any) => {
          if (cancelled) return;
          markRealtimeIngress('orders', payload);
          applyRealtimeOrderEvent(payload);
          scheduleRefresh();
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_items',
        },
        (payload: any) => {
          if (cancelled) return;
          markRealtimeIngress('order_items', payload);
          const newRow = payload?.new as Record<string, unknown> | undefined;
          const oldRow = payload?.old as Record<string, unknown> | undefined;
          const nextOrderId = normalizeOrderReference(newRow?.order_id);
          const previousOrderId = normalizeOrderReference(oldRow?.order_id);

          applyRealtimeOrderItemDelta(payload);

          if (nextOrderId) {
            scheduleOrderRealtimeSummaryHydration(nextOrderId);
          }
          if (previousOrderId && previousOrderId !== nextOrderId) {
            scheduleOrderRealtimeSummaryHydration(previousOrderId);
          }

          if (!nextOrderId && !previousOrderId) {
            scheduleRefresh();
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'table_edit_locks',
          filter: `business_id=eq.${businessId}`,
        },
        (payload: any) => {
          if (cancelled) return;
          markRealtimeIngress('mesa_lock', payload);
          applyRealtimeMesaLockEvent(payload);
          scheduleLocks();
        },
      );

    const syncChannel = client
      .channel(`private:mobile-mesas-sync:${businessId}`)
      .on('broadcast', { event: 'mesa_lock_changed' }, ({ payload }: { payload: any }) => {
        if (cancelled) return;
        traceMesaSync('realtime_in', {
          source: 'mesa_lock_broadcast',
          rowRef: String(payload?.mesa_id || '').trim() || 'unknown',
          syncMode: String(payload?.mode || '').trim() || null,
        });
        applyRealtimeMesaLockBroadcast(payload);
      })
      .on('broadcast', { event: 'mesa_state_changed' }, ({ payload }: { payload: any }) => {
        if (cancelled) return;
        traceMesaSync('realtime_in', {
          source: 'mesa_broadcast',
          rowRef: String(payload?.mesa_id || '').trim() || 'unknown',
          syncMode: String(payload?.sync_mode || '').trim() || null,
          emittedLagMs: Number.isFinite(Number(payload?.emitted_at))
            ? Math.max(0, Date.now() - Number(payload.emitted_at))
            : null,
        });
        applyRealtimeMesaBroadcast(payload);
        const mode = String(payload?.sync_mode || 'confirmed')
          .trim()
          .toLowerCase();
        if (mode !== 'optimistic') {
          scheduleRefresh();
        }
      });

    channel.subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        scheduleRefresh();
        scheduleLocks();
      }
    });
    mesasSyncBroadcastReadyRef.current = false;
    syncChannel.subscribe((status: string) => {
      mesasSyncBroadcastReadyRef.current = status === 'SUBSCRIBED';
    });
    mesasSyncBroadcastChannelRef.current = syncChannel;

    fallbackTimer = setInterval(() => {
      scheduleRefresh();
      scheduleLocks();
    }, 15000);

    return () => {
      cancelled = true;
      if (fallbackTimer) clearInterval(fallbackTimer);
      if (mesasRealtimeRefreshTimerRef.current) {
        clearTimeout(mesasRealtimeRefreshTimerRef.current);
        mesasRealtimeRefreshTimerRef.current = null;
      }
      if (mesaLocksRealtimeRefreshTimerRef.current) {
        clearTimeout(mesaLocksRealtimeRefreshTimerRef.current);
        mesaLocksRealtimeRefreshTimerRef.current = null;
      }
      recentlyReleasedLocksRef.current.clear();
      void client.removeChannel(channel);
      if (mesasSyncBroadcastChannelRef.current) {
        void client.removeChannel(mesasSyncBroadcastChannelRef.current);
        mesasSyncBroadcastChannelRef.current = null;
      }
      mesasSyncBroadcastReadyRef.current = false;
      Object.values(orderRealtimeSummaryTimersRef.current).forEach((timer) => {
        clearTimeout(timer);
      });
      orderRealtimeSummaryTimersRef.current = {};
    };
  }, [
    applyRealtimeMesaLockBroadcast,
    applyRealtimeMesaBroadcast,
    applyRealtimeMesaLockEvent,
    applyRealtimeOrderItemDelta,
    applyRealtimeOrderEvent,
    applyRealtimeTableEvent,
    businessId,
    markRealtimeIngress,
    scheduleOrderRealtimeSummaryHydration,
    scheduleMesaLocksRefresh,
    scheduleMesasRealtimeRefresh,
    setMesaLocksByTableId,
    userId,
  ]);

  // -------------------------------------------------------------------
  // Return
  // -------------------------------------------------------------------

  return {
    scheduleMesasRealtimeRefresh,
    scheduleMesaLocksRefresh,
    scheduleOrderRealtimeSummaryHydration,
    refreshMesasRealtime,
    mesasSyncBroadcastReadyRef,
    mesasSyncBroadcastChannelRef,
    pendingUiTraceRef,
    realtimeClientInstanceIdRef,
    traceAsyncDuration,
  };
}
