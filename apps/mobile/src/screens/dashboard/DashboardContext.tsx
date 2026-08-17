import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabaseClient } from '../../lib/supabase';
import {
  clearResolvedBusinessContextCache,
  resolveBusinessContext,
  type BusinessContext,
} from '../../services/mesasService';
import { deactivatePushTokenForUser } from '../../notifications/mobileNotificationsService';
import { clearSensitiveStorage } from '../../utils/storageCleanup';
import { logSecurityEvent } from '../../services/securityAuditService';

type DashboardContextValue = {
  session: Session;
  businessContext: BusinessContext | null;
  loadingBusiness: boolean;
  businessError: string | null;
  refreshBusinessContext: () => Promise<void>;
  signOut: () => Promise<void>;
};

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardProvider({ session, children }: PropsWithChildren<{ session: Session }>) {
  const [businessContext, setBusinessContext] = useState<BusinessContext | null>(null);
  const [loadingBusiness, setLoadingBusiness] = useState(true);
  const [businessError, setBusinessError] = useState<string | null>(null);
  const contextRealtimeRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshBusinessContext = useCallback(
    async (options?: { silent?: boolean; forceRefresh?: boolean }) => {
      const silent = options?.silent === true;
      if (!silent) setLoadingBusiness(true);
      if (!silent) setBusinessError(null);
      try {
        const next = await resolveBusinessContext(session.user.id, {
          forceRefresh: options?.forceRefresh === true,
        });
        setBusinessContext(next);
      } catch (err) {
        setBusinessError(err instanceof Error ? err.message : 'No se pudo cargar el negocio');
        setBusinessContext(null);
      } finally {
        if (!silent) setLoadingBusiness(false);
      }
    },
    [session.user.id],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos
    void refreshBusinessContext();
  }, [refreshBusinessContext]);

  useEffect(() => {
    if (businessContext?.isActive === false) {
      void clearSensitiveStorage();
    }
  }, [businessContext?.isActive]);

  useEffect(() => {
    let cancelled = false;
    let fallbackTimer: ReturnType<typeof setInterval> | null = null;
    let realtimeHealthy = false;

    let client;
    try {
      client = getSupabaseClient();
    } catch {
      return undefined;
    }

    // El refresco disparado por un evento realtime fuerza la lectura (hubo un
    // cambio real). El poll de 30s es solo un fallback para cuando el canal
    // realtime no está conectado: respeta el cache de contexto (30s) y evita
    // queries en estado estable.
    const scheduleContextRefresh = (force = false) => {
      if (cancelled || contextRealtimeRefreshTimerRef.current) return;
      contextRealtimeRefreshTimerRef.current = setTimeout(() => {
        contextRealtimeRefreshTimerRef.current = null;
        void refreshBusinessContext({ silent: true, forceRefresh: force });
      }, 150);
    };

    const channel = client
      .channel(`mobile-dashboard-context:${session.user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'employees',
          filter: `user_id=eq.${session.user.id}`,
        },
        () => scheduleContextRefresh(true),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'businesses',
          filter: `created_by=eq.${session.user.id}`,
        },
        () => scheduleContextRefresh(true),
      );

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        realtimeHealthy = true;
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        realtimeHealthy = false;
      }
    });

    fallbackTimer = setInterval(() => {
      if (!realtimeHealthy) scheduleContextRefresh(true);
    }, 30000);

    return () => {
      cancelled = true;
      if (fallbackTimer) clearInterval(fallbackTimer);
      if (contextRealtimeRefreshTimerRef.current) {
        clearTimeout(contextRealtimeRefreshTimerRef.current);
        contextRealtimeRefreshTimerRef.current = null;
      }
      void client.removeChannel(channel);
    };
  }, [refreshBusinessContext, session.user.id]);

  const signOut = useCallback(async () => {
    await logSecurityEvent({
      businessId: businessContext?.businessId || null,
      userId: session.user.id,
      action: 'sign_out',
      metadata: { source: 'mobile' },
    });
    clearResolvedBusinessContextCache(session.user.id);
    await clearSensitiveStorage();
    const client = getSupabaseClient();
    try {
      await deactivatePushTokenForUser(session.user.id);
    } catch (error) {
      if (__DEV__) console.warn('[notifications] failed to deactivate token on sign out', error);
    }
    await client.auth.signOut();
  }, [businessContext?.businessId, session.user.id]);

  const value = useMemo<DashboardContextValue>(
    () => ({
      session,
      businessContext,
      loadingBusiness,
      businessError,
      refreshBusinessContext,
      signOut,
    }),
    [session, businessContext, loadingBusiness, businessError, refreshBusinessContext, signOut],
  );

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboardContext() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboardContext must be used inside DashboardProvider');
  }
  return context;
}
