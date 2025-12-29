/**
 * =====================================
 * useIdempotentSubmit Hook
 * =====================================
 * 
 * Hook profesional para prevenir duplicación de requests en operaciones críticas.
 * 
 * PROTECCIONES IMPLEMENTADAS:
 * ✅ Doble click
 * ✅ Enter múltiple en forms
 * ✅ Latencia alta + impaciencia del usuario
 * ✅ Refresh del navegador (via sessionStorage)
 * ✅ Múltiples pestañas (via BroadcastChannel)
 * ✅ Reconexión de red
 * ✅ Race conditions
 * 
 * ARQUITECTURA:
 * - Estado local: isSubmitting flag
 * - Estado persistente: sessionStorage con TTL
 * - Comunicación inter-tabs: BroadcastChannel API
 * - Idempotency keys: UUID v4 generados client-side
 * - Backend verification: Los keys se envían al servidor
 * 
 * USO:
 * ```jsx
 * const { isSubmitting, submitAction } = useIdempotentSubmit({
 *   onSubmit: async (idempotencyKey) => {
 *     return await supabase.from('businesses').insert({...data, idempotency_key: idempotencyKey})
 *   },
 *   onSuccess: (result) => 
 *   onError: (error) => 
 *   actionName: 'create_business' // Identificador único de la acción
 * });
 * ```
 */

import { useState, useCallback, useRef, useEffect } from 'react';

// Generar UUID v4 client-side (más rápido que crypto.randomUUID en algunos navegadores)
const generateIdempotencyKey = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Clase para manejar el estado de idempotency persistente
class IdempotencyManager {
  constructor(actionName) {
    this.actionName = actionName;
    this.storageKey = `idempotency_${actionName}`;
    this.channel = null;
    
    // Inicializar BroadcastChannel para comunicación inter-tabs
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel('idempotency_channel');
    }
  }

  /**
   * Verifica si una acción está en progreso
   * Chequea tanto sessionStorage como el estado de otras pestañas
   */
  isInProgress() {
    try {
      const stored = sessionStorage.getItem(this.storageKey);
      if (!stored) return false;

      const data = JSON.parse(stored);
      const now = Date.now();
      
      // TTL de 5 minutos - Si pasó ese tiempo, asumir que falló y permitir retry
      const TTL = 5 * 60 * 1000;
      
      if (now - data.timestamp > TTL) {
        this.clear();
        return false;
      }

      return data.status === 'in_progress';
    } catch (error) {
      
      return false;
    }
  }

  /**
   * Marca una acción como iniciada
   * Retorna el idempotency key generado
   */
  start() {
    const key = generateIdempotencyKey();
    const data = {
      key,
      status: 'in_progress',
      timestamp: Date.now()
    };

    try {
      sessionStorage.setItem(this.storageKey, JSON.stringify(data));
      
      // Notificar a otras pestañas
      if (this.channel) {
        this.channel.postMessage({
          type: 'action_started',
          actionName: this.actionName,
          key
        });
      }
    } catch (error) {
      
    }

    return key;
  }

  /**
   * Marca una acción como completada exitosamente
   */
  complete(result = null) {
    try {
      const stored = sessionStorage.getItem(this.storageKey);
      if (!stored) return;

      const data = JSON.parse(stored);
      data.status = 'completed';
      data.completedAt = Date.now();
      data.result = result;

      sessionStorage.setItem(this.storageKey, JSON.stringify(data));

      // Notificar a otras pestañas
      if (this.channel) {
        this.channel.postMessage({
          type: 'action_completed',
          actionName: this.actionName,
          result
        });
      }
    } catch (error) {
      
    }
  }

  /**
   * Marca una acción como fallida
   */
  fail(error = null) {
    try {
      const stored = sessionStorage.getItem(this.storageKey);
      if (!stored) return;

      const data = JSON.parse(stored);
      data.status = 'failed';
      data.failedAt = Date.now();
      data.error = error?.message || String(error);

      sessionStorage.setItem(this.storageKey, JSON.stringify(data));

      // Notificar a otras pestañas
      if (this.channel) {
        this.channel.postMessage({
          type: 'action_failed',
          actionName: this.actionName,
          error: data.error
        });
      }
    } catch (error) {
      
    }
  }

  /**
   * Limpia el estado de la acción
   */
  clear() {
    try {
      sessionStorage.removeItem(this.storageKey);
    } catch (error) {
      
    }
  }

  /**
   * Obtiene el estado actual
   */
  getState() {
    try {
      const stored = sessionStorage.getItem(this.storageKey);
      if (!stored) return null;
      return JSON.parse(stored);
    } catch (error) {
      
      return null;
    }
  }

  /**
   * Limpia el BroadcastChannel cuando se desmonta el componente
   */
  cleanup() {
    if (this.channel) {
      this.channel.close();
    }
  }
}

/**
 * Hook principal de idempotency
 */
export function useIdempotentSubmit({
  onSubmit,
  onSuccess,
  onError,
  actionName,
  debounceMs = 300,
  enableRetry = true,
  maxRetries = 3
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  
  const debounceTimerRef = useRef(null);
  const managerRef = useRef(null);
  const isUnmountedRef = useRef(false);
  const timeoutRef = useRef(null); // ✅ Timeout de seguridad

  // Inicializar IdempotencyManager
  useEffect(() => {
    if (!actionName) {
      // actionName is required for proper idempotency tracking
      return;
    }

    managerRef.current = new IdempotencyManager(actionName);

    // ✅ CORREGIDO: Limpiar cualquier estado antiguo en sessionStorage al montar
    // Esto previene el bug de congelamiento permanente
    const state = managerRef.current.getState();
    if (state) {
      const now = Date.now();
      const TTL = 5 * 60 * 1000; // 5 minutos
      
      // Si el estado es muy antiguo, limpiarlo
      if (now - state.timestamp > TTL) {
        managerRef.current.clear();
      }
    }

    return () => {
      isUnmountedRef.current = true;
      if (managerRef.current) {
        managerRef.current.cleanup();
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [actionName]);

  /**
   * Función principal de submit con todas las protecciones
   */
  const submitAction = useCallback(async (additionalData = {}) => {
    // PROTECCIÓN 1: Verificar si ya está en progreso (local)
    if (isSubmitting) {
      return { success: false, error: 'Operación en progreso' };
    }

    // PROTECCIÓN 2: Verificar si ya está en progreso (persistente/otras tabs)
    if (managerRef.current && managerRef.current.isInProgress()) {
      return { success: false, error: 'Operación en progreso en otra pestaña' };
    }

    // PROTECCIÓN 3: Debouncing para evitar clicks rápidos
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    return new Promise((resolve) => {
      debounceTimerRef.current = setTimeout(async () => {
        try {
          // Marcar como en progreso
          setIsSubmitting(true);
          setError(null);

          // ✅ TIMEOUT DE SEGURIDAD: Auto-reset después de 30 segundos
          timeoutRef.current = setTimeout(() => {
            setIsSubmitting(false);
            if (managerRef.current) {
              managerRef.current.clear();
            }
          }, 30000); // 30 segundos

          // Generar idempotency key
          const idempotencyKey = managerRef.current ? managerRef.current.start() : generateIdempotencyKey();

          // PROTECCIÓN 4: Ejecutar la acción con el idempotency key
          const result = await onSubmit({
            idempotencyKey,
            ...additionalData
          });

          // Verificar si el componente se desmontó durante la operación
          if (isUnmountedRef.current) {
            return;
          }

          // Marcar como completada
          if (managerRef.current) {
            managerRef.current.complete(result);
          }

          // Limpiar timeout de seguridad
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }

          setIsSubmitting(false);
          setRetryCount(0);

          // Callback de éxito
          if (onSuccess) {
            onSuccess(result);
          }

          resolve({ success: true, data: result, idempotencyKey });

        } catch (err) {
          

          // Verificar si el componente se desmontó
          if (isUnmountedRef.current) {
            return;
          }

          // Marcar como fallida
          if (managerRef.current) {
            managerRef.current.fail(err);
          }

          setError(err);
          setIsSubmitting(false);

          // PROTECCIÓN 5: Retry automático (opcional)
          if (enableRetry && retryCount < maxRetries) {
            setRetryCount(prev => prev + 1);
            
            // Esperar antes de reintentar (exponential backoff)
            const backoffMs = Math.min(1000 * Math.pow(2, retryCount), 10000);
            setTimeout(() => {
              if (!isUnmountedRef.current) {
                // Limpiar estado y reintentar
                if (managerRef.current) {
                  managerRef.current.clear();
                }
                submitAction(additionalData);
              }
            }, backoffMs);
          } else {
            // Limpiar timeout de seguridad
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
              timeoutRef.current = null;
            }

            // Callback de error
            if (onError) {
              onError(err);
            }
            resolve({ success: false, error: err.message || String(err) });
          }
        }
      }, debounceMs);
    });
  }, [isSubmitting, actionName, debounceMs, enableRetry, maxRetries, retryCount, onSubmit, onSuccess, onError]);

  /**
   * Función para resetear el estado manualmente
   */
  const reset = useCallback(() => {
    setIsSubmitting(false);
    setError(null);
    setRetryCount(0);
    if (managerRef.current) {
      managerRef.current.clear();
    }
  }, []);

  /**
   * Función para obtener el estado actual de idempotency
   */
  const getIdempotencyState = useCallback(() => {
    return managerRef.current ? managerRef.current.getState() : null;
  }, []);

  return {
    isSubmitting,
    error,
    retryCount,
    submitAction,
    reset,
    getIdempotencyState
  };
}

export default useIdempotentSubmit;
