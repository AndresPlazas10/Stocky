import { useCallback, useRef } from 'react';

type UseMesaActionBroadcastParams = {
  mesasSyncBroadcastChannelRef: React.MutableRefObject<unknown>;
  mesasSyncBroadcastReadyRef: React.MutableRefObject<boolean>;
};

export function useMesaActionBroadcast({
  mesasSyncBroadcastChannelRef,
  mesasSyncBroadcastReadyRef,
}: UseMesaActionBroadcastParams) {
  const mesaActionVersionRef = useRef<Record<string, number>>({});

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
    sendMesaSyncBroadcast,
  };
}
