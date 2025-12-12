import { useEffect, useCallback } from 'react';
import { supabase } from '../supabase/Client';

const IS_DEV = import.meta.env.DEV;

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

  useEffect(() => {
    if (!enabled || !table) return;

    const businessId = filter?.business_id || 'global';
    const channelName = `realtime:${table}:${businessId}`;
    const channel = supabase.channel(channelName);

    // Construir filtro para Supabase
    const filterString = Object.keys(filter).length > 0
      ? Object.entries(filter).map(([key, value]) => `${key}=eq.${value}`).join(',')
      : undefined;

    // Suscripción a cambios de Postgres
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table,
        filter: filterString
      },
      (payload) => {
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
    );

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, enabled, JSON.stringify(filter || {}), handleInsert, handleUpdate, handleDelete]);
}

/**
 * Hook para suscribirse a múltiples tablas simultáneamente
 * Optimizado para reducir overhead de múltiples canales
 */
export function useRealtimeSubscriptions(subscriptions = [], enabled = true) {
  useEffect(() => {
    if (!enabled || subscriptions.length === 0) return;

    const channels = [];

    subscriptions.forEach((sub) => {
      const { table, filter = {}, onInsert, onUpdate, onDelete } = sub;
      
      const channelName = `realtime:${table}:${index}:${Date.now()}`;
      const channel = supabase.channel(channelName);

      let filterString = '';
      if (Object.keys(filter).length > 0) {
        filterString = Object.entries(filter)
          .map(([key, value]) => `${key}=eq.${value}`)
          .join(',');
      }

      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: table,
          filter: filterString || undefined
        },
        (payload) => {
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
      );

      channel.subscribe();
      channels.push(channel);
    });

    return () => {
      channels.forEach(channel => supabase.removeChannel(channel));
    };
  }, [subscriptions, enabled]);
}
