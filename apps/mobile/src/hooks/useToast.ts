import { useCallback, useState } from 'react';
import type { ToastOptions, ToastType } from '../ui/StockyToast';

type ToastState = ToastOptions & { visible: boolean };

const INITIAL_STATE: ToastState = {
  visible: false,
  type: 'success',
  title: '',
};

type ShowArgs = ToastOptions | { title: string; message?: string; ctaText?: string };

function resolveArgs(type: ToastType, args: ShowArgs): ToastOptions {
  if ('type' in args) return args;
  return { type, title: args.title, message: args.message, ctaText: args.ctaText };
}

export function useToast() {
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

  return {
    toast,
    showToast,
    hideToast,
    showSuccess,
    showError,
    showWarning,
    showInfo,
  };
}
