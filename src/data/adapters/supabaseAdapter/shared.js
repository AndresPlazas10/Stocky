import { supabase } from '../../../supabase/Client';

export const AUTH_STORAGE_KEY = 'supabase.auth.token';
export const INVENTORY_PRODUCT_COLUMNS = 'id, business_id, code, name, category, purchase_price, sale_price, stock, min_stock, unit, supplier_id, is_active, manage_stock, created_at';
export const INVENTORY_PRODUCT_SUPPLIER_SELECT = 'supplier:suppliers(id, business_name, contact_name)';
export const SLOW_QUERY_THRESHOLD_MS = 800;

export function parseJson(value, fallback = null) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function isOfflineRuntime() {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

export function pickStoredSession(parsed) {
  if (!parsed) return null;
  if (parsed?.user) return parsed;
  if (parsed?.session?.user) return parsed.session;
  if (parsed?.currentSession?.user) return parsed.currentSession;
  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      if (item?.user) return item;
      if (item?.session?.user) return item.session;
      if (item?.currentSession?.user) return item.currentSession;
    }
  }
  return null;
}

export function getStoredSessionFallback() {
  if (typeof window === 'undefined') return null;

  const keys = new Set([AUTH_STORAGE_KEY]);
  try {
    for (let i = 0; i < (window.localStorage?.length || 0); i += 1) {
      const key = window.localStorage.key(i);
      if (typeof key === 'string' && key.includes('auth-token')) {
        keys.add(key);
      }
    }
    for (let i = 0; i < (window.sessionStorage?.length || 0); i += 1) {
      const key = window.sessionStorage.key(i);
      if (typeof key === 'string' && key.includes('auth-token')) {
        keys.add(key);
      }
    }
  } catch {
    // best-effort
  }

  for (const key of keys) {
    try {
      const localParsed = parseJson(window.localStorage?.getItem(key), null);
      const localSession = pickStoredSession(localParsed);
      if (localSession?.user) return localSession;
    } catch {
      // best-effort
    }

    try {
      const sessionParsed = parseJson(window.sessionStorage?.getItem(key), null);
      const session = pickStoredSession(sessionParsed);
      if (session?.user) return session;
    } catch {
      // best-effort
    }
  }

  return null;
}

export function isInvalidRefreshTokenError(error) {
  const message = String(error?.message || '').toLowerCase();
  return (
    message.includes('invalid refresh token')
    || message.includes('refresh token not found')
  );
}

export async function recoverInvalidRefreshTokenSession(fallbackData, { allowOfflineFallback = false } = {}) {
  if (allowOfflineFallback && isOfflineRuntime()) {
    const storedSession = getStoredSessionFallback();
    if (storedSession?.user) {
      if (Object.prototype.hasOwnProperty.call(fallbackData || {}, 'session')) {
        return { data: { session: storedSession }, error: null };
      }
      return { data: { user: storedSession.user }, error: null };
    }

    return { data: fallbackData, error: null };
  }

  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch {
    // best-effort
  }

  try {
    if (typeof window !== 'undefined') {
      window.localStorage?.removeItem(AUTH_STORAGE_KEY);
      window.sessionStorage?.removeItem(AUTH_STORAGE_KEY);
    }
  } catch {
    // best-effort
  }

  return { data: fallbackData, error: null };
}

export function isMissingColumnError(errorLike, { tableName = '', columnName = '' } = {}) {
  const message = String(errorLike?.message || errorLike || '').toLowerCase();
  if (!message) return false;

  const normalizedTable = String(tableName || '').trim().toLowerCase();
  const normalizedColumn = String(columnName || '').trim().toLowerCase();

  if (normalizedColumn && !message.includes(normalizedColumn)) return false;

  const mentionsMissingColumn = (
    message.includes('does not exist')
    || message.includes('schema cache')
    || message.includes('could not find the')
    || message.includes('pgrst')
  );

  if (!mentionsMissingColumn) return false;

  if (!normalizedTable) return true;
  return message.includes(normalizedTable) || message.includes(`relation "${normalizedTable}"`);
}
