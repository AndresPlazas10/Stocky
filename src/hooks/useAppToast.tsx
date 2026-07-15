import { useState, useCallback, useMemo } from 'react';
import { SyncStyleAlert } from '@/components/ui/SyncStyleAlert';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastState {
  isVisible: boolean;
  type: ToastType;
  title: string;
  message: string;
  duration: number;
}

const DEFAULT_DURATION = 5000;
const LOADING_DURATION = 600000;

export function useAppToast() {
  const [toast, setToast] = useState<ToastState>({
    isVisible: false,
    type: 'info',
    title: '',
    message: '',
    duration: DEFAULT_DURATION,
  });

  const showToast = useCallback(
    (type: ToastType, title: string, message: string = '', duration: number = DEFAULT_DURATION) => {
      setToast({ isVisible: true, type, title, message, duration });
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

  const hideToast = useCallback(() => {
    setToast((prev) => ({ ...prev, isVisible: false }));
  }, []);

  const ToastComponent = useMemo(
    () =>
      function AppToast() {
        return (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-full max-w-md px-4 pointer-events-none">
            <div className="pointer-events-auto">
              <SyncStyleAlert
                isVisible={toast.isVisible}
                onClose={hideToast}
                type={toast.type}
                title={toast.title}
                message={toast.message}
                duration={toast.duration}
                usePortal={false}
              />
            </div>
          </div>
        );
      },
    [toast, hideToast]
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
