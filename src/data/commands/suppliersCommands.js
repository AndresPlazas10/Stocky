import { supabaseAdapter } from '../adapters/supabaseAdapter';
import { isMissingSupplierColumnError } from '../queries/suppliersQueries.js';
import { invalidatePurchaseCache } from '../adapters/cacheInvalidation.js';

function buildSupplierPayload({
  formData = {},
  taxColumn = 'nit'
}) {
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
}) {
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
    ? (payload) => supabaseAdapter.updateSupplierById(supplierId, payload)
    : (payload) => supabaseAdapter.insertSupplier({
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

export async function deleteSupplierById(supplierIdOrOptions) {
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
