import { readAdapter } from '../adapters/localAdapter';
import { supabaseAdapter } from '../adapters/supabaseAdapter';
import type { Business, Employee } from '../../types';

const AUTH_STORAGE_KEY = 'supabase.auth.token';

interface StoredSession {
  user?: { id: string; [key: string]: unknown };
  session?: { user: { id: string; [key: string]: unknown } };
  currentSession?: { user: { id: string; [key: string]: unknown } };
  [key: string]: unknown;
}

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function isConnectivityError(errorLike: unknown): boolean {
  const message = String((errorLike as { message?: string })?.message || errorLike || '').toLowerCase();
  return (
    message.includes('failed to fetch')
    || message.includes('networkerror')
    || message.includes('network request failed')
    || message.includes('fetch failed')
    || message.includes('load failed')
    || message.includes('network')
  );
}

function getStoredSession(): StoredSession | null {
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

  const pickSession = (parsed: StoredSession | null): StoredSession | null => {
    if (!parsed) return null;
    if (parsed?.user) return parsed;
    if (parsed?.session?.user) return parsed.session as unknown as StoredSession;
    if (parsed?.currentSession?.user) return parsed.currentSession as unknown as StoredSession;
    if (Array.isArray(parsed as unknown)) {
      for (const item of parsed as unknown as StoredSession[]) {
        if (item?.user) return item;
        if (item?.session?.user) return item.session as unknown as StoredSession;
        if (item?.currentSession?.user) return item.currentSession as unknown as StoredSession;
      }
    }
    return null;
  };

  for (const key of keys) {
    const localRaw = window.localStorage?.getItem(key);
    const localParsed = parseJson<StoredSession | null>(localRaw, null);
    const localSession = pickSession(localParsed);
    if (localSession) return localSession;

    const sessionRaw = window.sessionStorage?.getItem(key);
    const sessionParsed = parseJson<StoredSession | null>(sessionRaw, null);
    const session = pickSession(sessionParsed);
    if (session) return session;
  }

  return null;
}

export async function getAuthenticatedUser(): Promise<StoredSession['user'] | null> {
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

export async function getCurrentSession(): Promise<StoredSession | null> {
  const { data, error } = await supabaseAdapter.getCurrentSession();
  if (error) {
    if (!isConnectivityError(error)) throw error;
    return getStoredSession();
  }
  return data?.session || getStoredSession() || null;
}

export async function getOwnedBusinessByUserId(userId: string, selectSql: string = '*'): Promise<Business | null> {
  const { data, error } = await readAdapter.getBusinessByOwnerId(userId, selectSql);
  if (error) throw error;
  return data || null;
}

export async function getBusinessByEmail(email: string, selectSql: string = 'id'): Promise<Business | null> {
  const { data, error } = await supabaseAdapter.getBusinessByEmail(email, selectSql);
  if (error) throw error;
  return (data as unknown as Business) || null;
}

export async function getBusinessById(businessId: string, selectSql: string = '*'): Promise<Business | null> {
  const { data, error } = await readAdapter.getBusinessById(businessId, selectSql);
  if (error) throw error;
  return data || null;
}

export async function getBusinessOwnerById(businessId: string): Promise<{ id: string; [key: string]: unknown } | null> {
  const { data, error } = await readAdapter.getBusinessOwnerById(businessId);
  if (error) throw error;
  return data || null;
}

export async function getEmployeeByUserId(userId: string, selectSql: string = '*'): Promise<Employee | null> {
  const { data, error } = await readAdapter.getEmployeeByUserId(userId, selectSql);
  if (error) throw error;
  return data || null;
}

export async function getActiveEmployeeByUserId(
  userId: string,
  selectSql: string = 'id, business_id, role, is_active'
): Promise<Employee | null> {
  const { data, error } = await readAdapter.getActiveEmployeeByUserId(userId, selectSql);
  if (error) throw error;
  return data || null;
}

export async function isEmployeeInBusiness({ userId, businessId }: { userId: string; businessId: string }): Promise<boolean> {
  const { data, error } = await readAdapter.getEmployeeByUserAndBusiness(userId, businessId);
  if (error) throw error;
  return !!data;
}

export async function getEmployeeRoleInBusiness({ userId, businessId }: { userId: string; businessId: string }): Promise<string | null> {
  const { data, error } = await readAdapter.getEmployeeRoleByBusinessAndUser(businessId, userId);
  if (error) throw error;
  return String(data?.role || '').trim().toLowerCase() || null;
}

export async function isBusinessUsernameTaken(username: string): Promise<boolean> {
  const { data, error } = await supabaseAdapter.getBusinessByUsername(username, 'id');
  if (error) throw error;
  return Boolean((data as { id?: string })?.id);
}

interface SalesSeller {
  user_id: string;
  full_name: string;
  is_active?: boolean;
  is_admin?: boolean;
}

export async function getSalesSellersByBusiness(businessId: string): Promise<SalesSeller[]> {
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

  const sellers: SalesSeller[] = employees
    .filter((employee: { is_active?: boolean }) => employee?.is_active === true)
    .sort((a: { full_name?: string }, b: { full_name?: string }) =>
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
        user_id: user.id as string,
        full_name: 'Administrador',
        is_admin: true
      });
    }
  }

  return sellers;
}
