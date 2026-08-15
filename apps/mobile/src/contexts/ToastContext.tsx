import { createContext, useCallback, useRef, useState, type ReactNode } from 'react';
import type { ToastOptions, ToastType } from '../ui/StockyToast';

export const MAX_VISIBLE_TOASTS = 5;

type ToastState = ToastOptions & { id: number; visible: boolean };

type ShowArgs =
  ToastOptions | { title: string; message?: string; ctaText?: string; sound?: boolean };

export type ToastContextValue = {
  toast: ToastState;
  toasts: ToastState[];
  showToast: (options: ToastOptions) => void;
  hideToast: (id?: number) => void;
  showSuccess: (args: ShowArgs) => void;
  showError: (args: ShowArgs) => void;
  showWarning: (args: ShowArgs) => void;
  showInfo: (args: ShowArgs) => void;
};

const INITIAL_STATE: ToastState = {
  id: -1,
  visible: false,
  type: 'success',
  title: '',
};

export const ToastContext = createContext<ToastContextValue | null>(null);

function resolveArgs(type: ToastType, args: ShowArgs): ToastOptions {
  if ('type' in args) return args;
  return {
    type,
    title: args.title,
    message: args.message,
    ctaText: args.ctaText,
    sound: args.sound,
  };
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const nextToastIdRef = useRef(1);
  const toastsRef = useRef<ToastState[]>([]);
  toastsRef.current = toasts;

  const showToast = useCallback((options: ToastOptions) => {
    const id = nextToastIdRef.current++;
    setToasts((prev) => {
      const next = [...prev, { ...options, id, visible: true }];
      if (next.length > MAX_VISIBLE_TOASTS) {
        return next.slice(next.length - MAX_VISIBLE_TOASTS);
      }
      return next;
    });
  }, []);

  const hideToast = useCallback((id?: number) => {
    const targetId =
      id !== undefined ? id : toastsRef.current[toastsRef.current.length - 1]?.id;
    if (targetId === undefined) return;
    setToasts((prev) =>
      prev.map((toast) => (toast.id === targetId ? { ...toast, visible: false } : toast)),
    );
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== targetId));
    }, 220);
  }, []);

  const showSuccess = useCallback(
    (args: ShowArgs) => showToast(resolveArgs('success', args)),
    [showToast],
  );

  const showError = useCallback(
    (args: ShowArgs) => showToast(resolveArgs('error', args)),
    [showToast],
  );

  const showWarning = useCallback(
    (args: ShowArgs) => showToast(resolveArgs('warning', args)),
    [showToast],
  );

  const showInfo = useCallback(
    (args: ShowArgs) => showToast(resolveArgs('info', args)),
    [showToast],
  );

  const toast = toasts.length > 0 ? toasts[toasts.length - 1] : INITIAL_STATE;

  return (
    <ToastContext.Provider
      value={{ toast, toasts, showToast, hideToast, showSuccess, showError, showWarning, showInfo }}
    >
      {children}
    </ToastContext.Provider>
  );
}
