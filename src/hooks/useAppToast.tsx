import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { SyncStyleAlert } from '@/components/ui/SyncStyleAlert';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: number;
  type: ToastType;
  title: string;
  message: string;
  duration: number;
  isVisible: boolean;
}

export const TOAST_DEFAULT_DURATION = 10000;
export const MAX_VISIBLE_TOASTS = 5;
const DEFAULT_DURATION = TOAST_DEFAULT_DURATION;
const LOADING_DURATION = 600000;
const EXIT_ANIMATION_MS = 250;

export function useAppToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextToastIdRef = useRef(1);
  const removeTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const timers = removeTimersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
    removeTimersRef.current.delete(id);
  }, []);

  const dismissToast = useCallback(
    (id: number) => {
      setToasts((prev) =>
        prev.map((toast) => (toast.id === id ? { ...toast, isVisible: false } : toast))
      );
      removeTimersRef.current.set(
        id,
        setTimeout(() => {
          removeToast(id);
        }, EXIT_ANIMATION_MS)
      );
    },
    [removeToast]
  );

  const showToast = useCallback(
    (type: ToastType, title: string, message: string = '', duration: number = DEFAULT_DURATION) => {
      const id = nextToastIdRef.current++;
      setToasts((prev) => {
        const next = [...prev, { id, type, title, message, duration, isVisible: true }];
        if (next.length > MAX_VISIBLE_TOASTS) {
          return next.slice(next.length - MAX_VISIBLE_TOASTS);
        }
        return next;
      });
    },
    []
  );

  const showSuccess = useCallback(
    (title: string, message?: string, duration?: number) => {
      showToast('success', title, message, duration);
    },
    [showToast]
  );

  const showError = useCallback(
    (title: string, message?: string, duration?: number) => {
      showToast('error', title, message, duration);
    },
    [showToast]
  );

  const showWarning = useCallback(
    (title: string, message?: string, duration?: number) => {
      showToast('warning', title, message, duration);
    },
    [showToast]
  );

  const showInfo = useCallback(
    (title: string, message?: string, duration?: number) => {
      showToast('info', title, message, duration);
    },
    [showToast]
  );

  const showLoading = useCallback(
    (title: string, message?: string) => {
      showToast('info', title, message, LOADING_DURATION);
    },
    [showToast]
  );

  const hideToast = useCallback(
    (id?: number) => {
      if (id !== undefined) {
        dismissToast(id);
        return;
      }
      const latest = toasts[toasts.length - 1];
      if (latest) dismissToast(latest.id);
    },
    [dismissToast, toasts]
  );

  const ToastComponent = useMemo(
    () =>
      function AppToast() {
        return (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-full max-w-md px-4 pointer-events-none">
            <div data-testid="toast-stack" className="flex flex-col gap-2 pointer-events-auto">
              {toasts.map((toast) => (
                <SyncStyleAlert
                  key={toast.id}
                  isVisible={toast.isVisible}
                  onClose={() => dismissToast(toast.id)}
                  type={toast.type}
                  title={toast.title}
                  message={toast.message}
                  duration={toast.duration}
                  usePortal={false}
                />
              ))}
            </div>
          </div>
        );
      },
    [toasts, dismissToast]
  );

  return useMemo(
    () => ({
      showSuccess,
      showError,
      showWarning,
      showInfo,
      showLoading,
      hideToast,
      ToastComponent,
    }),
    [showSuccess, showError, showWarning, showInfo, showLoading, hideToast, ToastComponent]
  );
}
