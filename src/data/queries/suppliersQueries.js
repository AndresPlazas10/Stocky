import { readAdapter } from '../adapters/localAdapter';
import { supabaseAdapter } from '../adapters/supabaseAdapter.js';

const BASE_SUPPLIER_COLUMNS = 'id, business_id, business_name, contact_name, email, phone, address, notes, created_at';

export function isMissingSupplierColumnError(err, columnName) {
  const text = `${err?.message || ''} ${err?.details || ''} ${err?.hint || ''}`.toLowerCase();
  return (
    err?.code === '42703'
    || err?.code === 'PGRST204'
    || (text.includes('column') && text.includes(String(columnName || '').toLowerCase()))
  );
}

export async function getSuppliersForManagement({
  businessId,
  preferredTaxColumn = 'nit'
}) {
  const candidates = preferredTaxColumn === 'nit' ? ['nit', 'tax_id'] : ['tax_id', 'nit'];
  let data = null;
  let lastError = null;
  let resolvedTaxColumn = preferredTaxColumn;

  for (const column of candidates) {
    const result = await readAdapter.getSuppliersByBusinessWithSelect(
      businessId,
      `${BASE_SUPPLIER_COLUMNS}, ${column}`
    );

    if (!result?.error) {
      data = result?.data || [];
      resolvedTaxColumn = column;
      lastError = null;
      break;
    }

    lastError = result.error;
    if (!isMissingSupplierColumnError(result.error, column)) break;
  }

  if (lastError) throw lastError;

  return {
    suppliers: (data || []).map((supplier) => ({
      ...supplier,
      nit: supplier?.nit ?? supplier?.tax_id ?? null
    })),
    taxColumn: resolvedTaxColumn
  };
}

export async function getSuppliersForManagementPage({
  businessId,
  preferredTaxColumn = 'nit',
  limit = 50,
  offset = 0
}) {
  const candidates = preferredTaxColumn === 'nit' ? ['nit', 'tax_id'] : ['tax_id', 'nit'];
  let data = null;
  let lastError = null;
  let resolvedTaxColumn = preferredTaxColumn;

  for (const column of candidates) {
    const result = await supabaseAdapter.getPaginatedTableRows({
      tableName: 'suppliers',
      selectSql: `${BASE_SUPPLIER_COLUMNS}, ${column}`,
      filters: { business_id: businessId },
      orderBy: { column: 'created_at', ascending: false },
      from: offset,
      to: offset + limit - 1,
      countMode: null
    });

    if (!result?.error) {
      data = result?.data || [];
      resolvedTaxColumn = column;
      lastError = null;
      break;
    }

    lastError = result.error;
    if (!isMissingSupplierColumnError(result.error, column)) break;
  }

  if (lastError) throw lastError;

  const normalized = (data || []).map((supplier) => ({
    ...supplier,
    nit: supplier?.nit ?? supplier?.tax_id ?? null
  }));

  return {
    suppliers: normalized,
    taxColumn: resolvedTaxColumn,
    hasMore: (data || []).length === limit
  };
}
