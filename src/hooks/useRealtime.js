import { useEffect, useCallback, useMemo } from 'react';
import { readAdapter } from '../data/adapters/localAdapter.js';
import { logger } from '../utils/logger.js';

const MAX_SUBSCRIPTION_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 800;

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
    filter = {},
    enabled = true,
    retryOnError = true
  } = options;

  const handleInsert = useCallback((payload) => {
    if (onInsert) onInsert(payload.new);
  }, [onInsert]);

  const handleUpdate = useCallback((payload) => {
    if (onUpdate) onUpdate(payload.new, payload.old);
  }, [onUpdate]);

  const handleDelete = useCallback((payload) => {
    if (onDelete && payload.old) onDelete(payload.old);
  }, [onDelete]);

  const filterKey = useMemo(() => JSON.stringify(filter || {}), [filter]);

  useEffect(() => {
    if (!enabled || !table) return;

    let parsedFilter = {};
    try {
      parsedFilter = JSON.parse(filterKey || '{}') || {};
    } catch {
      parsedFilter = {};
    }

    const businessId = toChannelSegment(parsedFilter?.business_id, 'global');
    const channelBase = `realtime:${table}:${businessId}`;
    const filterString = buildRealtimeFilterString(parsedFilter);

    let disposed = false;
    let activeChannel = null;
    let retryTimer = null;
    let retryAttempts = 0;

    const clearRetryTimer = () => {
      if (!retryTimer) return;
      clearTimeout(retryTimer);
      retryTimer = null;
    };

    const removeActiveChannel = () => {
      if (!activeChannel) return;
      readAdapter.removeRealtimeChannel(activeChannel);
      activeChannel = null;
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
          if (payload.eventType === 'DELETE' && !payload.old) {
            return;
          }

          switch (payload.eventType) {
            case 'INSERT':
              handleInsert(payload);
              break;
            case 'UPDATE':
              handleUpdate(payload);
              break;
            case 'DELETE':
              handleDelete(payload);
              break;
          }
        },
        onStatusChange: (status, error, channel) => {
          if (disposed || channel !== activeChannel) return;
          if (status === 'SUBSCRIBED') {
            retryAttempts = 0;
            return;
          }

          if (!retryOnError) return;
          if (status !== 'CHANNEL_ERROR' && status !== 'TIMED_OUT') return;
          if (retryAttempts >= MAX_SUBSCRIPTION_RETRIES) {
            logger.warn('[realtime] max retries reached', {
              table,
              channelName,
              status,
              error: error?.message || String(error || '')
            });
            return;
          }

          retryAttempts += 1;
          const delayMs = RETRY_BASE_DELAY_MS * retryAttempts;
          logger.warn('[realtime] channel retry scheduled', {
            table,
            channelName,
            status,
            retryAttempts,
            delayMs
          });
          removeActiveChannel();
          clearRetryTimer();
          retryTimer = setTimeout(() => {
            retryTimer = null;
            subscribe();
          }, delayMs);
        }
      });
    };

    subscribe();

    return () => {
      disposed = true;
      clearRetryTimer();
      removeActiveChannel();
    };
  }, [table, enabled, filterKey, handleInsert, handleUpdate, handleDelete, retryOnError]);
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
