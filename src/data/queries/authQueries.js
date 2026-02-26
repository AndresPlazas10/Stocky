import { readAdapter } from '../adapters/localAdapter';
import { supabaseAdapter } from '../adapters/supabaseAdapter';

const AUTH_STORAGE_KEY = 'supabase.auth.token';

function parseJson(value, fallback = null) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function isConnectivityError(errorLike) {
  const message = String(errorLike?.message || errorLike || '').toLowerCase();
  return (
    message.includes('failed to fetch')
    || message.includes('networkerror')
    || message.includes('network request failed')
    || message.includes('fetch failed')
    || message.includes('load failed')
    || message.includes('network')
  );
}

function getStoredSession() {
  if (typeof window === 'undefined') return null;

  const keys = new Set([AUTH_STORAGE_KEY]);
  try {
    for (let i = 0; i < (window.localStorage?.length || 0); i++) {
      const key = window.localStorage.key(i);
      if (typeof key === 'string' && key.includes('auth-token')) {
        keys.add(key);
      }
    }
    for (let i = 0; i < (window.sessionStorage?.length || 0); i++) {
      const key = window.sessionStorage.key(i);
      if (typeof key === 'string' && key.includes('auth-token')) {
        keys.add(key);
      }
    }
  } catch {
    // best-effort
  }

  const pickSession = (parsed) => {
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
  };

  for (const key of keys) {
    const localRaw = window.localStorage?.getItem(key);
    const localParsed = parseJson(localRaw, null);
    const localSession = pickSession(localParsed);
    if (localSession) return localSession;

    const sessionRaw = window.sessionStorage?.getItem(key);
    const sessionParsed = parseJson(sessionRaw, null);
    const session = pickSession(sessionParsed);
    if (session) return session;
  }

  return null;
}

export async function getAuthenticatedUser() {
  const { data, error } = await readAdapter.getCurrentUser();
  if (error) {
    if (!isConnectivityError(error)) throw error;
    const session = await getCurrentSession();
    return session?.user || getStoredSession()?.user || null;
  }

  if (data?.user) return data.user;

  const session = await getCurrentSession();
  return session?.user || getStoredSession()?.user || null;
}

export async function getCurrentSession() {
  const { data, error } = await supabaseAdapter.getCurrentSession();
  if (error) {
    if (!isConnectivityError(error)) throw error;
    return getStoredSession();
  }
  return data?.session || getStoredSession() || null;
}

export async function getOwnedBusinessByUserId(userId, selectSql = '*') {
  const { data, error } = await readAdapter.getBusinessByOwnerId(userId, selectSql);
  if (error) throw error;
  return data || null;
}

export async function getBusinessByEmail(email, selectSql = 'id') {
  const { data, error } = await supabaseAdapter.getBusinessByEmail(email, selectSql);
  if (error) throw error;
  return data || null;
}

export async function getBusinessById(businessId, selectSql = '*') {
  const { data, error } = await readAdapter.getBusinessById(businessId, selectSql);
  if (error) throw error;
  return data || null;
}

export async function getBusinessOwnerById(businessId) {
  const { data, error } = await readAdapter.getBusinessOwnerById(businessId);
  if (error) throw error;
  return data || null;
}

export async function getEmployeeByUserId(userId, selectSql = '*') {
  const { data, error } = await readAdapter.getEmployeeByUserId(userId, selectSql);
  if (error) throw error;
  return data || null;
}

export async function getActiveEmployeeByUserId(userId, selectSql = 'id, business_id, role, is_active') {
  const { data, error } = await readAdapter.getActiveEmployeeByUserId(userId, selectSql);
  if (error) throw error;
  return data || null;
}

export async function isEmployeeInBusiness({ userId, businessId }) {
  const { data, error } = await readAdapter.getEmployeeByUserAndBusiness(userId, businessId);
  if (error) throw error;
  return !!data;
}

export async function getEmployeeRoleInBusiness({ userId, businessId }) {
  const { data, error } = await readAdapter.getEmployeeRoleByBusinessAndUser(businessId, userId);
  if (error) throw error;
  return String(data?.role || '').trim().toLowerCase() || null;
}

export async function isBusinessUsernameTaken(username) {
  const { data, error } = await supabaseAdapter.getBusinessByUsername(username, 'id');
  if (error) throw error;
  return Boolean(data?.id);
}

export async function getSalesSellersByBusiness(businessId) {
  const [user, employees] = await Promise.all([
    getAuthenticatedUser(),
    (async () => {
      const { data, error } = await readAdapter.getEmployeesByBusinessWithSelect(
        businessId,
        'user_id, full_name, is_active'
      );
      if (error) throw error;
      return data || [];
    })()
  ]);

  const sellers = employees
    .filter((employee) => employee?.is_active === true)
    .sort((a, b) =>
      String(a?.full_name || '').localeCompare(String(b?.full_name || ''), 'es', {
        numeric: true,
        sensitivity: 'base'
      })
    )
    .slice(0, 100);

  if (user?.id) {
    const exists = sellers.some((seller) => seller.user_id === user.id);
    if (!exists) {
      sellers.unshift({
        user_id: user.id,
        full_name: 'Administrador',
        is_admin: true
      });
    }
  }

  return sellers;
}
