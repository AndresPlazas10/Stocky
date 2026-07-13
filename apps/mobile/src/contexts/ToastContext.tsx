import { createContext, useCallback, useState, type ReactNode } from 'react';
import type { ToastOptions, ToastType } from '../ui/StockyToast';

type ToastState = ToastOptions & { visible: boolean };

type ShowArgs =
  ToastOptions | { title: string; message?: string; ctaText?: string; sound?: boolean };

export type ToastContextValue = {
  toast: ToastState;
  showToast: (options: ToastOptions) => void;
  hideToast: () => void;
  showSuccess: (args: ShowArgs) => void;
  showError: (args: ShowArgs) => void;
  showWarning: (args: ShowArgs) => void;
  showInfo: (args: ShowArgs) => void;
};

const INITIAL_STATE: ToastState = {
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
  const [toast, setToast] = useState<ToastState>(INITIAL_STATE);

  const showToast = useCallback((options: ToastOptions) => {
    setToast({ ...options, visible: true });
  }, []);

  const hideToast = useCallback(() => {
    setToast((prev) => ({ ...prev, visible: false }));
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

  return (
    <ToastContext.Provider
      value={{ toast, showToast, hideToast, showSuccess, showError, showWarning, showInfo }}
    >
      {children}
    </ToastContext.Provider>
  );
}
