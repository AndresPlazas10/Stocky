import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabaseClient } from '../../lib/supabase';
import {
  clearResolvedBusinessContextCache,
  resolveBusinessContext,
  type BusinessContext,
} from '../../services/mesasService';
import { deactivatePushTokenForUser } from '../../notifications/mobileNotificationsService';

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

  const refreshBusinessContext = useCallback(async (options?: { silent?: boolean; forceRefresh?: boolean }) => {
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
  }, [session.user.id]);

  useEffect(() => {
    void refreshBusinessContext();
  }, [refreshBusinessContext]);

  useEffect(() => {
    let cancelled = false;
    let fallbackTimer: ReturnType<typeof setInterval> | null = null;

    let client;
    try {
      client = getSupabaseClient();
    } catch {
      return undefined;
    }

    const scheduleContextRefresh = () => {
      if (cancelled || contextRealtimeRefreshTimerRef.current) return;
      contextRealtimeRefreshTimerRef.current = setTimeout(() => {
        contextRealtimeRefreshTimerRef.current = null;
        void refreshBusinessContext({ silent: true, forceRefresh: true });
      }, 150);
    };

    const channel = client
      .channel(`mobile-dashboard-context:${session.user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'employees',
        filter: `user_id=eq.${session.user.id}`,
      }, scheduleContextRefresh)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'businesses',
        filter: `created_by=eq.${session.user.id}`,
      }, scheduleContextRefresh);

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        scheduleContextRefresh();
      }
    });

    fallbackTimer = setInterval(() => {
      scheduleContextRefresh();
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

  const signOut = async () => {
    clearResolvedBusinessContextCache(session.user.id);
    const client = getSupabaseClient();
    try {
      await deactivatePushTokenForUser(session.user.id);
    } catch (error) {
      console.log('[notifications] failed to deactivate token on sign out', error);
    }
    await client.auth.signOut();
  };

  const value = useMemo<DashboardContextValue>(() => ({
    session,
    businessContext,
    loadingBusiness,
    businessError,
    refreshBusinessContext,
    signOut,
  }), [session, businessContext, loadingBusiness, businessError]);

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboardContext() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboardContext must be used inside DashboardProvider');
  }
  return context;
}
