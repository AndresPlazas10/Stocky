import { useEffect, useCallback, useMemo } from 'react';
import { readAdapter } from '../data/adapters/localAdapter.js';

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
    enabled = true
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

    const parsedFilter = JSON.parse(filterKey || '{}');
    const businessId = parsedFilter?.business_id || 'global';
    const channelName = `realtime:${table}:${businessId}`;

    // Construir filtro para Supabase
    const filterString = Object.keys(parsedFilter).length > 0
      ? Object.entries(parsedFilter).map(([key, value]) => `${key}=eq.${value}`).join(',')
      : undefined;

    const channel = readAdapter.subscribeToPostgresChanges({
      channelName,
      table,
      filter: filterString,
      callback: (payload) => {
        // Validación para DELETE sin datos
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
      }
    });

    return () => {
      readAdapter.removeRealtimeChannel(channel);
    };
  }, [table, enabled, filterKey, handleInsert, handleUpdate, handleDelete]);
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
      
      const channelName = `realtime:${table}:${index}:${Date.now()}`;

      let filterString = '';
      if (Object.keys(filter).length > 0) {
        filterString = Object.entries(filter)
          .map(([key, value]) => `${key}=eq.${value}`)
          .join(',');
      }

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
