import { supabase } from '../../../supabase/Client';
import { logger } from '../../../utils/logger';
import {
  getStoredSessionFallback,
  isInvalidRefreshTokenError,
  recoverInvalidRefreshTokenSession,
} from './shared.js';

export const authAdapter = {
  async getCurrentUser() {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      const sessionResult = await supabase.auth.getSession();
      if (sessionResult?.error && isInvalidRefreshTokenError(sessionResult.error)) {
        return recoverInvalidRefreshTokenSession(
          { user: null },
          { allowOfflineFallback: true }
        );
      }

      const liveUser = sessionResult?.data?.session?.user || null;
      if (liveUser) {
        return {
          data: { user: liveUser },
          error: null
        };
      }

      const storedSession = getStoredSessionFallback();
      return {
        data: {
          user: storedSession?.user || null
        },
        error: null
      };
    }

    const result = await supabase.auth.getUser();
    if (result?.error && isInvalidRefreshTokenError(result.error)) {
      return recoverInvalidRefreshTokenSession({ user: null });
    }
    return result;
  },

  async signOut() {
    return supabase.auth.signOut();
  },

  async getCurrentSession() {
    const result = await supabase.auth.getSession();
    if (result?.error && isInvalidRefreshTokenError(result.error)) {
      return recoverInvalidRefreshTokenSession(
        { session: null },
        { allowOfflineFallback: true }
      );
    }

    if (result?.data?.session) {
      return result;
    }

    const storedSession = getStoredSessionFallback();
    if (storedSession?.user) {
      return { data: { session: storedSession }, error: null };
    }

    return result;
  },

  async signOutGlobal() {
    return supabase.auth.signOut({ scope: 'global' });
  },

  async signInWithPassword({ email, password }) {
    return supabase.auth.signInWithPassword({ email, password });
  },

  async signUpWithPassword({
    email,
    password,
    options = {}
  }) {
    return supabase.auth.signUp({
      email,
      password,
      options
    });
  },

  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange(callback);
  },

  subscribeToPostgresChanges({
    channelName,
    event = '*',
    schema = 'public',
    table,
    filter,
    callback,
    onStatusChange
  }) {
    if (!channelName || !table || typeof callback !== 'function') {
      logger.warn('[realtime] invalid subscription config', {
        channelName,
        table,
        hasCallback: typeof callback === 'function'
      });
      return null;
    }

    const channel = supabase.channel(channelName);
    channel.on(
      'postgres_changes',
      {
        event,
        schema,
        table,
        filter
      },
      callback
    );
    channel.subscribe((status, err) => {
      if (typeof onStatusChange === 'function') {
        onStatusChange(status, err || null, channel);
      }
    });
    return channel;
  },

  removeRealtimeChannel(channel) {
    if (!channel) return;
    supabase.removeChannel(channel);
  },
};
