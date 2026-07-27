import { useCallback, useRef } from 'react';

type UseMesaActionBroadcastParams = {
  mesasSyncBroadcastChannelRef: React.MutableRefObject<unknown>;
  mesasSyncBroadcastReadyRef: React.MutableRefObject<boolean>;
};

const PENDING_EMPTY_RELEASE_TTL_MS = 15_000;

export function useMesaActionBroadcast({
  mesasSyncBroadcastChannelRef,
  mesasSyncBroadcastReadyRef,
}: UseMesaActionBroadcastParams) {
  const mesaActionVersionRef = useRef<Record<string, number>>({});
  const pendingEmptyReleaseRef = useRef<
    Record<string, { syncVersion: number; startedAt: number }>
  >({});

  const bumpMesaActionVersion = useCallback((mesaId: string) => {
    const normalizedMesaId = String(mesaId || '').trim();
    if (!normalizedMesaId) return 0;
    const current = Number(mesaActionVersionRef.current[normalizedMesaId] || 0);
    const next = current + 1;
    mesaActionVersionRef.current[normalizedMesaId] = next;
    return next;
  }, []);

  const isMesaActionVersionCurrent = useCallback((mesaId: string, version: number) => {
    const normalizedMesaId = String(mesaId || '').trim();
    if (!normalizedMesaId) return false;
    return Number(mesaActionVersionRef.current[normalizedMesaId] || 0) === Number(version || 0);
  }, []);

  const beginPendingEmptyRelease = useCallback((mesaId: string, syncVersion: number) => {
    const normalizedMesaId = String(mesaId || '').trim();
    if (!normalizedMesaId) return;
    pendingEmptyReleaseRef.current[normalizedMesaId] = {
      syncVersion: Math.max(0, Math.floor(Number(syncVersion) || 0)),
      startedAt: Date.now(),
    };
  }, []);

  const endPendingEmptyRelease = useCallback((mesaId: string) => {
    const normalizedMesaId = String(mesaId || '').trim();
    if (!normalizedMesaId) return;
    delete pendingEmptyReleaseRef.current[normalizedMesaId];
  }, []);

  const isPendingEmptyRelease = useCallback((mesaId: string) => {
    const normalizedMesaId = String(mesaId || '').trim();
    if (!normalizedMesaId) return false;
    const pending = pendingEmptyReleaseRef.current[normalizedMesaId];
    if (!pending) return false;
    if (Date.now() - pending.startedAt > PENDING_EMPTY_RELEASE_TTL_MS) {
      delete pendingEmptyReleaseRef.current[normalizedMesaId];
      return false;
    }
    return true;
  }, []);

  const shouldIgnoreStaleOccupiedDuringEmptyRelease = useCallback(
    (mesaId: string, incomingStatus?: string | null, incomingSyncVersion?: number | null) => {
      const normalizedMesaId = String(mesaId || '').trim();
      if (!normalizedMesaId) return false;
      const pending = pendingEmptyReleaseRef.current[normalizedMesaId];
      if (!pending) return false;
      if (Date.now() - pending.startedAt > PENDING_EMPTY_RELEASE_TTL_MS) {
        delete pendingEmptyReleaseRef.current[normalizedMesaId];
        return false;
      }

      const normalizedStatus = String(incomingStatus || '')
        .trim()
        .toLowerCase();
      if (normalizedStatus === 'available') {
        delete pendingEmptyReleaseRef.current[normalizedMesaId];
        return false;
      }

      const hasIncomingSync =
        incomingSyncVersion !== null &&
        incomingSyncVersion !== undefined &&
        Number.isFinite(Number(incomingSyncVersion));
      if (hasIncomingSync && Number(incomingSyncVersion) > pending.syncVersion) {
        delete pendingEmptyReleaseRef.current[normalizedMesaId];
        return false;
      }

      return true;
    },
    [],
  );

  const sendMesaSyncBroadcast = useCallback(
    (event: string, payload: Record<string, unknown>) => {
      const channel = mesasSyncBroadcastChannelRef.current as Record<string, unknown> | null;
      if (!channel) return;

      const message = {
        type: 'broadcast',
        event,
        payload,
      } as const;

      const canHttpSend = typeof channel?.httpSend === 'function';
      const isReady = mesasSyncBroadcastReadyRef.current === true;

      if (!isReady && canHttpSend) {
        void (channel.httpSend as (msg: unknown) => void)(message);
        return;
      }

      const sendResult = (channel.send as (msg: unknown) => unknown | Promise<unknown>)(message);
      if (sendResult && typeof (sendResult as Promise<unknown>).then === 'function') {
        void (sendResult as Promise<unknown>).catch(() => {
          if (canHttpSend) {
            return (channel.httpSend as (msg: unknown) => void)(message);
          }
          return undefined;
        });
      }
    },
    [mesasSyncBroadcastChannelRef, mesasSyncBroadcastReadyRef],
  );

  return {
    bumpMesaActionVersion,
    isMesaActionVersionCurrent,
    beginPendingEmptyRelease,
    endPendingEmptyRelease,
    isPendingEmptyRelease,
    shouldIgnoreStaleOccupiedDuringEmptyRelease,
    sendMesaSyncBroadcast,
  };
}
