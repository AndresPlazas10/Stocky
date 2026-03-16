const defaultApiBaseUrl = 'https://www.stockypos.app';
const rawBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || defaultApiBaseUrl;
const defaultAndroidDownloadUrl = 'https://www.stockypos.app/descargar';

export const EXPO_CONFIG = {
  apiBaseUrl: rawBaseUrl.replace(/\/+$/, ''),
  clientVersion: process.env.EXPO_PUBLIC_MOBILE_VERSION || '0.1.1',
  supabaseUrl: String(process.env.EXPO_PUBLIC_SUPABASE_URL || '').trim() || null,
  supabaseAnonKey: String(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '').trim() || null,
  easProjectId: String(process.env.EXPO_PUBLIC_EAS_PROJECT_ID || '').trim() || null,
  androidDownloadUrl: String(process.env.EXPO_PUBLIC_ANDROID_DOWNLOAD_URL || '').trim()
    || defaultAndroidDownloadUrl,
};
