import { supabaseAdapter } from '../adapters/supabaseAdapter';
import { isMissingSupplierColumnError } from '../queries/suppliersQueries';
import { invalidatePurchaseCache } from '../adapters/cacheInvalidation';
import type { Supplier } from '../../types';

interface SupplierFormData {
  business_name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  nit?: string;
  [key: string]: unknown;
}

function buildSupplierPayload({
  formData = {} as SupplierFormData,
  taxColumn = 'nit'
}: {
  formData: SupplierFormData;
  taxColumn?: string;
}): Record<string, unknown> {
  return {
    business_name: formData.business_name,
    contact_name: formData.contact_name || null,
    email: formData.email || null,
    phone: formData.phone || null,
    address: formData.address || null,
    notes: formData.notes || null,
    [taxColumn]: formData.nit || null
  };
}

export async function saveSupplierWithTaxFallback({
  businessId,
  formData,
  supplierId = null,
  preferredTaxColumn = 'nit'
}: {
  businessId: string;
  formData: SupplierFormData;
  supplierId?: string | null;
  preferredTaxColumn?: string;
}): Promise<{ supplier: Partial<Supplier> | null; taxColumn: string }> {
  const offlineMode = typeof navigator !== 'undefined' && navigator.onLine === false;
  if (offlineMode) {
    throw new Error('Perdiste la conexión, intentando reconectar...');
  }

  const fallbackTaxColumn = preferredTaxColumn === 'nit' ? 'tax_id' : 'nit';
  const primaryPayload = buildSupplierPayload({
    formData,
    taxColumn: preferredTaxColumn
  });
  const execute = supplierId
    ? (payload: Record<string, unknown>) => supabaseAdapter.updateSupplierById(supplierId, payload)
    : (payload: Record<string, unknown>) => supabaseAdapter.insertSupplier({
      business_id: businessId,
      ...payload,
      created_at: new Date().toISOString()
    });

  let { data, error } = await execute(primaryPayload);
  let resolvedTaxColumn = preferredTaxColumn;

  if (error && isMissingSupplierColumnError(error, preferredTaxColumn)) {
    const retryPayload = { ...primaryPayload };
    delete retryPayload[preferredTaxColumn];
    retryPayload[fallbackTaxColumn] = formData.nit || null;

    const retryResult = await execute(retryPayload);
    data = retryResult?.data || null;
    error = retryResult?.error || null;

    if (!error) {
      resolvedTaxColumn = fallbackTaxColumn;
    }
  }

  if (error) throw error;

  await invalidatePurchaseCache({
    businessId,
    supplierId: supplierId || data?.id || null
  });

  return {
    supplier: data || null,
    taxColumn: resolvedTaxColumn
  };
}

export async function deleteSupplierById(
  supplierIdOrOptions: string | { supplierId: string; businessId?: string | null }
): Promise<{ success: boolean }> {
  const supplierId = typeof supplierIdOrOptions === 'string'
    ? supplierIdOrOptions
    : supplierIdOrOptions?.supplierId;
  const businessId = typeof supplierIdOrOptions === 'string'
    ? null
    : supplierIdOrOptions?.businessId || null;

  if (!supplierId) {
    throw new Error('supplierId es requerido');
  }

  const offlineMode = typeof navigator !== 'undefined' && navigator.onLine === false;
  if (offlineMode) {
    throw new Error('Perdiste la conexión, intentando reconectar...');
  }

  const { error } = await supabaseAdapter.deleteSupplierById(supplierId);
  if (error) throw error;

  await invalidatePurchaseCache({
    businessId,
    supplierId
  });

  return {
    success: true
  };
}
