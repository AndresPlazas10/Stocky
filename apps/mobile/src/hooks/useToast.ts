import { useCallback, useRef, useState } from 'react';
import type { ToastOptions, ToastType } from '../ui/StockyToast';

type ToastState = ToastOptions & { visible: boolean };

const INITIAL_STATE: ToastState = {
  visible: false,
  type: 'success',
  title: '',
};

type ShowArgs =
  ToastOptions | { title: string; message?: string; ctaText?: string; sound?: boolean };

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

export function useToast() {
  const [toast, setToast] = useState<ToastState>(INITIAL_STATE);
  const isShowingRef = useRef(false);

  const showToast = useCallback((options: ToastOptions) => {
    if (isShowingRef.current) return;
    isShowingRef.current = true;
    setToast({ ...options, visible: true });
  }, []);

  const hideToast = useCallback(() => {
    isShowingRef.current = false;
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
