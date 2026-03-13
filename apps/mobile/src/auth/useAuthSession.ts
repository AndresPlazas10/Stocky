import { useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import { getSupabaseClient } from '../lib/supabase';

type AuthSessionState = {
  session: Session | null;
  loading: boolean;
  error: string | null;
};

export function useAuthSession(): AuthSessionState {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<Session | null>(null);

  const setSessionSafe = (nextSession: Session | null) => {
    sessionRef.current = nextSession;
    setSession(nextSession);
  };

  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | null = null;
    let appStateSub: { remove: () => void } | null = null;

    async function refreshSession({ silent = false } = {}) {
      try {
        const client = getSupabaseClient();
        const { data, error: getSessionError } = await client.auth.getSession();
        if (getSessionError) {
          throw getSessionError;
        }

        if (mounted) {
          setSessionSafe(data.session || null);
          if (!silent) setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to initialize auth');
          if (!sessionRef.current) {
            setSessionSafe(null);
          }
        }
      }
    }

    async function bootstrap() {
      try {
        const client = getSupabaseClient();
        await refreshSession();

        const subscription = client.auth.onAuthStateChange((_event, nextSession) => {
          if (!mounted) return;
          setSessionSafe(nextSession || null);
        });

        unsubscribe = () => {
          subscription.data.subscription.unsubscribe();
        };

        appStateSub = AppState.addEventListener('change', (nextState) => {
          if (nextState === 'active') {
            void refreshSession({ silent: true });
          }
        });
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to initialize auth');
          if (!sessionRef.current) {
            setSessionSafe(null);
          }
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    bootstrap();

    return () => {
      mounted = false;
      if (unsubscribe) {
        unsubscribe();
      }
      if (appStateSub) {
        appStateSub.remove();
      }
    };
  }, []);

  return { session, loading, error };
}
