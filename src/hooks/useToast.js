import { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * Hook para gestionar mensajes de toast/notificaciones
 * @returns {object} { message, showSuccess, showError, showWarning, showInfo, clear }
 */
export function useToast(duration = 4000) {
  const [message, setMessage] = useState({ type: null, text: '' });

  useEffect(() => {
    if (message.text) {
      const timer = setTimeout(() => {
        setMessage({ type: null, text: '' });
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [message, duration]);

  const showSuccess = useCallback((text) => {
    setMessage({ type: 'success', text });
  }, []);

  const showError = useCallback((text) => {
    setMessage({ type: 'error', text });
  }, []);

  const showWarning = useCallback((text) => {
    setMessage({ type: 'warning', text });
  }, []);

  const showInfo = useCallback((text) => {
    setMessage({ type: 'info', text });
  }, []);

  const clear = useCallback(() => {
    setMessage({ type: null, text: '' });
  }, []);

  return useMemo(() => ({
    message,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    clear
  }), [message, showSuccess, showError, showWarning, showInfo, clear]);
}
