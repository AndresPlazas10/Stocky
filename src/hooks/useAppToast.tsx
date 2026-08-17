import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
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

export function useAppToast({ large = false }: { large?: boolean } = {}) {
  const toastsRef = useRef<ToastItem[]>([]);
  const listenersRef = useRef<Set<() => void>>(new Set());
  const nextToastIdRef = useRef(1);
  const removeTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const timers = removeTimersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const commitToasts = useCallback((updater: (prev: ToastItem[]) => ToastItem[]) => {
    const next = updater(toastsRef.current);
    if (next === toastsRef.current) return;
    toastsRef.current = next;
    listenersRef.current.forEach((listener) => listener());
  }, []);

  const subscribe = useCallback((listener: () => void) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const getSnapshot = useCallback(() => toastsRef.current, []);

  const removeToast = useCallback(
    (id: number) => {
      commitToasts((prev) => prev.filter((toast) => toast.id !== id));
      removeTimersRef.current.delete(id);
    },
    [commitToasts]
  );

  const dismissToast = useCallback(
    (id: number) => {
      commitToasts((prev) =>
        prev.map((toast) => (toast.id === id ? { ...toast, isVisible: false } : toast))
      );
      removeTimersRef.current.set(
        id,
        setTimeout(() => {
          removeToast(id);
        }, EXIT_ANIMATION_MS)
      );
    },
    [commitToasts, removeToast]
  );

  const showToast = useCallback(
    (type: ToastType, title: string, message: string = '', duration: number = DEFAULT_DURATION) => {
      const id = nextToastIdRef.current++;
      commitToasts((prev) => {
        const next = [...prev, { id, type, title, message, duration, isVisible: true }];
        if (next.length > MAX_VISIBLE_TOASTS) {
          return next.slice(next.length - MAX_VISIBLE_TOASTS);
        }
        return next;
      });
    },
    [commitToasts]
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
      const latest = toastsRef.current[toastsRef.current.length - 1];
      if (latest) dismissToast(latest.id);
    },
    [dismissToast]
  );

  // El componente se define UNA sola vez (identidad estable): si cambiara de
  // identidad en cada render, React desmontaría y remontaría todo el stack con
  // cada alerta nueva y reiniciaría el timing de las alertas ya visibles.
  // Los toasts se leen vía useSyncExternalStore, así el stack se re-renderiza
  // solo cuando cambia la lista, sin remounts.
  const ToastComponent = useMemo(
    () =>
      function AppToast() {
        const currentToasts = useSyncExternalStore(subscribe, getSnapshot);
        return (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-full max-w-md px-4 pointer-events-none">
            <div
              data-testid="toast-stack"
              className={`flex flex-col gap-2 pointer-events-auto ${
                large ? 'scale-[1.5] origin-top' : ''
              }`}
            >
              {currentToasts.map((toast) => (
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
    [subscribe, getSnapshot, dismissToast, large]
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
