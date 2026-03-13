import AsyncStorage from '@react-native-async-storage/async-storage';
import { EXPO_CONFIG } from '../config/env';
import { getSupabaseClient } from '../lib/supabase';

export type MesaStatus = 'available' | 'occupied' | string;

export type MesaRecord = {
  id: string;
  business_id: string;
  table_number?: number | string | null;
  name?: string | null;
  status: MesaStatus;
  current_order_id?: string | null;
  order_units?: number;
  orders?: {
    id?: string;
    status?: string;
    total?: number;
  } | null;
};

export type BusinessContext = {
  businessId: string;
  businessName: string | null;
  source: 'owner' | 'employee';
};

export type MesaEditLock = {
  table_id: string;
  business_id: string;
  lock_owner_user_id: string;
  lock_owner_name: string;
  lock_token: string | null;
  lock_expires_at: string | null;
  updated_at: string | null;
};

export type MesaEditLockAcquireResult = {
  ok: boolean;
  unsupported: boolean;
  lock: MesaEditLock | null;
  lockOwnerName: string | null;
  lockToken: string | null;
};

export type MesaEditLockHeartbeatResult = {
  ok: boolean;
  unsupported: boolean;
  lock: MesaEditLock | null;
  lockOwnerName: string | null;
  lost: boolean;
};

type BusinessCandidate = {
  businessId: string;
  businessName: string | null;
  source: 'owner' | 'employee';
  createdAt: string | null;
};

const LAST_BUSINESS_ID_STORAGE_KEY = 'stocky.mobile.last_business_id';
const BUSINESS_CONTEXT_CACHE_TTL_MS = 30_000;
const MESA_EDITOR_DISPLAY_NAME_CACHE_TTL_MS = 60_000;
let businessContextRpcCompatibility: 'unknown' | 'supported' | 'unsupported' = 'unknown';
let openCloseRpcCompatibility: 'unknown' | 'supported' | 'unsupported' = 'unknown';
let mesasSummaryFastRpcCompatibility: 'unknown' | 'supported' | 'unsupported' = 'unknown';
let mesasSummaryRpcCompatibility: 'unknown' | 'supported' | 'unsupported' = 'unknown';
const businessContextCacheByUserId = new Map<string, {
  value: BusinessContext | null;
  expiresAt: number;
}>();
const businessContextInFlightByUserId = new Map<string, Promise<BusinessContext | null>>();
const mesaEditorDisplayNameCacheByKey = new Map<string, {
  value: string;
  expiresAt: number;
}>();
const mesaEditorDisplayNameInFlightByKey = new Map<string, Promise<string>>();

function normalizeReference(value: unknown): string | null {
  const normalized = String(value ?? '').trim();
  if (!normalized) return null;
  const lower = normalized.toLowerCase();
  if (lower === 'null' || lower === 'undefined') return null;
  return normalized;
}

function normalizeDisplayName(value: unknown, fallback = 'Usuario'): string {
  const normalized = normalizeReference(value);
  return normalized || fallback;
}

function mesaEditorDisplayNameCacheKey(businessId: string, userId: string) {
  return `${String(businessId || '').trim()}::${String(userId || '').trim()}`;
}

function createMesaLockToken() {
  const random = Math.random().toString(36).slice(2, 11);
  return `${Date.now()}-${random}`;
}

function normalizeMesaStatus(value: unknown): MesaStatus {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'occupied') return 'occupied';
  if (normalized === 'available') return 'available';
  return normalized || 'available';
}

function normalizeMesaRow(row: any): MesaRecord {
  const hasOrderUnits = Boolean(row && typeof row === 'object' && 'order_units' in row);
  const rawOrderUnits = row?.order_units;
  const normalizedOrderUnits = (
    rawOrderUnits === null
    || rawOrderUnits === undefined
    || String(rawOrderUnits).trim() === ''
  )
    ? Number.NaN
    : Number(rawOrderUnits);
  return {
    id: String(row?.id || ''),
    business_id: String(row?.business_id || ''),
    table_number: row?.table_number ?? null,
    name: row?.name ?? null,
    status: normalizeMesaStatus(row?.status),
    current_order_id: row?.current_order_id ?? null,
    order_units: hasOrderUnits && Number.isFinite(normalizedOrderUnits)
      ? Math.max(0, Math.floor(normalizedOrderUnits))
      : undefined,
    orders: row?.orders
      ? {
          id: row.orders.id,
          status: row.orders.status,
          total: Number(row.orders.total || 0),
        }
      : null,
  };
}

function normalizeBusinessContextCandidate(candidate: BusinessCandidate | null): BusinessContext | null {
  if (!candidate?.businessId) return null;
  return {
    businessId: candidate.businessId,
    businessName: candidate.businessName,
    source: candidate.source,
  };
}

async function resolveRememberedBusinessCandidate(
  client: ReturnType<typeof getSupabaseClient>,
  userId: string,
  rememberedBusinessId: string,
): Promise<BusinessCandidate | null> {
  const ownerResult = await client
    .from('businesses')
    .select('id,name,created_at')
    .eq('id', rememberedBusinessId)
    .eq('created_by', userId)
    .limit(1)
    .maybeSingle();

  if (ownerResult.error) throw ownerResult.error;

  if (ownerResult.data?.id) {
    return {
      businessId: String(ownerResult.data.id),
      businessName: ownerResult.data.name || null,
      source: 'owner',
      createdAt: ownerResult.data.created_at || null,
    };
  }

  const employeeResult = await client
    .from('employees')
    .select('business_id,created_at')
    .eq('user_id', userId)
    .eq('is_active', true)
    .eq('business_id', rememberedBusinessId)
    .limit(1)
    .maybeSingle();
  if (employeeResult.error) throw employeeResult.error;

  if (employeeResult.data?.business_id) {
    const businessResult = await client
      .from('businesses')
      .select('id,name,created_at')
      .eq('id', rememberedBusinessId)
      .limit(1)
      .maybeSingle();

    if (businessResult.error) throw businessResult.error;

    return {
      businessId: String(employeeResult.data.business_id),
      businessName: businessResult.data?.name || null,
      source: 'employee',
      createdAt: employeeResult.data.created_at || businessResult.data?.created_at || null,
    };
  }

  return null;
}

function isMissingNameColumnError(errorLike: any) {
  const message = String(errorLike?.message || '').toLowerCase();
  const details = String(errorLike?.details || '').toLowerCase();
  return (
    message.includes('column')
    && message.includes('name')
    && (message.includes('does not exist') || details.includes('does not exist'))
  );
}

function isMissingListTablesWithOrderSummaryRpcError(errorLike: any) {
  const code = String(errorLike?.code || '').toLowerCase();
  const message = String(errorLike?.message || '').toLowerCase();
  return (
    code === 'pgrst202'
    || code === '42883'
    || (
      message.includes('list_tables_with_order_summary')
      && (
        message.includes('does not exist')
        || message.includes('could not find the function')
        || message.includes('schema cache')
        || message.includes('not found')
      )
    )
  );
}

function isMissingListTablesWithOrderSummaryFastRpcError(errorLike: any) {
  const code = String(errorLike?.code || '').toLowerCase();
  const message = String(errorLike?.message || '').toLowerCase();
  return (
    code === 'pgrst202'
    || code === '42883'
    || (
      message.includes('list_tables_with_order_summary_fast')
      && (
        message.includes('does not exist')
        || message.includes('could not find the function')
        || message.includes('schema cache')
        || message.includes('not found')
      )
    )
  );
}

function isMissingResolveMobileBusinessContextRpcError(errorLike: any) {
  const code = String(errorLike?.code || '').toLowerCase();
  const message = String(errorLike?.message || '').toLowerCase();
  return (
    code === 'pgrst202'
    || code === '42883'
    || (
      message.includes('resolve_mobile_business_context')
      && (
        message.includes('does not exist')
        || message.includes('could not find the function')
        || message.includes('schema cache')
        || message.includes('not found')
      )
    )
  );
}

function isMissingColumnInRelationError(
  errorLike: any,
  { tableName, columnName }: { tableName: string; columnName: string },
) {
  const message = String(errorLike?.message || '').toLowerCase();
  return (
    message.includes('column')
    && message.includes(`"${String(columnName || '').toLowerCase()}"`)
    && message.includes('relation')
    && message.includes(`"${String(tableName || '').toLowerCase()}"`)
    && message.includes('does not exist')
  );
}

function isDuplicateKeyError(errorLike: any) {
  const code = String(errorLike?.code || '').trim();
  return code === '23505';
}

function isMissingTableEditLocksRelationError(errorLike: any) {
  const message = String(errorLike?.message || '').toLowerCase();
  return (
    message.includes('relation')
    && message.includes('"table_edit_locks"')
    && message.includes('does not exist')
  );
}

function isMissingTableEditLocksColumnError(errorLike: any, columnName: string) {
  return isMissingColumnInRelationError(errorLike, {
    tableName: 'table_edit_locks',
    columnName,
  });
}

function normalizeMesaEditLock(row: any): MesaEditLock {
  return {
    table_id: String(row?.table_id || ''),
    business_id: String(row?.business_id || ''),
    lock_owner_user_id: String(row?.lock_owner_user_id || ''),
    lock_owner_name: normalizeDisplayName(row?.lock_owner_name),
    lock_token: normalizeReference(row?.lock_token),
    lock_expires_at: normalizeReference(row?.lock_expires_at),
    updated_at: normalizeReference(row?.updated_at),
  };
}

async function fetchMesasWithSelect(businessId: string, includeNameColumn: boolean) {
  const client = getSupabaseClient();

  const selectSql = includeNameColumn
    ? `
      id,
      business_id,
      table_number,
      name,
      status,
      current_order_id,
      orders:orders!current_order_id (
        id,
        status,
        total
      )
    `
    : `
      id,
      business_id,
      table_number,
      status,
      current_order_id,
      orders:orders!current_order_id (
        id,
        status,
        total
      )
    `;

  return client
    .from('tables')
    .select(selectSql)
    .eq('business_id', businessId)
    .order('table_number', { ascending: true });
}

async function fetchMesasWithOrderSummaryRpc(businessId: string): Promise<MesaRecord[]> {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc('list_tables_with_order_summary', {
    p_business_id: businessId,
  });
  if (error) throw error;
  return (Array.isArray(data) ? data : []).map(normalizeMesaRow);
}

async function fetchMesasWithOrderSummaryFastRpc(businessId: string): Promise<MesaRecord[]> {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc('list_tables_with_order_summary_fast', {
    p_business_id: businessId,
  });
  if (error) throw error;
  return (Array.isArray(data) ? data : []).map(normalizeMesaRow);
}

async function fetchMesaById(tableId: string, includeNameColumn: boolean) {
  const client = getSupabaseClient();

  const selectSql = includeNameColumn
    ? `
      id,
      business_id,
      table_number,
      name,
      status,
      current_order_id,
      orders:orders!current_order_id (
        id,
        status,
        total
      )
    `
    : `
      id,
      business_id,
      table_number,
      status,
      current_order_id,
      orders:orders!current_order_id (
        id,
        status,
        total
      )
    `;

  return client
    .from('tables')
    .select(selectSql)
    .eq('id', tableId)
    .maybeSingle();
}

async function fetchMesaRecordById(tableId: string): Promise<MesaRecord | null> {
  const detailedMesa = await fetchMesaById(tableId, true);
  if (!detailedMesa.error && detailedMesa.data) {
    return normalizeMesaRow(detailedMesa.data);
  }

  if (isMissingNameColumnError(detailedMesa.error)) {
    const fallbackMesa = await fetchMesaById(tableId, false);
    if (!fallbackMesa.error && fallbackMesa.data) {
      return normalizeMesaRow(fallbackMesa.data);
    }
  }

  return null;
}

async function closeOpenOrdersLegacy({
  businessId,
  tableId,
  nextStatus,
  excludeOrderId = null,
}: {
  businessId: string;
  tableId: string;
  nextStatus: 'closed' | 'cancelled';
  excludeOrderId?: string | null;
}) {
  const client = getSupabaseClient();
  const basePayload: Record<string, any> = { status: nextStatus };
  const payloadWithClosedAt = { ...basePayload, closed_at: new Date().toISOString() };

  let query = client
    .from('orders')
    .update(payloadWithClosedAt)
    .eq('business_id', businessId)
    .eq('table_id', tableId)
    .eq('status', 'open');

  if (excludeOrderId) {
    query = query.neq('id', excludeOrderId);
  }

  const first = await query;
  if (!first.error) return;

  if (!isMissingColumnInRelationError(first.error, { tableName: 'orders', columnName: 'closed_at' })) {
    throw first.error;
  }

  let fallbackQuery = client
    .from('orders')
    .update(basePayload)
    .eq('business_id', businessId)
    .eq('table_id', tableId)
    .eq('status', 'open');

  if (excludeOrderId) {
    fallbackQuery = fallbackQuery.neq('id', excludeOrderId);
  }

  const fallback = await fallbackQuery;
  if (fallback.error) throw fallback.error;
}

async function createOpenOrderLegacy({
  businessId,
  tableId,
  userId,
}: {
  businessId: string;
  tableId: string;
  userId: string;
}) {
  const client = getSupabaseClient();
  const baseOrder = {
    business_id: businessId,
    table_id: tableId,
    user_id: userId,
    status: 'open',
  };

  const withTotal = await client
    .from('orders')
    .insert([{ ...baseOrder, total: 0 }])
    .select('id')
    .single();

  if (!withTotal.error && withTotal.data?.id) {
    return String(withTotal.data.id);
  }

  if (!isMissingColumnInRelationError(withTotal.error, { tableName: 'orders', columnName: 'total' })) {
    throw withTotal.error;
  }

  const withoutTotal = await client
    .from('orders')
    .insert([baseOrder])
    .select('id')
    .single();

  if (withoutTotal.error) throw withoutTotal.error;
  if (!withoutTotal.data?.id) throw new Error('No se pudo crear orden abierta');
  return String(withoutTotal.data.id);
}

async function runLegacyOpenCloseWithSupabaseClient({
  tableId,
  action,
  userId,
}: {
  tableId: string;
  action: 'open' | 'close';
  userId: string;
}): Promise<MesaRecord> {
  const client = getSupabaseClient();
  let { data: tableRow, error: tableError } = await client
    .from('tables')
    .select('id,business_id,table_number,name,current_order_id,status')
    .eq('id', tableId)
    .maybeSingle();

  if (tableError && isMissingNameColumnError(tableError)) {
    const fallback = await client
      .from('tables')
      .select('id,business_id,table_number,current_order_id,status')
      .eq('id', tableId)
      .maybeSingle();
    tableRow = fallback.data;
    tableError = fallback.error;
  }

  if (tableError) throw tableError;
  if (!tableRow?.id || !tableRow?.business_id) {
    throw new Error('Mesa no encontrada');
  }

  const businessId = String(tableRow.business_id);
  let nextOrderId = tableRow.current_order_id ? String(tableRow.current_order_id) : null;

  if (action === 'open') {
    if (!nextOrderId) {
      const { data: openOrderRow, error: openOrderError } = await client
        .from('orders')
        .select('id')
        .eq('business_id', businessId)
        .eq('table_id', tableId)
        .eq('status', 'open')
        .limit(1)
        .maybeSingle();

      if (!openOrderError && openOrderRow?.id) {
        nextOrderId = String(openOrderRow.id);
      }
    }

    if (!nextOrderId) {
      nextOrderId = await createOpenOrderLegacy({ businessId, tableId, userId });
    }

    await closeOpenOrdersLegacy({
      businessId,
      tableId,
      nextStatus: 'cancelled',
      excludeOrderId: nextOrderId,
    });

    const { error: updateTableError } = await client
      .from('tables')
      .update({
        current_order_id: nextOrderId,
        status: 'occupied',
      })
      .eq('id', tableId)
      .eq('business_id', businessId);

    if (updateTableError) throw updateTableError;
  } else {
    await closeOpenOrdersLegacy({
      businessId,
      tableId,
      nextStatus: 'closed',
    });

    const { error: updateTableError } = await client
      .from('tables')
      .update({
        current_order_id: null,
        status: 'available',
      })
      .eq('id', tableId)
      .eq('business_id', businessId);

    if (updateTableError) throw updateTableError;
  }

  return {
    id: String(tableRow.id),
    business_id: businessId,
    status: action === 'open' ? 'occupied' : 'available',
    current_order_id: action === 'open' ? nextOrderId : null,
    table_number: tableRow.table_number ?? null,
    name: tableRow.name ?? null,
    orders: null,
  };
}

export async function setPreferredBusinessId(businessId: string) {
  const normalized = String(businessId || '').trim();
  if (!normalized) return;
  await AsyncStorage.setItem(LAST_BUSINESS_ID_STORAGE_KEY, normalized);
}

export async function clearPreferredBusinessId() {
  await AsyncStorage.removeItem(LAST_BUSINESS_ID_STORAGE_KEY);
}

export function clearResolvedBusinessContextCache(userId?: string) {
  const normalizedUserId = String(userId || '').trim();
  if (normalizedUserId) {
    businessContextCacheByUserId.delete(normalizedUserId);
    businessContextInFlightByUserId.delete(normalizedUserId);
    return;
  }

  businessContextCacheByUserId.clear();
  businessContextInFlightByUserId.clear();
}

export async function resolveBusinessContext(
  userId: string,
  options?: { forceRefresh?: boolean },
): Promise<BusinessContext | null> {
  const normalizedUserId = String(userId || '').trim();
  if (!normalizedUserId) return null;
  const forceRefresh = options?.forceRefresh === true;

  if (!forceRefresh) {
    const cached = businessContextCacheByUserId.get(normalizedUserId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }
    const inFlight = businessContextInFlightByUserId.get(normalizedUserId);
    if (inFlight) return inFlight;
  }

  const resolver = (async (): Promise<BusinessContext | null> => {
    const client = getSupabaseClient();
    const rememberedBusinessId = normalizeReference(await AsyncStorage.getItem(LAST_BUSINESS_ID_STORAGE_KEY));

    if (businessContextRpcCompatibility !== 'unsupported') {
      const rpc = await client.rpc('resolve_mobile_business_context', {
        p_user_id: normalizedUserId,
        p_preferred_business_id: rememberedBusinessId,
      });

      if (!rpc.error) {
        businessContextRpcCompatibility = 'supported';
        const rpcRow = Array.isArray(rpc.data) ? rpc.data[0] : rpc.data;
        const candidate = normalizeBusinessContextCandidate(rpcRow ? {
          businessId: String(rpcRow.business_id || ''),
          businessName: rpcRow.business_name ?? null,
          source: String(rpcRow.source || '').trim().toLowerCase() === 'employee' ? 'employee' : 'owner',
          createdAt: rpcRow.created_at ?? null,
        } : null);

        if (candidate?.businessId) {
          await AsyncStorage.setItem(LAST_BUSINESS_ID_STORAGE_KEY, candidate.businessId);
          return candidate;
        }

        if (rememberedBusinessId) {
          await AsyncStorage.removeItem(LAST_BUSINESS_ID_STORAGE_KEY);
        }
        return null;
      }

      if (isMissingResolveMobileBusinessContextRpcError(rpc.error)) {
        businessContextRpcCompatibility = 'unsupported';
      }
    }

    if (rememberedBusinessId) {
      const rememberedCandidate = await resolveRememberedBusinessCandidate(
        client,
        normalizedUserId,
        rememberedBusinessId,
      );
      const rememberedContext = normalizeBusinessContextCandidate(rememberedCandidate);
      if (rememberedContext?.businessId) {
        return rememberedContext;
      }
      await AsyncStorage.removeItem(LAST_BUSINESS_ID_STORAGE_KEY);
    }

    const latestOwnedBusinessResult = await client
      .from('businesses')
      .select('id,name,created_at')
      .eq('created_by', normalizedUserId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestOwnedBusinessResult.error) throw latestOwnedBusinessResult.error;

    const latestOwnedBusiness = latestOwnedBusinessResult.data;

    if (latestOwnedBusiness?.id) {
      const normalizedOwned = normalizeBusinessContextCandidate({
        businessId: String(latestOwnedBusiness.id),
        businessName: latestOwnedBusiness.name || null,
        source: 'owner',
        createdAt: latestOwnedBusiness.created_at || null,
      });
      if (normalizedOwned?.businessId) {
        await AsyncStorage.setItem(LAST_BUSINESS_ID_STORAGE_KEY, normalizedOwned.businessId);
      }
      return normalizedOwned;
    }

    const latestEmployeeRowResult = await client
      .from('employees')
      .select('business_id,created_at')
      .eq('user_id', normalizedUserId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestEmployeeRowResult.error) throw latestEmployeeRowResult.error;

    const latestEmployeeRow = latestEmployeeRowResult.data;
    let selected: BusinessCandidate | null = null;

    if (latestEmployeeRow?.business_id) {
      const latestEmployeeBusinessId = String(latestEmployeeRow.business_id || '').trim();
      if (latestEmployeeBusinessId) {
        const latestEmployeeBusinessResult = await client
          .from('businesses')
          .select('id,name,created_at')
          .eq('id', latestEmployeeBusinessId)
          .limit(1)
          .maybeSingle();

        if (latestEmployeeBusinessResult.error) throw latestEmployeeBusinessResult.error;

        selected = {
          businessId: latestEmployeeBusinessId,
          businessName: latestEmployeeBusinessResult.data?.name || null,
          source: 'employee',
          createdAt: latestEmployeeRow.created_at || latestEmployeeBusinessResult.data?.created_at || null,
        };
      }
    }

    const normalized = normalizeBusinessContextCandidate(selected);
    if (normalized?.businessId) {
      await AsyncStorage.setItem(LAST_BUSINESS_ID_STORAGE_KEY, normalized.businessId);
    }

    return normalized;
  })();

  if (!forceRefresh) {
    businessContextInFlightByUserId.set(normalizedUserId, resolver);
  }

  try {
    const resolved = await resolver;
    businessContextCacheByUserId.set(normalizedUserId, {
      value: resolved,
      expiresAt: Date.now() + BUSINESS_CONTEXT_CACHE_TTL_MS,
    });
    return resolved;
  } finally {
    if (!forceRefresh) {
      businessContextInFlightByUserId.delete(normalizedUserId);
    }
  }
}

export async function fetchMesasByBusinessId(businessId: string): Promise<MesaRecord[]> {
  if (mesasSummaryFastRpcCompatibility !== 'unsupported') {
    try {
      const mesas = await fetchMesasWithOrderSummaryFastRpc(businessId);
      mesasSummaryFastRpcCompatibility = 'supported';
      return mesas;
    } catch (rpcError) {
      if (isMissingListTablesWithOrderSummaryFastRpcError(rpcError)) {
        mesasSummaryFastRpcCompatibility = 'unsupported';
      } else {
        throw rpcError;
      }
    }
  }

  if (mesasSummaryRpcCompatibility !== 'unsupported') {
    try {
      const mesas = await fetchMesasWithOrderSummaryRpc(businessId);
      mesasSummaryRpcCompatibility = 'supported';
      return mesas;
    } catch (rpcError) {
      if (isMissingListTablesWithOrderSummaryRpcError(rpcError)) {
        mesasSummaryRpcCompatibility = 'unsupported';
      } else {
        throw rpcError;
      }
    }
  }

  const initial = await fetchMesasWithSelect(businessId, true);
  if (!initial.error) {
    return (Array.isArray(initial.data) ? initial.data : []).map(normalizeMesaRow);
  }

  if (isMissingNameColumnError(initial.error)) {
    const fallback = await fetchMesasWithSelect(businessId, false);
    if (fallback.error) {
      throw fallback.error;
    }

    return (Array.isArray(fallback.data) ? fallback.data : []).map(normalizeMesaRow);
  }

  throw initial.error;
}

function buildMesaEditLockMap(rows: any[]): MesaEditLock[] {
  const nowTs = Date.now();
  return (Array.isArray(rows) ? rows : [])
    .map(normalizeMesaEditLock)
    .filter((lock) => {
      if (!lock.table_id || !lock.business_id || !lock.lock_owner_user_id) return false;
      if (!lock.lock_expires_at) return true;
      const expiresTs = Date.parse(lock.lock_expires_at);
      if (!Number.isFinite(expiresTs)) return true;
      return expiresTs > nowTs;
    });
}

async function selectMesaEditLockByTableId({
  businessId,
  tableId,
}: {
  businessId: string;
  tableId: string;
}): Promise<MesaEditLock | null> {
  const client = getSupabaseClient();
  const withToken = await client
    .from('table_edit_locks')
    .select('table_id,business_id,lock_owner_user_id,lock_owner_name,lock_token,lock_expires_at,updated_at')
    .eq('business_id', businessId)
    .eq('table_id', tableId)
    .maybeSingle();

  if (!withToken.error) {
    return withToken.data ? normalizeMesaEditLock(withToken.data) : null;
  }

  if (isMissingTableEditLocksColumnError(withToken.error, 'lock_token')) {
    const fallback = await client
      .from('table_edit_locks')
      .select('table_id,business_id,lock_owner_user_id,lock_owner_name,lock_expires_at,updated_at')
      .eq('business_id', businessId)
      .eq('table_id', tableId)
      .maybeSingle();

    if (fallback.error) {
      if (isMissingTableEditLocksRelationError(fallback.error)) return null;
      throw fallback.error;
    }

    return fallback.data ? normalizeMesaEditLock(fallback.data) : null;
  }

  if (isMissingTableEditLocksRelationError(withToken.error)) return null;
  throw withToken.error;
}

export async function resolveMesaEditorDisplayName({
  businessId,
  userId,
  fallbackName,
  forceRefresh = false,
}: {
  businessId: string;
  userId: string;
  fallbackName?: string | null;
  forceRefresh?: boolean;
}): Promise<string> {
  const fallback = normalizeDisplayName(fallbackName, 'Usuario');
  const normalizedBusinessId = String(businessId || '').trim();
  const normalizedUserId = String(userId || '').trim();
  if (!normalizedBusinessId || !normalizedUserId) return fallback;
  const cacheKey = mesaEditorDisplayNameCacheKey(normalizedBusinessId, normalizedUserId);

  if (!forceRefresh) {
    const cached = mesaEditorDisplayNameCacheByKey.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    const inFlight = mesaEditorDisplayNameInFlightByKey.get(cacheKey);
    if (inFlight) return inFlight;
  }

  const resolver = (async () => {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('employees')
      .select('full_name')
      .eq('business_id', normalizedBusinessId)
      .eq('user_id', normalizedUserId)
      .eq('is_active', true)
      .maybeSingle();

    if (error) return fallback;
    return normalizeDisplayName(data?.full_name, fallback);
  })();

  if (!forceRefresh) {
    mesaEditorDisplayNameInFlightByKey.set(cacheKey, resolver);
  }

  try {
    const resolved = await resolver;
    mesaEditorDisplayNameCacheByKey.set(cacheKey, {
      value: resolved,
      expiresAt: Date.now() + MESA_EDITOR_DISPLAY_NAME_CACHE_TTL_MS,
    });
    return resolved;
  } finally {
    if (!forceRefresh) {
      mesaEditorDisplayNameInFlightByKey.delete(cacheKey);
    }
  }
}

export async function listActiveMesaEditLocks(businessId: string): Promise<MesaEditLock[]> {
  const normalizedBusinessId = String(businessId || '').trim();
  if (!normalizedBusinessId) return [];

  const client = getSupabaseClient();
  const nowIso = new Date().toISOString();

  const withFilter = await client
    .from('table_edit_locks')
    .select('table_id,business_id,lock_owner_user_id,lock_owner_name,lock_token,lock_expires_at,updated_at')
    .eq('business_id', normalizedBusinessId)
    .gt('lock_expires_at', nowIso);

  if (!withFilter.error) {
    return buildMesaEditLockMap(Array.isArray(withFilter.data) ? withFilter.data : []);
  }

  if (isMissingTableEditLocksRelationError(withFilter.error)) {
    return [];
  }

  // Fallback for old schemas without lock_token and/or lock_expires_at.
  const missingToken = isMissingTableEditLocksColumnError(withFilter.error, 'lock_token');
  const missingExpires = isMissingTableEditLocksColumnError(withFilter.error, 'lock_expires_at');
  if (!missingToken && !missingExpires) {
    throw withFilter.error;
  }

  const fallbackSelectColumns = missingToken
    ? 'table_id,business_id,lock_owner_user_id,lock_owner_name,lock_expires_at,updated_at'
    : 'table_id,business_id,lock_owner_user_id,lock_owner_name,lock_token,lock_expires_at,updated_at';

  const fallbackQuery = client
    .from('table_edit_locks')
    .select(fallbackSelectColumns)
    .eq('business_id', normalizedBusinessId);

  if (!missingExpires) {
    fallbackQuery.gt('lock_expires_at', nowIso);
  }

  const fallback = await fallbackQuery;
  if (fallback.error) {
    if (isMissingTableEditLocksRelationError(fallback.error)) return [];
    throw fallback.error;
  }

  return buildMesaEditLockMap(Array.isArray(fallback.data) ? fallback.data : []);
}

export async function acquireMesaEditLock({
  businessId,
  tableId,
  userId,
  userName,
  ttlSeconds = 45,
}: {
  businessId: string;
  tableId: string;
  userId: string;
  userName: string;
  ttlSeconds?: number;
}): Promise<MesaEditLockAcquireResult> {
  const normalizedBusinessId = String(businessId || '').trim();
  const normalizedTableId = String(tableId || '').trim();
  const normalizedUserId = String(userId || '').trim();
  const normalizedUserName = normalizeDisplayName(userName, 'Usuario');

  if (!normalizedBusinessId || !normalizedTableId || !normalizedUserId) {
    return {
      ok: false,
      unsupported: false,
      lock: null,
      lockOwnerName: null,
      lockToken: null,
    };
  }

  const ttl = Number.isFinite(Number(ttlSeconds)) ? Math.max(15, Math.floor(Number(ttlSeconds))) : 45;
  const now = new Date();
  const nowIso = now.toISOString();
  const lockExpiresAt = new Date(now.getTime() + ttl * 1000).toISOString();
  const lockToken = createMesaLockToken();
  const client = getSupabaseClient();

  const cleanupExpired = await client
    .from('table_edit_locks')
    .delete()
    .eq('business_id', normalizedBusinessId)
    .eq('table_id', normalizedTableId)
    .lte('lock_expires_at', nowIso);

  if (cleanupExpired.error) {
    if (isMissingTableEditLocksRelationError(cleanupExpired.error)) {
      return {
        ok: true,
        unsupported: true,
        lock: null,
        lockOwnerName: null,
        lockToken: null,
      };
    }
    if (!isMissingTableEditLocksColumnError(cleanupExpired.error, 'lock_expires_at')) {
      throw cleanupExpired.error;
    }
  }

  const payloadWithToken = {
    business_id: normalizedBusinessId,
    table_id: normalizedTableId,
    lock_owner_user_id: normalizedUserId,
    lock_owner_name: normalizedUserName,
    lock_token: lockToken,
    lock_expires_at: lockExpiresAt,
    updated_at: nowIso,
  };

  const payloadNoToken = {
    business_id: normalizedBusinessId,
    table_id: normalizedTableId,
    lock_owner_user_id: normalizedUserId,
    lock_owner_name: normalizedUserName,
    lock_expires_at: lockExpiresAt,
    updated_at: nowIso,
  };

  const payloadLegacy = {
    business_id: normalizedBusinessId,
    table_id: normalizedTableId,
    lock_owner_user_id: normalizedUserId,
    lock_owner_name: normalizedUserName,
  };

  let inserted: MesaEditLock | null = null;
  let lockTokenSupported = true;

  const insertWithToken = await client
    .from('table_edit_locks')
    .insert([payloadWithToken])
    .select('table_id,business_id,lock_owner_user_id,lock_owner_name,lock_token,lock_expires_at,updated_at')
    .maybeSingle();

  if (!insertWithToken.error && insertWithToken.data) {
    inserted = normalizeMesaEditLock(insertWithToken.data);
  } else if (insertWithToken.error) {
    if (isMissingTableEditLocksRelationError(insertWithToken.error)) {
      return {
        ok: true,
        unsupported: true,
        lock: null,
        lockOwnerName: null,
        lockToken: null,
      };
    }

    if (isMissingTableEditLocksColumnError(insertWithToken.error, 'lock_token')) {
      lockTokenSupported = false;
      const fallbackInsert = await client
        .from('table_edit_locks')
        .insert([payloadNoToken])
        .select('table_id,business_id,lock_owner_user_id,lock_owner_name,lock_expires_at,updated_at')
        .maybeSingle();

      if (!fallbackInsert.error && fallbackInsert.data) {
        inserted = normalizeMesaEditLock(fallbackInsert.data);
      } else if (fallbackInsert.error) {
        if (
          isMissingTableEditLocksColumnError(fallbackInsert.error, 'lock_expires_at')
          || isMissingTableEditLocksColumnError(fallbackInsert.error, 'updated_at')
        ) {
          const legacyInsert = await client
            .from('table_edit_locks')
            .insert([payloadLegacy])
            .select('table_id,business_id,lock_owner_user_id,lock_owner_name')
            .maybeSingle();
          if (!legacyInsert.error && legacyInsert.data) {
            inserted = normalizeMesaEditLock(legacyInsert.data);
          } else if (legacyInsert.error && !isDuplicateKeyError(legacyInsert.error)) {
            throw legacyInsert.error;
          }
        } else if (!isDuplicateKeyError(fallbackInsert.error)) {
          throw fallbackInsert.error;
        }
      }
    } else if (
      !isDuplicateKeyError(insertWithToken.error)
      && !isMissingTableEditLocksColumnError(insertWithToken.error, 'lock_expires_at')
      && !isMissingTableEditLocksColumnError(insertWithToken.error, 'updated_at')
    ) {
      throw insertWithToken.error;
    } else if (
      isMissingTableEditLocksColumnError(insertWithToken.error, 'lock_expires_at')
      || isMissingTableEditLocksColumnError(insertWithToken.error, 'updated_at')
    ) {
      lockTokenSupported = false;
      const legacyInsert = await client
        .from('table_edit_locks')
        .insert([payloadLegacy])
        .select('table_id,business_id,lock_owner_user_id,lock_owner_name')
        .maybeSingle();
      if (!legacyInsert.error && legacyInsert.data) {
        inserted = normalizeMesaEditLock(legacyInsert.data);
      } else if (legacyInsert.error && !isDuplicateKeyError(legacyInsert.error)) {
        throw legacyInsert.error;
      }
    }
  }

  if (inserted) {
    return {
      ok: true,
      unsupported: false,
      lock: inserted,
      lockOwnerName: inserted.lock_owner_name,
      lockToken: lockTokenSupported ? lockToken : null,
    };
  }

  const existing = await selectMesaEditLockByTableId({
    businessId: normalizedBusinessId,
    tableId: normalizedTableId,
  });

  if (existing && existing.lock_owner_user_id === normalizedUserId) {
    const updatePayload = lockTokenSupported
      ? payloadWithToken
      : payloadNoToken;

    const updateAttempt = await client
      .from('table_edit_locks')
      .update(updatePayload)
      .eq('business_id', normalizedBusinessId)
      .eq('table_id', normalizedTableId)
      .eq('lock_owner_user_id', normalizedUserId)
      .select('table_id,business_id,lock_owner_user_id,lock_owner_name,lock_token,lock_expires_at,updated_at')
      .maybeSingle();

    if (!updateAttempt.error && updateAttempt.data) {
      const renewed = normalizeMesaEditLock(updateAttempt.data);
      return {
        ok: true,
        unsupported: false,
        lock: renewed,
        lockOwnerName: renewed.lock_owner_name,
        lockToken: lockTokenSupported ? lockToken : null,
      };
    }

    if (updateAttempt.error && isMissingTableEditLocksColumnError(updateAttempt.error, 'lock_token')) {
      const fallbackUpdate = await client
        .from('table_edit_locks')
        .update(payloadNoToken)
        .eq('business_id', normalizedBusinessId)
        .eq('table_id', normalizedTableId)
        .eq('lock_owner_user_id', normalizedUserId)
        .select('table_id,business_id,lock_owner_user_id,lock_owner_name,lock_expires_at,updated_at')
        .maybeSingle();

      if (!fallbackUpdate.error && fallbackUpdate.data) {
        const renewed = normalizeMesaEditLock(fallbackUpdate.data);
        return {
          ok: true,
          unsupported: false,
          lock: renewed,
          lockOwnerName: renewed.lock_owner_name,
          lockToken: null,
        };
      }
      if (fallbackUpdate.error) throw fallbackUpdate.error;
    }

    if (updateAttempt.error) throw updateAttempt.error;
  }

  return {
    ok: false,
    unsupported: false,
    lock: existing,
    lockOwnerName: existing?.lock_owner_name || 'Otro usuario',
    lockToken: null,
  };
}

export async function refreshMesaEditLockHeartbeat({
  businessId,
  tableId,
  userId,
  userName,
  lockToken,
  ttlSeconds = 45,
}: {
  businessId: string;
  tableId: string;
  userId: string;
  userName: string;
  lockToken?: string | null;
  ttlSeconds?: number;
}): Promise<MesaEditLockHeartbeatResult> {
  const normalizedBusinessId = String(businessId || '').trim();
  const normalizedTableId = String(tableId || '').trim();
  const normalizedUserId = String(userId || '').trim();
  const normalizedUserName = normalizeDisplayName(userName, 'Usuario');
  const normalizedLockToken = normalizeReference(lockToken);

  if (!normalizedBusinessId || !normalizedTableId || !normalizedUserId) {
    return { ok: false, unsupported: false, lock: null, lockOwnerName: null, lost: true };
  }

  const ttl = Number.isFinite(Number(ttlSeconds)) ? Math.max(15, Math.floor(Number(ttlSeconds))) : 45;
  const now = new Date();
  const payload: Record<string, any> = {
    lock_owner_name: normalizedUserName,
    lock_expires_at: new Date(now.getTime() + ttl * 1000).toISOString(),
    updated_at: now.toISOString(),
  };

  if (normalizedLockToken) {
    payload.lock_token = normalizedLockToken;
  }

  const client = getSupabaseClient();
  let query = client
    .from('table_edit_locks')
    .update(payload)
    .eq('business_id', normalizedBusinessId)
    .eq('table_id', normalizedTableId)
    .eq('lock_owner_user_id', normalizedUserId);

  if (normalizedLockToken) {
    query = query.eq('lock_token', normalizedLockToken);
  }

  const withToken = await query
    .select('table_id,business_id,lock_owner_user_id,lock_owner_name,lock_token,lock_expires_at,updated_at')
    .maybeSingle();

  if (!withToken.error && withToken.data) {
    const lock = normalizeMesaEditLock(withToken.data);
    return {
      ok: true,
      unsupported: false,
      lock,
      lockOwnerName: lock.lock_owner_name,
      lost: false,
    };
  }

  if (withToken.error && isMissingTableEditLocksRelationError(withToken.error)) {
    return { ok: true, unsupported: true, lock: null, lockOwnerName: null, lost: false };
  }

  if (withToken.error && isMissingTableEditLocksColumnError(withToken.error, 'lock_token')) {
    const fallbackUpdate = await client
      .from('table_edit_locks')
      .update({
        lock_owner_name: normalizedUserName,
        lock_expires_at: payload.lock_expires_at,
        updated_at: payload.updated_at,
      })
      .eq('business_id', normalizedBusinessId)
      .eq('table_id', normalizedTableId)
      .eq('lock_owner_user_id', normalizedUserId)
      .select('table_id,business_id,lock_owner_user_id,lock_owner_name,lock_expires_at,updated_at')
      .maybeSingle();

    if (!fallbackUpdate.error && fallbackUpdate.data) {
      const lock = normalizeMesaEditLock(fallbackUpdate.data);
      return {
        ok: true,
        unsupported: false,
        lock,
        lockOwnerName: lock.lock_owner_name,
        lost: false,
      };
    }

    if (fallbackUpdate.error && isMissingTableEditLocksColumnError(fallbackUpdate.error, 'lock_expires_at')) {
      const legacyUpdate = await client
        .from('table_edit_locks')
        .update({
          lock_owner_name: normalizedUserName,
        })
        .eq('business_id', normalizedBusinessId)
        .eq('table_id', normalizedTableId)
        .eq('lock_owner_user_id', normalizedUserId)
        .select('table_id,business_id,lock_owner_user_id,lock_owner_name')
        .maybeSingle();

      if (!legacyUpdate.error && legacyUpdate.data) {
        const lock = normalizeMesaEditLock(legacyUpdate.data);
        return {
          ok: true,
          unsupported: false,
          lock,
          lockOwnerName: lock.lock_owner_name,
          lost: false,
        };
      }
    }
  }

  const existing = await selectMesaEditLockByTableId({
    businessId: normalizedBusinessId,
    tableId: normalizedTableId,
  });

  if (existing && existing.lock_owner_user_id !== normalizedUserId) {
    return {
      ok: false,
      unsupported: false,
      lock: existing,
      lockOwnerName: existing.lock_owner_name,
      lost: true,
    };
  }

  if (!existing) {
    return {
      ok: false,
      unsupported: false,
      lock: null,
      lockOwnerName: null,
      lost: true,
    };
  }

  return {
    ok: false,
    unsupported: false,
    lock: existing,
    lockOwnerName: existing.lock_owner_name,
    lost: true,
  };
}

export async function releaseMesaEditLock({
  businessId,
  tableId,
  userId,
  lockToken,
}: {
  businessId: string;
  tableId: string;
  userId: string;
  lockToken?: string | null;
}): Promise<void> {
  const normalizedBusinessId = String(businessId || '').trim();
  const normalizedTableId = String(tableId || '').trim();
  const normalizedUserId = String(userId || '').trim();
  if (!normalizedBusinessId || !normalizedTableId || !normalizedUserId) return;

  const client = getSupabaseClient();
  let query = client
    .from('table_edit_locks')
    .delete()
    .eq('business_id', normalizedBusinessId)
    .eq('table_id', normalizedTableId)
    .eq('lock_owner_user_id', normalizedUserId);

  const normalizedLockToken = normalizeReference(lockToken);
  if (normalizedLockToken) {
    query = query.eq('lock_token', normalizedLockToken);
  }

  const withToken = await query;
  if (!withToken.error) return;

  if (isMissingTableEditLocksRelationError(withToken.error)) return;
  if (isMissingTableEditLocksColumnError(withToken.error, 'lock_token')) {
    const fallback = await client
      .from('table_edit_locks')
      .delete()
      .eq('business_id', normalizedBusinessId)
      .eq('table_id', normalizedTableId)
      .eq('lock_owner_user_id', normalizedUserId);
    if (!fallback.error) return;
    if (isMissingTableEditLocksRelationError(fallback.error)) return;
    throw fallback.error;
  }

  throw withToken.error;
}

function isMissingUpdatedAtOnTablesError(errorLike: any) {
  const message = String(errorLike?.message || '').toLowerCase();
  return (
    message.includes('column')
    && message.includes('"updated_at"')
    && message.includes('relation')
    && message.includes('"tables"')
    && message.includes('does not exist')
  );
}

function isMissingOpenedAtOnTablesError(errorLike: any) {
  const message = String(errorLike?.message || '').toLowerCase();
  return (
    message.includes('column')
    && message.includes('"opened_at"')
    && message.includes('relation')
    && message.includes('"tables"')
    && message.includes('does not exist')
  );
}

function formatErrorMessage(errorLike: unknown, fallback = 'Operacion fallida'): string {
  if (errorLike instanceof Error) {
    const message = String(errorLike.message || '').trim();
    return message || fallback;
  }

  if (typeof errorLike === 'string') {
    const message = errorLike.trim();
    return message || fallback;
  }

  if (!errorLike || typeof errorLike !== 'object') {
    return fallback;
  }

  const candidate = errorLike as {
    message?: unknown;
    error?: unknown;
    details?: unknown;
    hint?: unknown;
    code?: unknown;
  };

  const parts = [
    candidate.message,
    candidate.error,
    candidate.details,
    candidate.hint,
    candidate.code ? `code=${String(candidate.code)}` : null,
  ]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean);

  if (parts.length > 0) return parts.join(' | ');

  try {
    return JSON.stringify(errorLike);
  } catch {
    return fallback;
  }
}

function normalizeTableIdentifier(value: string | number): string {
  return String(value ?? '').trim();
}

function isInvalidIntegerTableNumberError(errorLike: any) {
  const code = String(errorLike?.code || '').trim();
  const message = String(errorLike?.message || '').toLowerCase();
  const details = String(errorLike?.details || '').toLowerCase();
  return (
    code === '22P02'
    && (
      message.includes('table_number')
      || details.includes('table_number')
      || message.includes('integer')
      || details.includes('integer')
    )
  );
}

async function insertMesaWithFallbackSelect({
  businessId,
  tableNumber,
}: {
  businessId: string;
  tableNumber: string | number;
}): Promise<MesaRecord> {
  const client = getSupabaseClient();

  const withName = await client
    .from('tables')
    .insert([
      {
        business_id: businessId,
        table_number: tableNumber,
        status: 'available',
      },
    ])
    .select('id,business_id,table_number,name,status,current_order_id')
    .single();

  if (!withName.error) {
    return normalizeMesaRow(withName.data);
  }

  if (isMissingNameColumnError(withName.error)) {
    const withoutName = await client
      .from('tables')
      .insert([
        {
          business_id: businessId,
          table_number: tableNumber,
          status: 'available',
        },
      ])
      .select('id,business_id,table_number,status,current_order_id')
      .single();

    if (withoutName.error) throw withoutName.error;
    return normalizeMesaRow(withoutName.data);
  }

  throw withName.error;
}

export async function createMesa({
  businessId,
  tableNumber,
}: {
  businessId: string;
  tableNumber: string | number;
}): Promise<MesaRecord> {
  const normalizedIdentifier = normalizeTableIdentifier(tableNumber);
  if (!normalizedIdentifier) {
    throw new Error('Ingresa un identificador de mesa valido.');
  }

  try {
    return await insertMesaWithFallbackSelect({
      businessId,
      tableNumber: normalizedIdentifier,
    });
  } catch (firstError: any) {
    // Some DBs still keep table_number as integer. If user entered only digits, retry as number.
    if (isInvalidIntegerTableNumberError(firstError) && /^\d+$/.test(normalizedIdentifier)) {
      return insertMesaWithFallbackSelect({
        businessId,
        tableNumber: Number(normalizedIdentifier),
      });
    }
    throw firstError;
  }
}

export async function deleteMesaCascade({
  businessId,
  tableId,
}: {
  businessId: string;
  tableId: string;
}): Promise<void> {
  const client = getSupabaseClient();

  const release = await client
    .from('tables')
    .update({
      current_order_id: null,
      status: 'available',
    })
    .eq('id', tableId)
    .eq('business_id', businessId);

  if (release.error && !isMissingUpdatedAtOnTablesError(release.error)) {
    throw release.error;
  }

  const deleteOrders = await client
    .from('orders')
    .delete()
    .eq('business_id', businessId)
    .eq('table_id', tableId);

  if (deleteOrders.error) throw deleteOrders.error;

  const deleteTable = await client
    .from('tables')
    .delete()
    .eq('id', tableId)
    .eq('business_id', businessId);

  if (deleteTable.error) throw deleteTable.error;
}

export async function openCloseMesa({
  accessToken,
  userId,
  tableId,
  action,
}: {
  accessToken: string;
  userId: string;
  tableId: string;
  action: 'open' | 'close';
}): Promise<MesaRecord> {
  const requestBody = JSON.stringify({
    table_id: tableId,
    action,
  });
  const client = getSupabaseClient();

  async function requestViaApi(route: '/api/v2/open-close-table' | '/api/open-close-table') {
    const response = await fetch(`${EXPO_CONFIG.apiBaseUrl}${route}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'X-Stocky-Client': 'mobile',
        'X-Stocky-Client-Version': EXPO_CONFIG.clientVersion,
      },
      body: requestBody,
    });

    const raw = await response.text();
    let payload: any = null;
    try {
      payload = raw ? JSON.parse(raw) : null;
    } catch {
      payload = { error: raw || 'Unexpected response' };
    }

    if (!response.ok) {
      throw new Error(
        formatErrorMessage(
          payload?.error ?? payload?.message,
          `Request failed (${response.status})`,
        ),
      );
    }

    if (!payload?.data?.id) {
      throw new Error('Invalid API response for open/close table');
    }

    return normalizeMesaRow(payload.data);
  }

  try {
    if (openCloseRpcCompatibility !== 'unsupported') {
      // Ruta rápida para mobile: RPC directo en Supabase.
      const { data, error } = await client.rpc('open_close_table_transaction', {
        p_table_id: tableId,
        p_action: action,
        p_user_id: userId,
      });

      if (!error) {
        openCloseRpcCompatibility = 'supported';
        const rawRpcRow = Array.isArray(data) ? data[0] : data;
        if (!rawRpcRow?.id) {
          throw new Error('RPC fallback returned invalid response');
        }
        return normalizeMesaRow(rawRpcRow);
      }

      if (
        isMissingOpenedAtOnTablesError(error)
        || isMissingUpdatedAtOnTablesError(error)
        || isMissingNameColumnError(error)
      ) {
        openCloseRpcCompatibility = 'unsupported';
      }
    }

    // Fallback inmediato a estrategia legacy cuando RPC no está disponible/compatible.
    try {
      return await runLegacyOpenCloseWithSupabaseClient({
        tableId,
        action,
        userId,
      });
    } catch (legacyError) {
      if (openCloseRpcCompatibility === 'unsupported') {
        throw new Error(formatErrorMessage(legacyError, 'No se pudo abrir/cerrar la mesa'));
      }

      // Fallback final vía API para mantener compatibilidad con entornos intermedios.
      try {
        return await requestViaApi('/api/v2/open-close-table');
      } catch (firstError) {
        try {
          return await requestViaApi('/api/open-close-table');
        } catch (secondError) {
          const legacyMessage = formatErrorMessage(legacyError, 'Legacy fallback failed');
          const apiV2Message = formatErrorMessage(firstError, 'API v2 failed');
          const apiLegacyMessage = formatErrorMessage(secondError, 'API legacy failed');
          throw new Error(
            `Legacy fallback failed: ${legacyMessage} | API v2 failed: ${apiV2Message} | API legacy failed: ${apiLegacyMessage}`,
          );
        }
      }
    }
  } catch (fatalError) {
    throw new Error(formatErrorMessage(fatalError, 'No se pudo abrir/cerrar la mesa'));
  }
}

const COP_FORMATTER = new Intl.NumberFormat('es-CO', {
  maximumFractionDigits: 0,
});

export function formatCopAmount(value: number | null | undefined): string {
  const amount = Number(value || 0);
  const absoluteAmount = Math.abs(Math.round(amount));
  const formattedAmount = COP_FORMATTER.format(absoluteAmount);
  const sign = amount < 0 ? '-' : '';
  return `${sign}$ ${formattedAmount}`;
}

export function formatCop(value: number | null | undefined): string {
  return `${formatCopAmount(value)} COP`;
}
