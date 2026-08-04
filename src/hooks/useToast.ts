import { useCallback, useEffect, useMemo, useState } from 'react';

type ToastType = 'success' | 'error' | 'warning' | 'info' | null;

interface ToastMessage {
  type: ToastType;
  text: string;
}

export interface UseToastReturn {
  message: ToastMessage;
  showSuccess: (text: string) => void;
  showError: (text: string) => void;
  showWarning: (text: string) => void;
  showInfo: (text: string) => void;
  clear: () => void;
}

export function useToast(duration = 1000): UseToastReturn {
  const [message, setMessage] = useState<ToastMessage>({ type: null, text: '' });

  useEffect(() => {
    if (message.text) {
      const timer = setTimeout(() => {
        setMessage({ type: null, text: '' });
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [message, duration]);

  const showSuccess = useCallback((text: string) => {
    setMessage({ type: 'success', text });
  }, []);

  const showError = useCallback((text: string) => {
    setMessage({ type: 'error', text });
  }, []);

  const showWarning = useCallback((text: string) => {
    setMessage({ type: 'warning', text });
  }, []);

  const showInfo = useCallback((text: string) => {
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
