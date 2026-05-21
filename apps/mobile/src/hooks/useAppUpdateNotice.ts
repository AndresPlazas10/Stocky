import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { EXPO_CONFIG } from '../config/env';
import { fetchAppUpdateNotice, type AppUpdateNotice } from '../services/appUpdateService';

export function useAppUpdateNotice(session: Session | null | undefined) {
  const [notice, setNotice] = useState<AppUpdateNotice | null>(null);
  const checkedRef = useRef(false);

  const check = useCallback(async () => {
    if (!session || checkedRef.current) return;
    checkedRef.current = true;

    try {
      const result = await fetchAppUpdateNotice('android', EXPO_CONFIG.clientVersion);
      if (result) setNotice(result);
    } catch {
      // silencioso: no bloquear la app si falla
    }
  }, [session]);

  useEffect(() => {
    if (session) {
      const timer = setTimeout(check, 2000);
      return () => clearTimeout(timer);
    }
  }, [check, session]);

  return { updateNotice: notice, dismissUpdateNotice: () => setNotice(null) };
}
