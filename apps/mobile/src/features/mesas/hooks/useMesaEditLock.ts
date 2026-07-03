import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  acquireMesaEditLock,
  listActiveMesaEditLocks,
  refreshMesaEditLockHeartbeat,
  releaseMesaEditLock,
  type MesaEditLock,
  type MesaRecord,
} from '../../../services/mesasService';

const MESA_IN_USE_MESSAGE = 'Alguien esta usando esta mesa.';

type HeldMesaLock = {
  businessId: string;
  tableId: string;
  lockToken: string | null;
};

export function useMesaEditLock({
  session,
  context,
  actorDisplayName,
  onError,
  isOrderFlowActive = false,
  onLockLost,
  onCloseAuxiliaryOrderModals,
  onHandleDismissOrderModal,
  sendBroadcast,
}: {
  session: Session;
  context: { businessId?: string | null } | null | undefined;
  actorDisplayName: string;
  onError: (msg: string) => void;
  isOrderFlowActive?: boolean;
  onLockLost?: () => void;
  onCloseAuxiliaryOrderModals?: () => void;
  onHandleDismissOrderModal?: () => void;
  sendBroadcast?: (event: string, payload: Record<string, unknown>) => void;
}) {
  const [mesaLocksByTableId, setMesaLocksByTableId] = useState<Record<string, MesaEditLock>>({});
  const [heldMesaLock, setHeldMesaLock] = useState<HeldMesaLock | null>(null);
  const heldMesaLockRef = useRef<HeldMesaLock | null>(null);
  const orderModalOpenIntentRef = useRef(false);
  const [clientInstanceId] = useState(
    () => `mesa-client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  );
  const clientInstanceIdRef = useRef(clientInstanceId);

  const applyMesaLocks = useCallback((locks: MesaEditLock[]) => {
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
  }, []);

  const refreshMesaLocks = useCallback(
    async (businessId: string) => {
      const normalizedBusinessId = String(businessId || '').trim();
      if (!normalizedBusinessId) {
        setMesaLocksByTableId({});
        return;
      }
      try {
        const locks = await listActiveMesaEditLocks(normalizedBusinessId);
        applyMesaLocks(locks);
      } catch {
        // no-op
      }
    },
    [applyMesaLocks],
  );

  const publishMesaLockBroadcast = useCallback(
    (input: {
      businessId: string;
      tableId: string;
      locked: boolean;
      mode?: 'optimistic' | 'confirmed' | 'rollback';
      lockToken?: string | null;
      lockExpiresAt?: string | null;
    }) => {
      const businessId = String(input.businessId || '').trim();
      const tableId = String(input.tableId || '').trim();
      if (!businessId || !tableId) return;

      const locked = Boolean(input.locked);
      const lockTtlMs = 45_000;
      const lockExpiresAt = locked
        ? String(input.lockExpiresAt || '').trim() || new Date(Date.now() + lockTtlMs).toISOString()
        : null;

      if (sendBroadcast) {
        sendBroadcast('mesa_lock_changed', {
          sender_user_id: session.user.id,
          sender_client_id: clientInstanceIdRef.current,
          mesa_id: tableId,
          business_id: businessId,
          locked,
          mode: input.mode || 'confirmed',
          lock_owner_user_id: locked ? session.user.id : null,
          lock_token: locked ? String(input.lockToken || '').trim() || null : null,
          lock_expires_at: lockExpiresAt,
          lock_ttl_ms: locked ? lockTtlMs : null,
          emitted_at: Date.now(),
        });
      }
    },
    [sendBroadcast, session.user.id],
  );

  const releaseHeldMesaLock = useCallback(
    async (lockSnapshot?: HeldMesaLock | null) => {
      const snapshot = lockSnapshot || heldMesaLockRef.current;
      if (!snapshot) return;
      if (!lockSnapshot) {
        heldMesaLockRef.current = null;
        setHeldMesaLock(null);
      } else {
        const current = heldMesaLockRef.current;
        if (
          current &&
          current.businessId === snapshot.businessId &&
          current.tableId === snapshot.tableId &&
          current.lockToken === snapshot.lockToken
        ) {
          heldMesaLockRef.current = null;
          setHeldMesaLock(null);
        }
      }

      publishMesaLockBroadcast({
        businessId: snapshot.businessId,
        tableId: snapshot.tableId,
        locked: false,
        mode: 'optimistic',
      });

      let releaseFailed = false;
      try {
        await releaseMesaEditLock({
          businessId: snapshot.businessId,
          tableId: snapshot.tableId,
          userId: session.user.id,
          lockToken: snapshot.lockToken,
        });
      } catch {
        releaseFailed = true;
      } finally {
        setMesaLocksByTableId((prev) => {
          const current = prev[snapshot.tableId];
          if (!current) return prev;
          if (String(current.lock_owner_user_id || '') !== String(session.user.id || ''))
            return prev;
          const next = { ...prev };
          delete next[snapshot.tableId];
          return next;
        });
        publishMesaLockBroadcast({
          businessId: snapshot.businessId,
          tableId: snapshot.tableId,
          locked: releaseFailed,
          mode: releaseFailed ? 'rollback' : 'confirmed',
          lockToken: snapshot.lockToken,
        });
        void refreshMesaLocks(snapshot.businessId);
      }
    },
    [publishMesaLockBroadcast, refreshMesaLocks, session.user.id],
  );

  const acquireMesaLockForEdition = useCallback(
    async (mesa: MesaRecord): Promise<boolean> => {
      try {
        if (!context?.businessId) return true;
        const tableId = String(mesa?.id || '').trim();
        if (!tableId) return false;

        const held = heldMesaLockRef.current;
        if (held && (held.tableId !== tableId || held.businessId !== context.businessId)) {
          void releaseHeldMesaLock(held);
        }

        publishMesaLockBroadcast({
          businessId: context.businessId,
          tableId,
          locked: true,
          mode: 'optimistic',
        });

        const result = await acquireMesaEditLock({
          businessId: context.businessId,
          tableId,
          userId: session.user.id,
          userName: actorDisplayName,
          ttlSeconds: 45,
        });

        if (result.unsupported) {
          publishMesaLockBroadcast({
            businessId: context.businessId,
            tableId,
            locked: false,
            mode: 'rollback',
          });
          return true;
        }

        if (!result.ok) {
          publishMesaLockBroadcast({
            businessId: context.businessId,
            tableId,
            locked: false,
            mode: 'rollback',
          });
          onError(MESA_IN_USE_MESSAGE);
          if (result.lock) {
            setMesaLocksByTableId((prev) => ({
              ...prev,
              [tableId]: result.lock as MesaEditLock,
            }));
          }
          void refreshMesaLocks(context.businessId);
          return false;
        }

        if (result.lock) {
          setMesaLocksByTableId((prev) => ({
            ...prev,
            [tableId]: result.lock as MesaEditLock,
          }));
        }
        const nextHeldLock = {
          businessId: context.businessId,
          tableId,
          lockToken: result.lockToken || null,
        };
        heldMesaLockRef.current = nextHeldLock;
        setHeldMesaLock(nextHeldLock);
        publishMesaLockBroadcast({
          businessId: context.businessId,
          tableId,
          locked: true,
          mode: 'confirmed',
          lockToken: result.lockToken || null,
          lockExpiresAt: result.lock?.lock_expires_at || null,
        });
        return true;
      } catch {
        return false;
      }
    },
    [
      actorDisplayName,
      context,
      publishMesaLockBroadcast,
      refreshMesaLocks,
      releaseHeldMesaLock,
      session.user.id,
      onError,
    ],
  );

  const closeAuxiliaryOrderModals = useCallback(() => {
    if (onCloseAuxiliaryOrderModals) {
      onCloseAuxiliaryOrderModals();
    }
  }, [onCloseAuxiliaryOrderModals]);

  const closeOrderModal = useCallback(() => {
    const held = heldMesaLockRef.current;
    if (held) {
      void releaseHeldMesaLock(held);
    }
    orderModalOpenIntentRef.current = false;
    closeAuxiliaryOrderModals();
    if (onLockLost) {
      onLockLost();
    }
  }, [closeAuxiliaryOrderModals, onLockLost, releaseHeldMesaLock]);

  const handleDismissOrderModal = useCallback(() => {
    if (onHandleDismissOrderModal) {
      onHandleDismissOrderModal();
    } else {
      closeOrderModal();
    }
  }, [closeOrderModal, onHandleDismissOrderModal]);

  useEffect(() => {
    const held = heldMesaLockRef.current;
    const activeBusinessId = String(context?.businessId || '').trim();
    if (!held) return;
    if (!activeBusinessId || held.businessId !== activeBusinessId) {
      void releaseHeldMesaLock(held);
    }
  }, [context?.businessId, releaseHeldMesaLock]);

  useEffect(
    () => () => {
      void releaseHeldMesaLock();
    },
    [releaseHeldMesaLock],
  );

  useEffect(() => {
    if (!isOrderFlowActive) return undefined;
    const held = heldMesaLockRef.current;
    if (!held) return undefined;

    let cancelled = false;
    const timer = setInterval(() => {
      const current = heldMesaLockRef.current;
      if (!current || current.tableId !== held.tableId || current.businessId !== held.businessId)
        return;

      void refreshMesaEditLockHeartbeat({
        businessId: current.businessId,
        tableId: current.tableId,
        userId: session.user.id,
        userName: actorDisplayName,
        lockToken: current.lockToken,
        ttlSeconds: 45,
      })
        .then((result) => {
          if (cancelled) return;
          if (result.unsupported) return;
          if (result.ok) {
            if (result.lock) {
              setMesaLocksByTableId((prev) => {
                const prevLock = prev[current.tableId];
                if (prevLock && prevLock.lock_expires_at === result.lock?.lock_expires_at)
                  return prev;
                return { ...prev, [current.tableId]: result.lock as MesaEditLock };
              });
            }
            return;
          }

          if (result.lost) {
            onError(MESA_IN_USE_MESSAGE);
            void releaseHeldMesaLock(current);
            if (onLockLost) {
              onLockLost();
            }
            void refreshMesaLocks(current.businessId);
          }
        })
        .catch(() => {
          // no-op
        });
    }, 9000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [
    actorDisplayName,
    isOrderFlowActive,
    onError,
    onLockLost,
    refreshMesaLocks,
    releaseHeldMesaLock,
    session.user.id,
  ]);

  return {
    mesaLocksByTableId,
    setMesaLocksByTableId,
    heldMesaLock,
    heldMesaLockRef,
    closeOrderModal,
    handleDismissOrderModal,
    closeAuxiliaryOrderModals,
    publishMesaLockBroadcast,
    acquireMesaLockForEdition,
    releaseHeldMesaLock,
    refreshMesaLocks,
  };
}
