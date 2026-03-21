import { getSupabaseClient } from '../lib/supabase';

const BASE_SUPPLIER_COLUMNS = 'id,business_id,business_name,contact_name,email,phone,address,notes,created_at';

export type SupplierTaxColumn = 'nit' | 'tax_id';

export type ProveedorRecord = {
  id: string;
  business_id: string;
  business_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  nit: string | null;
  created_at: string | null;
};

export type ProveedorFormPayload = {
  business_name: string;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  nit?: string | null;
};

function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeReference(value: unknown): string | null {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  const lower = normalized.toLowerCase();
  if (lower === 'null' || lower === 'undefined') return null;
  return normalized;
}

function isMissingSupplierColumnError(err: any, columnName: string): boolean {
  const text = `${err?.message || ''} ${err?.details || ''} ${err?.hint || ''}`.toLowerCase();
  return (
    err?.code === '42703'
    || err?.code === 'PGRST204'
    || (text.includes('column') && text.includes(String(columnName || '').toLowerCase()))
  );
}

function buildSupplierPayload({
  formData,
  taxColumn,
}: {
  formData: ProveedorFormPayload;
  taxColumn: SupplierTaxColumn;
}) {
  return {
    business_name: normalizeText(formData.business_name),
    contact_name: normalizeReference(formData.contact_name),
    email: normalizeReference(formData.email),
    phone: normalizeReference(formData.phone),
    address: normalizeReference(formData.address),
    notes: normalizeReference(formData.notes),
    [taxColumn]: normalizeReference(formData.nit),
  };
}

function normalizeProveedor(row: any): ProveedorRecord {
  return {
    id: normalizeText(row?.id),
    business_id: normalizeText(row?.business_id),
    business_name: normalizeText(row?.business_name) || 'Proveedor',
    contact_name: normalizeReference(row?.contact_name),
    email: normalizeReference(row?.email),
    phone: normalizeReference(row?.phone),
    address: normalizeReference(row?.address),
    notes: normalizeReference(row?.notes),
    nit: normalizeReference(row?.nit) ?? normalizeReference(row?.tax_id),
    created_at: normalizeReference(row?.created_at),
  };
}

function wrapDbError(errorLike: any, fallbackMessage: string): Error & { code?: string } {
  const wrapped: Error & { code?: string } = new Error(errorLike?.message || fallbackMessage);
  wrapped.code = normalizeReference(errorLike?.code) || undefined;
  return wrapped;
}

export async function listSuppliersForManagement({
  businessId,
  preferredTaxColumn = 'nit',
  limit,
  offset = 0,
}: {
  businessId: string;
  preferredTaxColumn?: SupplierTaxColumn;
  limit?: number;
  offset?: number;
}): Promise<{ suppliers: ProveedorRecord[]; taxColumn: SupplierTaxColumn }> {
  const candidates: SupplierTaxColumn[] = preferredTaxColumn === 'nit'
    ? ['nit', 'tax_id']
    : ['tax_id', 'nit'];
  const client = getSupabaseClient();

  let data: any[] = [];
  let resolvedTaxColumn: SupplierTaxColumn = preferredTaxColumn;
  let lastError: any = null;

  for (const column of candidates) {
    let query = client
      .from('suppliers')
      .select(`${BASE_SUPPLIER_COLUMNS},${column}`)
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    if (Number.isFinite(limit)) {
      const safeLimit = Number(limit);
      const safeOffset = Number.isFinite(offset) ? Number(offset) : 0;
      query = query.range(safeOffset, safeOffset + safeLimit - 1);
    }

    const result = await query;
    if (!result.error) {
      data = Array.isArray(result.data) ? result.data : [];
      resolvedTaxColumn = column;
      lastError = null;
      break;
    }

    lastError = result.error;
    if (!isMissingSupplierColumnError(result.error, column)) break;
  }

  if (lastError) {
    throw wrapDbError(lastError, 'No se pudieron cargar los proveedores.');
  }

  return {
    suppliers: data.map(normalizeProveedor),
    taxColumn: resolvedTaxColumn,
  };
}

export async function saveSupplierWithTaxFallback({
  businessId,
  formData,
  supplierId = null,
  preferredTaxColumn = 'nit',
}: {
  businessId: string;
  formData: ProveedorFormPayload;
  supplierId?: string | null;
  preferredTaxColumn?: SupplierTaxColumn;
}): Promise<{ supplier: ProveedorRecord | null; taxColumn: SupplierTaxColumn }> {
  const normalizedName = normalizeText(formData.business_name);
  if (!normalizedName) {
    throw new Error('El nombre del proveedor es obligatorio.');
  }

  const fallbackTaxColumn: SupplierTaxColumn = preferredTaxColumn === 'nit' ? 'tax_id' : 'nit';
  const primaryPayload = buildSupplierPayload({
    formData: {
      ...formData,
      business_name: normalizedName,
    },
    taxColumn: preferredTaxColumn,
  });
  const client = getSupabaseClient();

  const execute = async (payload: Record<string, unknown>, selectColumn: SupplierTaxColumn) => {
    const selectColumns = `${BASE_SUPPLIER_COLUMNS},${selectColumn}`;
    if (supplierId) {
      return client
        .from('suppliers')
        .update(payload)
        .eq('id', supplierId)
        .eq('business_id', businessId)
        .select(selectColumns)
        .maybeSingle();
    }

    return client
      .from('suppliers')
      .insert([{
        business_id: businessId,
        created_at: new Date().toISOString(),
        ...payload,
      }])
      .select(selectColumns)
      .maybeSingle();
  };

  let { data, error } = await execute(primaryPayload, preferredTaxColumn);
  let resolvedTaxColumn: SupplierTaxColumn = preferredTaxColumn;

  if (error && isMissingSupplierColumnError(error, preferredTaxColumn)) {
    const retryPayload = { ...primaryPayload };
    delete (retryPayload as Record<string, unknown>)[preferredTaxColumn];
    (retryPayload as Record<string, unknown>)[fallbackTaxColumn] = normalizeReference(formData.nit);

    const retry = await execute(retryPayload, fallbackTaxColumn);
    data = retry.data;
    error = retry.error;

    if (!error) {
      resolvedTaxColumn = fallbackTaxColumn;
    }
  }

  if (error) {
    throw wrapDbError(error, 'No se pudo guardar el proveedor.');
  }

  return {
    supplier: data ? normalizeProveedor(data) : null,
    taxColumn: resolvedTaxColumn,
  };
}

export async function deleteSupplierById({
  supplierId,
  businessId,
}: {
  supplierId: string;
  businessId?: string | null;
}): Promise<void> {
  if (!normalizeText(supplierId)) {
    throw new Error('supplierId es requerido.');
  }

  const client = getSupabaseClient();
  let query = client
    .from('suppliers')
    .delete()
    .eq('id', supplierId);

  if (businessId) {
    query = query.eq('business_id', businessId);
  }

  const { error } = await query;
  if (error) {
    throw wrapDbError(error, 'No se pudo eliminar el proveedor.');
  }
}
