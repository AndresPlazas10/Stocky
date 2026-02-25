/**
 * 🌐 Hook para detectar estado de conexión a Internet.
 * En modo offline explícito preferimos no emitir requests de sondeo (HEAD),
 * para evitar ruido de consola y loops de red.
 */

import { useState, useEffect } from 'react';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return true;
    }
    return navigator.onLine;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setIsOnline(true);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    const syncFromNavigator = () => setIsOnline(Boolean(navigator.onLine));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Sincronizar estado al montar sin sondas de red.
    syncFromNavigator();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
