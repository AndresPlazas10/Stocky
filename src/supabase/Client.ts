import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/utils/logger";

const SUPABASE_URL_ENV = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY_ENV = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Placeholders para evitar que createClient lance en builds sin envs
// (p. ej. E2E/CI); las llamadas a Supabase fallarán de forma controlada.
const SUPABASE_URL = SUPABASE_URL_ENV || 'https://placeholder.supabase.co';
const SUPABASE_ANON_KEY = SUPABASE_ANON_KEY_ENV || 'placeholder-anon-key';

if ((!SUPABASE_URL_ENV || !SUPABASE_ANON_KEY_ENV) && import.meta.env.DEV) {
  logger.warn(
    '⚠️ Supabase env vars missing. Some features may not work.\n' +
    `VITE_SUPABASE_URL: ${SUPABASE_URL_ENV ? '✓' : '✗ FALTA'}\n` +
    `VITE_SUPABASE_ANON_KEY: ${SUPABASE_ANON_KEY_ENV ? '✓' : '✗ FALTA'}`
  );
}

const resolveAuthStorage = (): Storage | undefined => {
  if (typeof window === 'undefined') return undefined;
  try {
    return window.sessionStorage || window.localStorage;
  } catch {
    return undefined;
  }
};

const authStorage = resolveAuthStorage();

// Cliente optimizado con configuración de producción
export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: authStorage,
    storageKey: 'supabase.auth.token',
    flowType: 'pkce' // PKCE es más seguro
  },
  global: {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
  },
  realtime: {
    params: {
      eventsPerSecond: 10 // Limitar eventos para optimizar
    }
  }
});
