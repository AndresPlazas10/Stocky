import { readAdapter } from '../adapters/localAdapter';
import { supabaseAdapter } from '../adapters/supabaseAdapter';
import type { Supplier } from '../../types';

const BASE_SUPPLIER_COLUMNS = 'id, business_id, business_name, contact_name, email, phone, address, notes, created_at';

interface SupplierError {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}

export function isMissingSupplierColumnError(err: unknown, columnName: string): boolean {
  const e = err as SupplierError;
  const text = `${e?.message || ''} ${e?.details || ''} ${e?.hint || ''}`.toLowerCase();
  return (
    e?.code === '42703'
    || e?.code === 'PGRST204'
    || (text.includes('column') && text.includes(String(columnName || '').toLowerCase()))
  );
}

interface SupplierWithNit extends Supplier {
  nit: string | null;
  tax_id?: string | null;
}

interface SuppliersManagementResult {
  suppliers: SupplierWithNit[];
  taxColumn: string;
}

export async function getSuppliersForManagement({
  businessId,
  preferredTaxColumn = 'nit'
}: {
  businessId: string;
  preferredTaxColumn?: string;
}): Promise<SuppliersManagementResult> {
  const candidates = preferredTaxColumn === 'nit' ? ['nit', 'tax_id'] : ['tax_id', 'nit'];
  let data: SupplierWithNit[] | null = null;
  let lastError: unknown = null;
  let resolvedTaxColumn = preferredTaxColumn;

  for (const column of candidates) {
    const result = await readAdapter.getSuppliersByBusinessWithSelect(
      businessId,
      `${BASE_SUPPLIER_COLUMNS}, ${column}`
    );

    if (!result?.error) {
      data = ((result?.data || []) as unknown as Record<string, unknown>[]).map((row) => ({
        id: String(row.id || ''),
        business_id: String(row.business_id || ''),
        business_name: String(row.business_name || ''),
        contact_name: row.contact_name as string | null,
        nit: (row.nit ?? row.tax_id ?? null) as string | null,
        tax_id: row.tax_id as string | null,
        phone: row.phone as string | null,
        email: row.email as string | null,
        address: row.address as string | null,
        is_active: row.is_active !== false,
        created_at: String(row.created_at || '')
      }));
      resolvedTaxColumn = column;
      lastError = null;
      break;
    }

    lastError = result.error;
    if (!isMissingSupplierColumnError(result.error, column)) break;
  }

  if (lastError) throw lastError;

  return {
    suppliers: data || [],
    taxColumn: resolvedTaxColumn
  };
}

interface SuppliersManagementPageResult extends SuppliersManagementResult {
  hasMore: boolean;
}

export async function getSuppliersForManagementPage({
  businessId,
  preferredTaxColumn = 'nit',
  limit = 50,
  offset = 0
}: {
  businessId: string;
  preferredTaxColumn?: string;
  limit?: number;
  offset?: number;
}): Promise<SuppliersManagementPageResult> {
  const candidates = preferredTaxColumn === 'nit' ? ['nit', 'tax_id'] : ['tax_id', 'nit'];
  let data: SupplierWithNit[] | null = null;
  let lastError: unknown = null;
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
      data = ((result?.data || []) as unknown as Record<string, unknown>[]).map((row) => ({
        id: String(row.id || ''),
        business_id: String(row.business_id || ''),
        business_name: String(row.business_name || ''),
        contact_name: row.contact_name as string | null,
        nit: (row.nit ?? row.tax_id ?? null) as string | null,
        tax_id: row.tax_id as string | null,
        phone: row.phone as string | null,
        email: row.email as string | null,
        address: row.address as string | null,
        is_active: row.is_active !== false,
        created_at: String(row.created_at || '')
      }));
      resolvedTaxColumn = column;
      lastError = null;
      break;
    }

    lastError = result.error;
    if (!isMissingSupplierColumnError(result.error, column)) break;
  }

  if (lastError) throw lastError;

  const normalized = data || [];

  return {
    suppliers: normalized,
    taxColumn: resolvedTaxColumn,
    hasMore: (data || []).length === limit
  };
}
