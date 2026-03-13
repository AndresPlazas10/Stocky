import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { EXPO_CONFIG } from '../config/env';

const hasConfig = Boolean(EXPO_CONFIG.supabaseUrl && EXPO_CONFIG.supabaseAnonKey);

export const supabase = hasConfig
  ? createClient(EXPO_CONFIG.supabaseUrl!, EXPO_CONFIG.supabaseAnonKey!, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

export function getSupabaseClient() {
  if (!supabase) {
    throw new Error(
      'Missing Supabase config. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in apps/mobile/.env',
    );
  }

  return supabase;
}
