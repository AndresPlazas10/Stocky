/**
 * Configuración para Build de Producción
 * Este archivo define constantes y configuraciones específicas para producción
 */

// Detección de entorno
export const IS_PRODUCTION = import.meta.env.PROD;
export const IS_DEVELOPMENT = import.meta.env.DEV;
export const IS_TEST = import.meta.env.MODE === 'test';

// Configuración de Supabase
export const SUPABASE_CONFIG = {
  url: import.meta.env.VITE_SUPABASE_URL,
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  options: {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce' // Más seguro para producción
    },
    realtime: {
      params: {
        eventsPerSecond: 10 // Limitar eventos para optimizar performance
      }
    }
  }
};

// Configuración de Email
export const EMAIL_CONFIG = {
  provider: import.meta.env.VITE_EMAIL_PROVIDER || 'resend',
  resendApiKey: import.meta.env.VITE_RESEND_API_KEY,
  fromEmail: import.meta.env.VITE_FROM_EMAIL || 'noreply@stockly.app',
  testMode: IS_DEVELOPMENT
};

// Configuración de caché
export const CACHE_CONFIG = {
  enabled: IS_PRODUCTION,
  ttl: 5 * 60 * 1000, // 5 minutos
  maxSize: 100 // Máximo de items en caché
};

// Límites y validaciones
export const LIMITS = {
  maxUploadSize: 5 * 1024 * 1024, // 5MB
  maxProductsPerPage: 50,
  maxSalesPerPage: 100,
  sessionTimeout: 30 * 60 * 1000, // 30 minutos
  debounceDelay: 300 // ms
};

// URLs y endpoints
export const APP_CONFIG = {
  appName: 'Stockly',
  appVersion: '1.0.0',
  baseUrl: IS_PRODUCTION 
    ? 'https://stockly.vercel.app' 
    : 'http://localhost:5173',
  supportEmail: 'support@stockly.app'
};

// Feature flags
export const FEATURES = {
  enableRealtime: true,
  enableNotifications: true,
  enableInvoiceEmail: IS_PRODUCTION,
  enableAnalytics: IS_PRODUCTION,
  enableErrorReporting: IS_PRODUCTION
};

// Validar configuración crítica
export const validateConfig = () => {
  const errors = [];
  
  if (!SUPABASE_CONFIG.url) {
    errors.push('VITE_SUPABASE_URL no está configurado');
  }
  
  if (!SUPABASE_CONFIG.anonKey) {
    errors.push('VITE_SUPABASE_ANON_KEY no está configurado');
  }
  
  if (IS_PRODUCTION && !EMAIL_CONFIG.resendApiKey) {
    errors.push('VITE_RESEND_API_KEY no está configurado para producción');
  }
  
  if (errors.length > 0) {
    throw new Error(`Errores de configuración:\n${errors.join('\n')}`);
  }
  
  return true;
};

export default {
  IS_PRODUCTION,
  IS_DEVELOPMENT,
  SUPABASE_CONFIG,
  EMAIL_CONFIG,
  CACHE_CONFIG,
  LIMITS,
  APP_CONFIG,
  FEATURES,
  validateConfig
};
