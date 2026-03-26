import { useEffect, useMemo, useRef } from 'react';
import { readAdapter } from '../data/adapters/localAdapter.js';
import { logger } from '../utils/logger.js';

const RETRY_BASE_DELAY_MS = 800;
const RETRY_MAX_DELAY_MS = 15000;
const RETRYABLE_STATUSES = new Set(['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED']);

function toChannelSegment(value, fallback = 'global') {
  const raw = String(value ?? '').trim();
  if (!raw) return fallback;
  return raw.replace(/[^a-zA-Z0-9:_-]/g, '_').slice(0, 96) || fallback;
}

function isFilterValuePresent(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim() !== '';
  return true;
}

function encodeRealtimeFilterValue(value) {
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return encodeURIComponent(String(value).trim());
}

function buildRealtimeFilterString(filter = {}) {
  return Object.entries(filter || {})
    .filter(([, value]) => isFilterValuePresent(value))
    .map(([key, value]) => `${key}=eq.${encodeRealtimeFilterValue(value)}`)
    .join(',');
}

/**
 * Hook optimizado para suscribirse a cambios en tiempo real de Supabase
 * Versión optimizada para producción sin logs innecesarios
 * 
 * @param {string} table - Nombre de la tabla
 * @param {object} options - Configuración de la suscripción
 * @param {function} options.onInsert - Callback para nuevos registros
 * @param {function} options.onUpdate - Callback para actualizaciones
 * @param {function} options.onDelete - Callback para eliminaciones
 * @param {object} options.filter - Filtros (ej: { business_id: 'xxx' })
 * @param {boolean} options.enabled - Activar/desactivar suscripción
 */
export function useRealtimeSubscription(table, options = {}) {
  const {
    onInsert,
    onUpdate,
    onDelete,
    onReconnect,
    onPoll,
    filter = {},
    enabled = true,
    retryOnError = true,
    requireBusinessId = true,
    debounceMs = 0,
    pollingIntervalMs = 0,
    pollingMode = 'onError'
  } = options;

  const handlersRef = useRef({ onInsert, onUpdate, onDelete });
  const pollRef = useRef(onPoll);
  const filterKey = useMemo(() => JSON.stringify(filter || {}), [filter]);

  useEffect(() => {
    handlersRef.current = { onInsert, onUpdate, onDelete };
  }, [onInsert, onUpdate, onDelete]);

  useEffect(() => {
    pollRef.current = onPoll;
  }, [onPoll]);

  useEffect(() => {
    if (!enabled || !table) return;

    let parsedFilter = {};
    try {
      parsedFilter = JSON.parse(filterKey || '{}') || {};
    } catch {
      parsedFilter = {};
    }

    const hasBusinessId = isFilterValuePresent(parsedFilter?.business_id);
    if (requireBusinessId && !hasBusinessId) {
      logger.error('[realtime] missing business_id filter, subscription blocked', {
        table
      });
      return;
    }

    const businessId = toChannelSegment(parsedFilter?.business_id, 'global');
    const channelBase = `realtime:${table}:${businessId}`;
    const filterString = buildRealtimeFilterString(parsedFilter);

    let disposed = false;
    let activeChannel = null;
    let retryTimer = null;
    let retryAttempts = 0;
    let flushTimer = null;
    let pollingTimer = null;
    let pollingActive = pollingMode === 'always';
    const pendingPayloads = [];

    const shouldLogRetry = (attempt) => (
      attempt === 1
      || attempt === 3
      || attempt === 5
      || attempt % 10 === 0
    );

    const clearRetryTimer = () => {
      if (!retryTimer) return;
      clearTimeout(retryTimer);
      retryTimer = null;
    };

    const clearFlushTimer = () => {
      if (!flushTimer) return;
      clearTimeout(flushTimer);
      flushTimer = null;
    };

    const stopPolling = () => {
      if (!pollingTimer) return;
      clearInterval(pollingTimer);
      pollingTimer = null;
      pollingActive = false;
    };

    const startPolling = () => {
      if (!pollingIntervalMs || pollingTimer || typeof pollRef.current !== 'function') return;
      pollingTimer = setInterval(() => {
        const handler = pollRef.current;
        if (typeof handler === 'function') {
          handler();
        }
      }, pollingIntervalMs);
      pollingActive = true;
    };

    const removeActiveChannel = () => {
      if (!activeChannel) return;
      readAdapter.removeRealtimeChannel(activeChannel);
      activeChannel = null;
    };

    const scheduleRetry = ({ status, channelName, error }) => {
      retryAttempts += 1;
      const delayMs = Math.min(RETRY_MAX_DELAY_MS, RETRY_BASE_DELAY_MS * (2 ** (retryAttempts - 1)));

      if (shouldLogRetry(retryAttempts)) {
        logger.warn('[realtime] channel retry scheduled', {
          table,
          channelName,
          status,
          retryAttempts,
          delayMs,
          error: error?.message || String(error || '')
        });
      }

      removeActiveChannel();
      clearRetryTimer();
      retryTimer = setTimeout(() => {
        retryTimer = null;
        subscribe();
      }, delayMs);
    };

    const handlePayload = (payload) => {
      const handlers = handlersRef.current || {};

      switch (payload.eventType) {
        case 'INSERT':
          if (handlers.onInsert) handlers.onInsert(payload.new);
          break;
        case 'UPDATE':
          if (handlers.onUpdate) handlers.onUpdate(payload.new, payload.old);
          break;
        case 'DELETE': {
          const deletedRow = payload.old || payload.new || null;
          if (handlers.onDelete && deletedRow) handlers.onDelete(deletedRow);
          break;
        }
      }
    };

    const flushPayloads = () => {
      clearFlushTimer();
      if (pendingPayloads.length === 0) return;
      const batch = pendingPayloads.splice(0, pendingPayloads.length);
      batch.forEach(handlePayload);
    };

    const enqueuePayload = (payload) => {
      if (!debounceMs || debounceMs <= 0) {
        handlePayload(payload);
        return;
      }

      pendingPayloads.push(payload);
      if (!flushTimer) {
        flushTimer = setTimeout(flushPayloads, debounceMs);
      }
    };

    const subscribe = () => {
      if (disposed) return;

      const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const channelName = `${channelBase}:${nonce}`;

      activeChannel = readAdapter.subscribeToPostgresChanges({
        channelName,
        table,
        filter: filterString || undefined,
        callback: (payload) => {
          enqueuePayload(payload);
        },
        onStatusChange: (status, error, channel) => {
          if (disposed || channel !== activeChannel) return;
          if (status === 'SUBSCRIBED') {
            if (retryAttempts > 0) {
              logger.warn('[realtime] channel recovered', {
                table,
                channelName,
                retryAttempts
              });
              if (typeof onReconnect === 'function') {
                onReconnect();
              }
            }
            retryAttempts = 0;
            if (pollingMode === 'onError' && pollingActive) {
              stopPolling();
            }
            return;
          }

          if (!retryOnError) return;
          if (!RETRYABLE_STATUSES.has(status)) return;
          if (pollingMode === 'onError' && !pollingActive) {
            startPolling();
          }
          scheduleRetry({ status, channelName, error });
        }
      });
    };

    if (pollingMode === 'always') {
      startPolling();
    }

    subscribe();

    return () => {
      disposed = true;
      clearRetryTimer();
      clearFlushTimer();
      stopPolling();
      removeActiveChannel();
    };
  }, [table, enabled, filterKey, retryOnError, onReconnect, requireBusinessId, debounceMs, pollingIntervalMs, pollingMode]);
}

/**
 * Hook para suscribirse a múltiples tablas simultáneamente
 * Optimizado para reducir overhead de múltiples canales
 */
export function useRealtimeSubscriptions(subscriptions = [], enabled = true) {
  useEffect(() => {
    if (!enabled || subscriptions.length === 0) return;

    const channels = [];

    subscriptions.forEach((sub, index) => {
      const { table, filter = {}, onInsert, onUpdate, onDelete } = sub;
      
      const channelName = `realtime:${table}:${index}:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const filterString = buildRealtimeFilterString(filter);

      const channel = readAdapter.subscribeToPostgresChanges({
        channelName,
        table,
        filter: filterString || undefined,
        callback: (payload) => {
          switch (payload.eventType) {
            case 'INSERT':
              if (onInsert) onInsert(payload.new);
              break;
            case 'UPDATE':
              if (onUpdate) onUpdate(payload.new, payload.old);
              break;
            case 'DELETE':
              if (onDelete) onDelete(payload.old);
              break;
          }
        }
      });
      channels.push(channel);
    });

    return () => {
      channels.forEach((channel) => readAdapter.removeRealtimeChannel(channel));
    };
  }, [subscriptions, enabled]);
}
