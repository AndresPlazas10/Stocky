/**
 * 🌐 Hook para detectar estado de conexión a Internet
 * Detecta cambios en tiempo real entre online/offline
 *
 * FIX BRAVE: navigator.onLine es inherentemente poco fiable (MDN). En Brave,
 * los Shields de privacidad pueden bloquear las comprobaciones internas del
 * navegador, causando falsos "offline" cuando sí hay conexión. Por eso,
 * cuando navigator.onLine es false, hacemos una verificación real (HEAD a
 * Supabase) antes de mostrar estado offline.
 */

import { useState, useEffect, useRef } from 'react';

const PROBE_TIMEOUT_MS = 5000;
const PROBE_COOLDOWN_MS = 10000; // Evitar sondas repetidas

/**
 * Verifica conectividad real con una petición HEAD a Supabase.
 * Si llegamos al servidor (cualquier respuesta HTTP), estamos online.
 */
async function probeConnectivity() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return false;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

    const response = await fetch(`${url}/rest/v1/`, {
      method: 'HEAD',
      headers: { apikey: key },
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timeoutId);

    // Cualquier respuesta HTTP = servidor alcanzable = online
    return response.status > 0;
  } catch {
    return false;
  }
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return true;
    }
    if (navigator.onLine) return true;
    // navigator.onLine false puede ser falso negativo (Brave). Iniciar optimista
    // y dejar que syncFromNavigator() verifique con la sonda antes de mostrar offline.
    return true;
  });

  const lastProbeRef = useRef(0);
  const isProbingRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setIsOnline(true);
    };

    const handleOffline = async () => {
      const navOnline = navigator.onLine;
      if (navOnline) {
        setIsOnline(true);
        return;
      }

      const now = Date.now();
      const cooldownOk = now - lastProbeRef.current > PROBE_COOLDOWN_MS;
      if (!cooldownOk || isProbingRef.current) {
        setIsOnline(false);
        return;
      }

      isProbingRef.current = true;
      lastProbeRef.current = now;

      const reachable = await probeConnectivity();
      isProbingRef.current = false;

      if (reachable) {
        setIsOnline(true);
      } else {
        setIsOnline(false);
      }
    };

    const syncFromNavigator = async () => {
      if (navigator.onLine) {
        setIsOnline(true);
        return;
      }

      const now = Date.now();
      const cooldownOk = now - lastProbeRef.current > PROBE_COOLDOWN_MS;
      if (!cooldownOk || isProbingRef.current) {
        setIsOnline(false);
        return;
      }

      isProbingRef.current = true;
      lastProbeRef.current = now;

      const reachable = await probeConnectivity();
      isProbingRef.current = false;

      setIsOnline(reachable);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Sincronizar estado al montar (con verificación si navigator dice offline)
    syncFromNavigator();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
