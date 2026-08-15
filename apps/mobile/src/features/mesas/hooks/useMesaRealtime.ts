import { useCallback, useEffect, useRef, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
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
  normalizeOrderReference,
} from '../../../services/mesaOrderService';
import {
  mergeMesaLocks,
  createMesaLocksRefresher,
  CALL_WINDOW_MS,
  MESAS_REMOTE_FALLBACK_POLL_MS,
} from '../utils/mesaHelpers';
import { isCallRequestedAtSuppressed as sharedIsCallRequestedAtSuppressed } from '@stocky/shared/mesa-utils';

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
  dismissedCallsRef?: React.MutableRefObject<Map<string, number>>;
  shouldIgnoreStaleOccupiedDuringEmptyRelease?: (
    mesaId: string,
    incomingStatus?: string | null,
    incomingSyncVersion?: number | null,
  ) => boolean;
  isPendingEmptyRelease?: (mesaId: string) => boolean;
}

export interface UseMesaRealtimeReturn {
  setActiveOrderId: (orderId: string | null) => void;
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
  if (__DEV__) console.warn(`[mesa-sync] ${label}`, safeData);
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
  dismissedCallsRef,
  shouldIgnoreStaleOccupiedDuringEmptyRelease,
  isPendingEmptyRelease,
}: UseMesaRealtimeParams): UseMesaRealtimeReturn {
  const mesasRealtimeRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mesaLocksRealtimeRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const orderRealtimeSummaryTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const mesasSyncBroadcastChannelRef = useRef<any>(null);
  const mesasSyncBroadcastReadyRef = useRef(false);
  const realtimeClientInstanceIdRef = useRef(
    `mesa-client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  );
  const pendingUiTraceRef = useRef<RealtimeUiTrace | null>(null);
  const mesaLockPlaceholderTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const activeOrderIdRef = useRef<string | null>(null);
  const [activeOrderId, setActiveOrderIdState] = useState<string | null>(null);
  const isFocused = useIsFocused();

  const businessId = String(_businessId || '').trim();

  const setActiveOrderId = useCallback((orderId: string | null) => {
    const normalized = String(orderId || '').trim() || null;
    activeOrderIdRef.current = normalized;
    setActiveOrderIdState(normalized);
  }, []);

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
      setMesaLocksByTableId((prev) => mergeMesaLocks(prev, locks));
    },
    [],
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
    createMesaLocksRefresher(setMesaLocksByTableId, listActiveMesaEditLocks),
    [],
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
  // call_requested_at suppression (dismiss race)
  // -------------------------------------------------------------------

  const isCallRequestedAtSuppressed = useCallback(
    (mesaId: string, incomingRaw: string | null | undefined): boolean =>
      sharedIsCallRequestedAtSuppressed(
        dismissedCallsRef?.current,
        mesaId,
        incomingRaw,
        CALL_WINDOW_MS,
      ),
    [dismissedCallsRef],
  );

  const resolveSuppressedIncomingMesa = useCallback(
    (incomingMesa: MesaRecord): MesaRecord => {
      const raw = String(incomingMesa?.call_requested_at || '').trim();
      if (!raw) return incomingMesa;
      if (!isCallRequestedAtSuppressed(String(incomingMesa?.id || '').trim(), raw)) {
        return incomingMesa;
      }
      return { ...incomingMesa, call_requested_at: undefined };
    },
    [isCallRequestedAtSuppressed],
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
        const incomingById = new Map(incoming.map((mesa) => [String(mesa.id || ''), mesa]));
        const previousById = new Map(prev.map((mesa) => [String(mesa.id || ''), mesa]));

        const missingFromIncoming = prev.filter(
          (mesa) => !incomingById.has(String(mesa.id || '').trim()),
        );
        if (missingFromIncoming.length > 0) {
          traceMesaSync('refresh_rpc_missing_mesa', {
            businessId,
            prevCount: prev.length,
            incomingCount: incoming.length,
            missingIds: missingFromIncoming.map((m) => String(m?.id || '').trim()).filter(Boolean),
          });
        }

        const merged: MesaRecord[] = prev.map((mesa) => {
          const mesaId = String(mesa.id || '').trim();
          const incomingMesa = incomingById.get(mesaId);

          if (selectedMesaId && mesaId === selectedMesaId) {
            if (!incomingMesa) return previousById.get(selectedMesaId) || mesa;
            const previousSyncVersion = resolveMesaSyncVersion(
              previousById.get(selectedMesaId) || mesa,
            );
            const incomingSyncVersion = resolveMesaSyncVersion(incomingMesa);
            if (previousSyncVersion > incomingSyncVersion) {
              traceMesaSync('refresh_drop_stale_selected', {
                mesaId,
                previousSyncVersion,
                incomingSyncVersion,
              });
              return previousById.get(selectedMesaId) || mesa;
            }
            if (
              shouldIgnoreStaleOccupiedDuringEmptyRelease?.(
                mesaId,
                incomingMesa.status,
                incomingSyncVersion,
              )
            ) {
              traceMesaSync('refresh_drop_occupied_during_empty_release_selected', { mesaId });
              return previousById.get(selectedMesaId) || mesa;
            }
            return resolveSuppressedIncomingMesa(incomingMesa);
          }

          if (!incomingMesa) {
            return mesa;
          }

          const previousSyncVersion = resolveMesaSyncVersion(mesa);
          const incomingSyncVersion = resolveMesaSyncVersion(incomingMesa);
          if (previousSyncVersion > incomingSyncVersion) {
            traceMesaSync('refresh_drop_stale_row', {
              mesaId,
              previousSyncVersion,
              incomingSyncVersion,
            });
            return mesa;
          }

          if (
            shouldIgnoreStaleOccupiedDuringEmptyRelease?.(
              mesaId,
              incomingMesa.status,
              incomingSyncVersion,
            )
          ) {
            traceMesaSync('refresh_drop_occupied_during_empty_release', { mesaId });
            return mesa;
          }

          return resolveSuppressedIncomingMesa(incomingMesa);
        });

        for (const incomingMesa of incoming) {
          const incomingId = String(incomingMesa.id || '').trim();
          if (incomingId && !previousById.has(incomingId)) {
            merged.push(resolveSuppressedIncomingMesa(incomingMesa));
          }
        }

        return merged.sort(compareMesaTableIdentifiers);
      });
    } catch {
      // no-op
    }
  }, [
    businessId,
    isOrderFlowActive,
    isCallRequestedAtSuppressed,
    resolveSuppressedIncomingMesa,
    selectedMesaIdRef,
    setMesas,
    shouldIgnoreStaleOccupiedDuringEmptyRelease,
    traceAsyncDuration,
  ]);

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
            if (isPendingEmptyRelease?.(mesa.id)) return mesa;
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
          if (isPendingEmptyRelease?.(prev.id)) return prev;
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
    [isPendingEmptyRelease, setMesas, setSelectedMesa, traceAsyncDuration],
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
      }, 10);
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
      const hasNextTableName = Boolean(
        nextRow && Object.prototype.hasOwnProperty.call(nextRow, 'table_name'),
      );
      const hasNextSyncVersion = Boolean(
        nextRow && Object.prototype.hasOwnProperty.call(nextRow, 'sync_version'),
      );
      const nextSyncVersion = hasNextSyncVersion
        ? resolveMesaSyncVersion({ sync_version: nextRow?.sync_version } as Partial<MesaRecord>)
        : undefined;
      const hasNextCallRequestedAt = Boolean(
        nextRow && Object.prototype.hasOwnProperty.call(nextRow, 'call_requested_at'),
      );
      const incomingCallRequestedAt = hasNextCallRequestedAt
        ? nextRow?.call_requested_at
          ? new Date(String(nextRow.call_requested_at)).toISOString()
          : undefined
        : undefined;
      const callRequestedAtSuppressed =
        hasNextCallRequestedAt &&
        isCallRequestedAtSuppressed(mesaId, nextRow?.call_requested_at);
      const nextCallRequestedAt = callRequestedAtSuppressed
        ? undefined
        : incomingCallRequestedAt;

      setMesas((prev) => {
        const index = prev.findIndex((mesa) => String(mesa?.id || '').trim() === mesaId);

        if (eventType === 'DELETE') {
          if (index === -1) return prev;
          traceMesaSync('realtime_delete_mesa_from_state', {
            mesaId,
            prevCount: prev.length,
            nextCount: prev.length - 1,
          });
          const next = prev.filter((mesa) => String(mesa?.id || '').trim() !== mesaId);
          return next;
        }

        if (index === -1) {
          if (!nextRow) return prev;
          const insertedMesa: MesaRecord = {
            id: mesaId,
            business_id: String(nextRow?.business_id || '').trim(),
            table_number: hasNextTableNumber ? (nextRow?.table_number ?? null) : null,
            table_name: hasNextTableName ? (nextRow?.table_name ?? null) : null,
            status: String(nextStatus || 'available'),
            current_order_id: hasNextCurrentOrderId ? nextCurrentOrderId : null,
            sync_version: hasNextSyncVersion ? nextSyncVersion : undefined,
            call_requested_at: hasNextCallRequestedAt ? nextCallRequestedAt : undefined,
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
        if (
          shouldIgnoreStaleOccupiedDuringEmptyRelease?.(
            mesaId,
            resolvedStatus,
            hasNextSyncVersion ? nextSyncVersion : null,
          )
        ) {
          traceMesaSync('drop_occupied_during_empty_release', {
            mesaId,
            resolvedStatus,
            nextSyncVersion,
            eventType,
          });
          return prev;
        }

        const nextMesa: MesaRecord = {
          ...current,
          status: resolvedStatus,
          current_order_id: resolvedCurrentOrderId,
          table_number: hasNextTableNumber ? (nextRow?.table_number ?? null) : current.table_number,
          table_name: hasNextTableName ? (nextRow?.table_name ?? null) : current.table_name,
          sync_version: hasNextSyncVersion ? nextSyncVersion : current.sync_version,
          call_requested_at: hasNextCallRequestedAt ? nextCallRequestedAt : current.call_requested_at,
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
        if (
          shouldIgnoreStaleOccupiedDuringEmptyRelease?.(
            mesaId,
            resolvedStatus,
            hasNextSyncVersion ? nextSyncVersion : null,
          )
        ) {
          return prev;
        }
        return {
          ...prev,
          status: resolvedStatus,
          current_order_id: resolvedCurrentOrderId,
          table_number: hasNextTableNumber ? (nextRow?.table_number ?? null) : prev.table_number,
          table_name: hasNextTableName ? (nextRow?.table_name ?? null) : prev.table_name,
          sync_version: hasNextSyncVersion ? nextSyncVersion : prev.sync_version,
          call_requested_at: hasNextCallRequestedAt
            ? nextCallRequestedAt
            : prev.call_requested_at,
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
          const prevStatus = String(prevRow?.status || '')
            .trim()
            .toLowerCase();
          const statusChangedToOccupied = eventType === 'INSERT' || prevStatus !== 'occupied';
          if (statusChangedToOccupied) {
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
      isCallRequestedAtSuppressed,
      scheduleMesaLocksRefresh,
      selectedMesaIdRef,
      setMesas,
      setMesaLocksByTableId,
      setSelectedMesa,
      shouldIgnoreStaleOccupiedDuringEmptyRelease,
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
      const hasNextNotes = Boolean(
        nextRow && Object.prototype.hasOwnProperty.call(nextRow, 'notes'),
      );
      const nextNotes = hasNextNotes ? String(nextRow?.notes || '') : null;
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
              notes:
                nextNotes === null
                  ? mesa?.orders?.notes
                  : String(nextNotes).trim() !== ''
                    ? String(nextNotes).trim()
                    : undefined,
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
          table_name: payload?.table_name ?? null,
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
    let realtimeConnected = false;
    let backoffMs = 0;
    const BACKOFF_MAX_MS = 30000;

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

    function startFallbackPolling() {
      if (fallbackTimer || cancelled || !isFocused) return;
      const intervalMs = Math.max(MESAS_REMOTE_FALLBACK_POLL_MS, backoffMs);
      fallbackTimer = setInterval(() => {
        if (cancelled) return;
        scheduleRefresh();
        scheduleLocks();
        backoffMs = Math.min(backoffMs * 2 || MESAS_REMOTE_FALLBACK_POLL_MS, BACKOFF_MAX_MS);
      }, intervalMs);
    }

    function stopFallbackPolling() {
      backoffMs = 0;
      if (fallbackTimer) {
        clearInterval(fallbackTimer);
        fallbackTimer = null;
      }
    }

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
        const broadcastSenderClientId = String(payload?.sender_client_id || '').trim();
        const isOwnBroadcast =
          broadcastSenderClientId &&
          broadcastSenderClientId === String(realtimeClientInstanceIdRef.current || '').trim();
        traceMesaSync('realtime_in', {
          source: 'mesa_broadcast',
          rowRef: String(payload?.mesa_id || '').trim() || 'unknown',
          syncMode: String(payload?.sync_mode || '').trim() || null,
          isOwnBroadcast,
          emittedLagMs: Number.isFinite(Number(payload?.emitted_at))
            ? Math.max(0, Date.now() - Number(payload.emitted_at))
            : null,
        });
        applyRealtimeMesaBroadcast(payload);
        if (!isOwnBroadcast) {
          scheduleRefresh();
        }
      });

    channel.subscribe((status: string) => {
      if (cancelled) return;
      if (status === 'SUBSCRIBED') {
        realtimeConnected = true;
        stopFallbackPolling();
        scheduleRefresh();
        scheduleLocks();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        realtimeConnected = false;
        startFallbackPolling();
      }
    });
    mesasSyncBroadcastReadyRef.current = false;
    syncChannel.subscribe((status: string) => {
      mesasSyncBroadcastReadyRef.current = status === 'SUBSCRIBED';
    });
    mesasSyncBroadcastChannelRef.current = syncChannel;

    if (!realtimeConnected && isFocused) {
      startFallbackPolling();
    }

    return () => {
      cancelled = true;
      stopFallbackPolling();
      if (mesasRealtimeRefreshTimerRef.current) {
        clearTimeout(mesasRealtimeRefreshTimerRef.current);
        mesasRealtimeRefreshTimerRef.current = null;
      }
      if (mesaLocksRealtimeRefreshTimerRef.current) {
        clearTimeout(mesaLocksRealtimeRefreshTimerRef.current);
        mesaLocksRealtimeRefreshTimerRef.current = null;
      }
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
      Object.values(mesaLockPlaceholderTimersRef.current).forEach((timer) => {
        clearTimeout(timer);
      });
      mesaLockPlaceholderTimersRef.current = {};
    };
  }, [
    applyRealtimeMesaLockBroadcast,
    applyRealtimeMesaBroadcast,
    applyRealtimeMesaLockEvent,
    applyRealtimeOrderEvent,
    applyRealtimeTableEvent,
    businessId,
    isFocused,
    markRealtimeIngress,
    scheduleOrderRealtimeSummaryHydration,
    scheduleMesaLocksRefresh,
    scheduleMesasRealtimeRefresh,
    setMesaLocksByTableId,
    userId,
  ]);

  // -------------------------------------------------------------------
  // Filtered order_items subscription (scoped to active order)
  // -------------------------------------------------------------------

  useEffect(() => {
    const orderId = activeOrderIdRef.current;
    if (!businessId || !orderId) return undefined;

    let cancelled = false;
    let client;
    try {
      client = getSupabaseClient();
    } catch {
      return undefined;
    }

    traceMesaSync('order_items_subscribe', { orderId });

    const orderChannel = client.channel(`mobile-order-items:${businessId}:${orderId}`).on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'order_items',
        filter: `order_id=eq.${orderId}`,
      },
      (payload: any) => {
        if (cancelled) return;
        markRealtimeIngress('order_items', payload);

        const newRow = payload?.new as Record<string, unknown> | undefined;
        const oldRow = payload?.old as Record<string, unknown> | undefined;
        const nextOrderId = normalizeOrderReference(newRow?.order_id);
        const previousOrderId = normalizeOrderReference(oldRow?.order_id);

        if (nextOrderId) {
          scheduleOrderRealtimeSummaryHydration(nextOrderId);
        }
        if (previousOrderId && previousOrderId !== nextOrderId) {
          scheduleOrderRealtimeSummaryHydration(previousOrderId);
        }
      },
    );

    orderChannel.subscribe();

    return () => {
      cancelled = true;
      traceMesaSync('order_items_unsubscribe', { orderId });
      void client.removeChannel(orderChannel);
    };
  }, [
    activeOrderId,
    businessId,
    markRealtimeIngress,
    scheduleOrderRealtimeSummaryHydration,
  ]);

  // -------------------------------------------------------------------
  // Return
  // -------------------------------------------------------------------

  return {
    setActiveOrderId,
    mesasSyncBroadcastReadyRef,
    mesasSyncBroadcastChannelRef,
    pendingUiTraceRef,
    realtimeClientInstanceIdRef,
    traceAsyncDuration,
  };
}
