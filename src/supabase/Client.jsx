import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validación para detectar problemas de configuración
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Error de configuración de Supabase:');
  console.error('VITE_SUPABASE_URL:', SUPABASE_URL ? '✅ Configurado' : '❌ Faltante');
  console.error('VITE_SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? '✅ Configurado' : '❌ Faltante');
  console.error('Variables disponibles:', Object.keys(import.meta.env));
  throw new Error('Faltan variables de entorno de Supabase. Verifica la configuración en Vercel.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
  },
});
