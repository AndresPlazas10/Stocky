import { useEffect, useRef } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { getSupabaseClient } from '../lib/supabase';

type TableSubscription = {
  table: string;
  filter?: string;
  onEvent: (payload: any) => void;
};

type BroadcastSubscription = {
  event: string;
  onPayload: (payload: any) => void;
};

type Options = {
  channelKey: string;
  businessId: string | undefined | null;
  userId?: string;
  tables?: TableSubscription[];
  broadcastEvents?: BroadcastSubscription[];
  onSubscribed?: () => void;
  pollIntervalMs?: number;
  onPollTick?: () => void;
  onCleanup?: () => void;
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  schema?: string;
  pausePollingWhenHidden?: boolean;
};

export function useSupabaseRealtime({
  channelKey,
  businessId,
  userId,
  tables = [],
  broadcastEvents = [],
  onSubscribed,
  pollIntervalMs = 20000,
  onPollTick,
  onCleanup,
  event = '*',
  schema = 'public',
  pausePollingWhenHidden = true,
}: Options) {
  const onSubscribedRef = useRef(onSubscribed);
  const onPollTickRef = useRef(onPollTick);
  const onCleanupRef = useRef(onCleanup);
  const isFocused = useIsFocused();

  useEffect(() => {
    onSubscribedRef.current = onSubscribed;
    onPollTickRef.current = onPollTick;
    onCleanupRef.current = onCleanup;
  }, [onSubscribed, onPollTick, onCleanup]);

  useEffect(() => {
    const normalizedBusinessId = String(businessId || '').trim();
    if (!normalizedBusinessId) {
      onCleanupRef.current?.();
      return undefined;
    }

    let cancelled = false;
    let fallbackTimer: ReturnType<typeof setInterval> | null = null;
    let dbChannel: ReturnType<ReturnType<typeof getSupabaseClient>['channel']> | null = null;
    let broadcastChannel: ReturnType<ReturnType<typeof getSupabaseClient>['channel']> | null = null;
    let realtimeConnected = false;
    let backoffMs = 0;
    const BACKOFF_BASE_MS = 2000;
    const BACKOFF_MAX_MS = 30000;

    let client;
    try {
      client = getSupabaseClient();
    } catch {
      return undefined;
    }

    const hasPollHandler = pollIntervalMs > 0 && !!onPollTickRef.current;
    const canPollByFocus = !pausePollingWhenHidden || isFocused;

    function startPolling() {
      if (fallbackTimer || cancelled || !hasPollHandler || !canPollByFocus) return;
      const intervalMs = pollIntervalMs > 0 ? pollIntervalMs : Math.max(BACKOFF_BASE_MS, backoffMs);
      fallbackTimer = setInterval(() => {
        if (cancelled) return;
        onPollTickRef.current?.();
        if (pollIntervalMs <= 0) {
          backoffMs = Math.min(backoffMs * 2 || BACKOFF_BASE_MS, BACKOFF_MAX_MS);
        }
      }, intervalMs);
    }

    function stopPolling() {
      backoffMs = 0;
      if (fallbackTimer) {
        clearInterval(fallbackTimer);
        fallbackTimer = null;
      }
    }

    const channelId = userId
      ? `mobile-${channelKey}:${normalizedBusinessId}:${userId}`
      : `mobile-${channelKey}:${normalizedBusinessId}`;

    dbChannel = client.channel(channelId);

    for (const sub of tables) {
      const filterConfig = {
        event,
        schema,
        table: sub.table,
        ...(sub.filter ? { filter: sub.filter } : {}),
      };
      dbChannel = (dbChannel as any).on('postgres_changes', filterConfig, (payload: any) => {
        if (cancelled) return;
        sub.onEvent(payload);
      });
    }

    dbChannel?.subscribe((status) => {
      if (cancelled) return;

      if (status === 'SUBSCRIBED') {
        realtimeConnected = true;
        stopPolling();
        onSubscribedRef.current?.();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        realtimeConnected = false;
        startPolling();
      }
    });

    if (broadcastEvents.length > 0) {
      const broadcastChannelId = `private:mobile-${channelKey}-sync:${normalizedBusinessId}`;
      broadcastChannel = client.channel(broadcastChannelId);
      for (const be of broadcastEvents) {
        broadcastChannel = broadcastChannel.on(
          'broadcast',
          { event: be.event },
          ({ payload }: any) => {
            if (cancelled) return;
            be.onPayload(payload);
          },
        );
      }
      broadcastChannel.subscribe();
    }

    if (!realtimeConnected && hasPollHandler && canPollByFocus) {
      startPolling();
    }

    return () => {
      cancelled = true;
      stopPolling();
      if (dbChannel) void client.removeChannel(dbChannel);
      if (broadcastChannel) void client.removeChannel(broadcastChannel);
      onCleanupRef.current?.();
    };
  }, [
    broadcastEvents,
    businessId,
    channelKey,
    event,
    isFocused,
    pausePollingWhenHidden,
    pollIntervalMs,
    schema,
    tables,
    userId,
  ]);
}
