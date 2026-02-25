import { supabaseAdapter } from '../data/adapters/supabaseAdapter.js';
import { buildUtcRangeFromLocalDates } from '../utils/dateRange.js';
import LOCAL_SYNC_CONFIG from '../config/localSync.js';
import { getLocalDbClient } from '../localdb/client.js';
import { logger } from '../utils/logger.js';

const PURCHASE_LIST_COLUMNS = `
  id,
  business_id,
  user_id,
  supplier_id,
  payment_method,
  notes,
  total,
  created_at
`;
const PURCHASE_LIST_MINIMAL_COLUMNS = `
  id,
  business_id,
  user_id,
  supplier_id,
  payment_method,
  notes,
  total,
  created_at
`;

const RPC_NOT_AVAILABLE = 'RPC_NOT_AVAILABLE';
const CONNECTIVITY_ERROR_MESSAGE = 'Sin conexión. Verifica tu internet y vuelve a intentar.';

function buildPurchasesListCacheKey({ businessId, filters = {}, pagination = {} }) {
  return [
    'purchases',
    'list',
    businessId,
    JSON.stringify({
      fromDate: filters?.fromDate || null,
      toDate: filters?.toDate || null,
      supplierId: filters?.supplierId || null,
      userId: filters?.userId || null,
      minAmount: filters?.minAmount ?? null,
      maxAmount: filters?.maxAmount ?? null,
      limit: Number(pagination?.limit || 50),
      offset: Number(pagination?.offset || 0),
      includeCount: pagination?.includeCount !== false,
      countMode: pagination?.countMode || 'planned'
    })
  ].join(':');
}

async function readCachedPurchasesList(cacheKey) {
  if (!LOCAL_SYNC_CONFIG.enabled || !LOCAL_SYNC_CONFIG.localReads?.purchases) return null;
  try {
    const db = getLocalDbClient();
    await db.init();
    const exact = await db.getCacheEntry(cacheKey);
    if (exact) return exact;

    const keyParts = String(cacheKey || '').split(':');
    const businessId = keyParts[2] || '';
    if (businessId) {
      const fallbackByBusiness = await db.getLatestCacheEntryByPrefix(`purchases:list:${businessId}:`);
      if (fallbackByBusiness) return fallbackByBusiness;
    }
    return null;
  } catch (error) {
    logger.warn('[purchases-service] cache read failed', {
      cacheKey,
      error: error?.message || String(error)
    });
    return null;
  }
}

async function writeCachedPurchasesList(cacheKey, payload) {
  if (!LOCAL_SYNC_CONFIG.enabled || !LOCAL_SYNC_CONFIG.localReads?.purchases) return;
  try {
    const db = getLocalDbClient();
    await db.init();
    await db.setCacheEntry(cacheKey, payload);
  } catch (error) {
    logger.warn('[purchases-service] cache write failed', {
      cacheKey,
      error: error?.message || String(error)
    });
  }
}

function isMissingRpcError(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || '').toLowerCase();
  return code === 'PGRST202' || code === '42883' || message.includes('get_purchases_enriched');
}

function isRpcBadRequestError(errorLike) {
  const status = Number(errorLike?.status || errorLike?.statusCode || 0);
  const code = String(errorLike?.code || '').toUpperCase();
  return status === 400 || code === 'PGRST100' || code === 'PGRST116' || code === 'PGRST301';
}

function isMissingColumnError(errorLike) {
  const message = String(errorLike?.message || errorLike || '').toLowerCase();
  return message.includes('column') && message.includes('does not exist');
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

function mapRpcPurchaseRows(rows = []) {
  return rows.map((row) => {
    const employeeRole = row.employee_role || 'employee';
    const isOwner = !!row.is_owner;
    const isAdmin = employeeRole === 'admin';

    return {
      id: row.id,
      business_id: row.business_id,
      user_id: row.user_id,
      supplier_id: row.supplier_id,
      payment_method: row.payment_method,
      notes: row.notes,
      total: row.total,
      created_at: row.created_at,
      supplier: {
        business_name: row.supplier_business_name || null,
        contact_name: row.supplier_contact_name || null
      },
      employees: isOwner
        ? { full_name: 'Administrador', role: 'owner' }
        : isAdmin
        ? { full_name: 'Administrador', role: 'admin' }
        : { full_name: row.employee_full_name || 'Responsable desconocido', role: employeeRole }
    };
  });
}

async function getFilteredPurchasesViaRpc(businessId, filters, pagination) {
  const includeCount = pagination.includeCount !== false;
  const limit = Number(pagination.limit || 50);
  const offset = Number(pagination.offset || 0);

  const { fromIso: fromDateIso, toIso: toDateIso } = buildUtcRangeFromLocalDates(
    filters.fromDate,
    filters.toDate
  );

  const { data, error } = await supabaseAdapter.getPurchasesEnrichedRpc({
    p_business_id: businessId,
    p_limit: limit,
    p_offset: offset,
    p_from_date: fromDateIso,
    p_to_date: toDateIso,
    p_supplier_id: filters.supplierId || null,
    p_user_id: filters.userId || null,
    p_min_amount: filters.minAmount ?? null,
    p_max_amount: filters.maxAmount ?? null,
    p_include_count: includeCount
  });

  if (error) {
    if (isMissingRpcError(error)) {
      throw new Error(RPC_NOT_AVAILABLE);
    }
    throw error;
  }

  const rows = data || [];
  const mapped = mapRpcPurchaseRows(rows);
  const count = includeCount ? Number(rows[0]?.total_count || 0) : null;

  return { data: mapped, count };
}

async function getFilteredPurchasesLegacy(businessId, filters, pagination) {
  const includeCount = pagination.includeCount !== false;
  const countMode = pagination.countMode || 'planned';
  const limit = Number(pagination.limit || 50);
  const offset = Number(pagination.offset || 0);

  const { fromIso: fromDateIso, toIso: toDateIso } = buildUtcRangeFromLocalDates(
    filters.fromDate,
    filters.toDate
  );

  const queryParams = {
    businessId,
    fromDateIso,
    toDateIso,
    supplierId: filters.supplierId || null,
    userId: filters.userId || null,
    minAmount: filters.minAmount ?? null,
    maxAmount: filters.maxAmount ?? null,
    limit,
    offset,
    includeCount,
    countMode
  };

  const primary = await supabaseAdapter.getFilteredPurchasesLegacy({
    ...queryParams,
    selectSql: PURCHASE_LIST_COLUMNS
  });
  if (primary.error) {
    if (!isMissingColumnError(primary.error)) throw primary.error;
    const fallback = await supabaseAdapter.getFilteredPurchasesLegacy({
      ...queryParams,
      selectSql: PURCHASE_LIST_MINIMAL_COLUMNS
    });
    if (fallback.error) throw fallback.error;
    return { data: fallback.data || [], count: includeCount ? (fallback.count || 0) : null };
  }

  return { data: primary.data || [], count: includeCount ? (primary.count || 0) : null };
}

/**
 * Obtiene compras aplicando filtros en la base de datos.
 * @param {string} businessId
 * @param {object} filters - { fromDate, toDate, supplierId, userId, minAmount, maxAmount }
 * @param {object} pagination - { limit = 50, offset = 0 }
 */
export async function getFilteredPurchases(businessId, filters = {}, pagination = {}) {
  if (!businessId) return { data: [], count: 0, error: null };
  const cacheKey = buildPurchasesListCacheKey({
    businessId,
    filters,
    pagination
  });
  const offlineRuntime = typeof navigator !== 'undefined' && navigator.onLine === false;

  if (offlineRuntime) {
    const cached = await readCachedPurchasesList(cacheKey);
    if (cached && Array.isArray(cached?.data)) {
      return {
        data: cached.data,
        count: Number.isFinite(Number(cached?.count)) ? Number(cached.count) : 0,
        error: null
      };
    }
    return { data: [], count: 0, error: null };
  }

  try {
    const rpcResult = await getFilteredPurchasesViaRpc(businessId, filters, pagination);
    await writeCachedPurchasesList(cacheKey, rpcResult);
    return { ...rpcResult, error: null };
  } catch (rpcError) {
    if (isMissingRpcError(rpcError) || isRpcBadRequestError(rpcError)) {
      logger.warn('[purchases-service] falling back from get_purchases_enriched RPC', {
        code: rpcError?.code || null,
        status: rpcError?.status || rpcError?.statusCode || null,
        message: rpcError?.message || String(rpcError)
      });
    }
    try {
      const legacyResult = await getFilteredPurchasesLegacy(businessId, filters, pagination);
      await writeCachedPurchasesList(cacheKey, legacyResult);
      return { ...legacyResult, error: null };
    } catch (legacyError) {
      if (isConnectivityError(legacyError) || isConnectivityError(rpcError)) {
        const cached = await readCachedPurchasesList(cacheKey);
        if (cached && Array.isArray(cached?.data)) {
          return {
            data: cached.data,
            count: Number.isFinite(Number(cached?.count)) ? Number(cached.count) : 0,
            error: null
          };
        }
        return { data: [], count: 0, error: CONNECTIVITY_ERROR_MESSAGE };
      }
      const normalizedError = legacyError?.message || rpcError?.message || 'Error al obtener compras';
      return { data: [], count: 0, error: normalizedError };
    }
  }
}

export default { getFilteredPurchases };
