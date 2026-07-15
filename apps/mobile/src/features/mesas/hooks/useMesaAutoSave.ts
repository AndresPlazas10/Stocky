import { useCallback, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

const AUTO_SAVE_DEBOUNCE_MS = 3000;

type UseMesaAutoSaveParams = {
  hasPendingChanges: boolean;
  onSave: (options?: { isAutoSave?: boolean }) => Promise<void> | void;
  enabled: boolean;
};

export function useMesaAutoSave({ hasPendingChanges, onSave, enabled }: UseMesaAutoSaveParams) {
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSaveRef = useRef(onSave);
  const isSavingRef = useRef(false);
  const hasPendingRef = useRef(hasPendingChanges);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  useEffect(() => {
    hasPendingRef.current = hasPendingChanges;
  }, [hasPendingChanges]);

  const flushSave = useCallback(async () => {
    if (!hasPendingRef.current || isSavingRef.current) return;
    isSavingRef.current = true;
    try {
      await onSaveRef.current({ isAutoSave: true });
    } finally {
      isSavingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!enabled || !hasPendingChanges) return;

    debounceTimerRef.current = setTimeout(() => {
      void flushSave();
    }, AUTO_SAVE_DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [enabled, hasPendingChanges, flushSave]);

  useEffect(() => {
    if (!enabled) return;

    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === 'background' || nextState === 'inactive') {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }
        void flushSave();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppState);
    return () => subscription.remove();
  }, [enabled, flushSave]);

  return {
    isAutoSaving: isSavingRef.current,
  };
}
