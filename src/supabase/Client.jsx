import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validación optimizada para desarrollo
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  const errorMsg = 'Faltan variables de entorno de Supabase. Verifica .env:\n' +
    `VITE_SUPABASE_URL: ${SUPABASE_URL ? '✓' : '✗'}\n` +
    `VITE_SUPABASE_ANON_KEY: ${SUPABASE_ANON_KEY ? '✗' : '✓'}`;
  
  if (import.meta.env.DEV) {
    console.error(errorMsg);
  }
  throw new Error(errorMsg);
}

// Cliente optimizado con configuración de producción
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
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
