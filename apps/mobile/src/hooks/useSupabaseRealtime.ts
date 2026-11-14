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

const EMPTY_TABLES: TableSubscription[] = [];
const EMPTY_BROADCAST_EVENTS: BroadcastSubscription[] = [];

export function useSupabaseRealtime({
  channelKey,
  businessId,
  userId,
  tables = EMPTY_TABLES,
  broadcastEvents = EMPTY_BROADCAST_EVENTS,
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
  const tablesRef = useRef(tables);
  const broadcastEventsRef = useRef(broadcastEvents);
  const isFocused = useIsFocused();
  const isFocusedRef = useRef(isFocused);
  const pausePollingWhenHiddenRef = useRef(pausePollingWhenHidden);
  const pollIntervalMsRef = useRef(pollIntervalMs);
  const syncPollingRef = useRef<(() => void) | null>(null);

  tablesRef.current = tables;
  broadcastEventsRef.current = broadcastEvents;
  isFocusedRef.current = isFocused;
  pausePollingWhenHiddenRef.current = pausePollingWhenHidden;
  pollIntervalMsRef.current = pollIntervalMs;

  const tablesKey = tables
    .map((sub, idx) => `${idx}:${sub.table}:${sub.filter || ''}`)
    .join('|');
  const broadcastKey = broadcastEvents
    .map((be, idx) => `${idx}:${be.event}`)
    .join('|');

  useEffect(() => {
    onSubscribedRef.current = onSubscribed;
    onPollTickRef.current = onPollTick;
    onCleanupRef.current = onCleanup;
  }, [onSubscribed, onPollTick, onCleanup]);

  useEffect(() => {
    syncPollingRef.current?.();
  }, [isFocused, pausePollingWhenHidden, pollIntervalMs]);

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

    function canPollNow() {
      const hasPollHandler = pollIntervalMsRef.current > 0 && !!onPollTickRef.current;
      const canPollByFocus = !pausePollingWhenHiddenRef.current || isFocusedRef.current;
      return hasPollHandler && canPollByFocus;
    }

    function startPolling() {
      if (fallbackTimer || cancelled || realtimeConnected || !canPollNow()) return;
      const currentPollInterval = pollIntervalMsRef.current;
      const intervalMs = currentPollInterval > 0 ? currentPollInterval : Math.max(BACKOFF_BASE_MS, backoffMs);
      fallbackTimer = setInterval(() => {
        if (cancelled) return;
        if (!canPollNow()) {
          stopPolling();
          return;
        }
        onPollTickRef.current?.();
        if (pollIntervalMsRef.current <= 0) {
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

    syncPollingRef.current = () => {
      if (cancelled || realtimeConnected) {
        stopPolling();
        return;
      }
      if (canPollNow()) {
        startPolling();
      } else {
        stopPolling();
      }
    };

    const channelId = userId
      ? `mobile-${channelKey}:${normalizedBusinessId}:${userId}`
      : `mobile-${channelKey}:${normalizedBusinessId}`;

    const currentTables = tablesRef.current;
    if (currentTables.length > 0) {
      dbChannel = client.channel(channelId);

      currentTables.forEach((sub, idx) => {
        const filterConfig = {
          event,
          schema,
          table: sub.table,
          ...(sub.filter ? { filter: sub.filter } : {}),
        };
        dbChannel = (dbChannel as any).on('postgres_changes', filterConfig, (payload: any) => {
          if (cancelled) return;
          tablesRef.current[idx]?.onEvent(payload);
        });
      });

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
    }

    const currentBroadcasts = broadcastEventsRef.current;
    if (currentBroadcasts.length > 0) {
      const broadcastChannelId = `private:mobile-${channelKey}-sync:${normalizedBusinessId}`;
      broadcastChannel = client.channel(broadcastChannelId);
      currentBroadcasts.forEach((be, idx) => {
        broadcastChannel = broadcastChannel!.on(
          'broadcast',
          { event: be.event },
          ({ payload }: any) => {
            if (cancelled) return;
            broadcastEventsRef.current[idx]?.onPayload(payload);
          },
        );
      });
      broadcastChannel.subscribe();
    }

    if (!realtimeConnected && canPollNow()) {
      startPolling();
    }

    return () => {
      cancelled = true;
      syncPollingRef.current = null;
      stopPolling();
      if (dbChannel) void client.removeChannel(dbChannel);
      if (broadcastChannel) void client.removeChannel(broadcastChannel);
      onCleanupRef.current?.();
    };
  }, [
    broadcastKey,
    businessId,
    channelKey,
    event,
    schema,
    tablesKey,
    userId,
  ]);
}
