import { useState, useEffect } from 'react';

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
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
    window.addEventListener('focus', syncFromNavigator);
    document.addEventListener('visibilitychange', syncFromNavigator);

    syncFromNavigator();
    const pollId = window.setInterval(syncFromNavigator, 1200);

    return () => {
      window.clearInterval(pollId);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('focus', syncFromNavigator);
      document.removeEventListener('visibilitychange', syncFromNavigator);
    };
  }, []);

  return isOnline;
}
