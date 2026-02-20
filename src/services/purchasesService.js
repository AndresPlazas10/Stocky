import { supabase } from '../supabase/Client';
import { buildUtcRangeFromLocalDates } from '../utils/dateRange.js';

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

const RPC_NOT_AVAILABLE = 'RPC_NOT_AVAILABLE';

function isMissingRpcError(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || '').toLowerCase();
  return code === 'PGRST202' || code === '42883' || message.includes('get_purchases_enriched');
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

  const { data, error } = await supabase.rpc('get_purchases_enriched', {
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

  let query = includeCount
    ? supabase.from('purchases').select(PURCHASE_LIST_COLUMNS, { count: countMode })
    : supabase.from('purchases').select(PURCHASE_LIST_COLUMNS);

  query = query.eq('business_id', businessId).order('created_at', { ascending: false });

  const { fromIso: fromDateIso, toIso: toDateIso } = buildUtcRangeFromLocalDates(
    filters.fromDate,
    filters.toDate
  );
  if (fromDateIso) query = query.gte('created_at', fromDateIso);
  if (toDateIso) query = query.lte('created_at', toDateIso);

  if (filters.supplierId) query = query.eq('supplier_id', filters.supplierId);
  if (filters.userId) query = query.eq('user_id', filters.userId);
  if (filters.minAmount) query = query.gte('total', filters.minAmount);
  if (filters.maxAmount) query = query.lte('total', filters.maxAmount);

  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) throw error;

  return { data: data || [], count: includeCount ? (count || 0) : null };
}

/**
 * Obtiene compras aplicando filtros en la base de datos.
 * @param {string} businessId
 * @param {object} filters - { fromDate, toDate, supplierId, userId, minAmount, maxAmount }
 * @param {object} pagination - { limit = 50, offset = 0 }
 */
export async function getFilteredPurchases(businessId, filters = {}, pagination = {}) {
  if (!businessId) return { data: [], count: 0, error: null };

  try {
    const rpcResult = await getFilteredPurchasesViaRpc(businessId, filters, pagination);
    return { ...rpcResult, error: null };
  } catch (rpcError) {
    try {
      const legacyResult = await getFilteredPurchasesLegacy(businessId, filters, pagination);
      return { ...legacyResult, error: null };
    } catch (legacyError) {
      const normalizedError = legacyError?.message || rpcError?.message || 'Error al obtener compras';
      return { data: [], count: 0, error: normalizedError };
    }
  }
}

export default { getFilteredPurchases };
