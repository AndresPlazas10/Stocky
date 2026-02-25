import { supabaseAdapter } from '../adapters/supabaseAdapter';
import { isMissingSupplierColumnError } from '../queries/suppliersQueries.js';
import { enqueueOutboxMutation } from '../../sync/outboxShadow.js';
import LOCAL_SYNC_CONFIG from '../../config/localSync.js';
import { runOutboxTick } from '../../sync/syncBootstrap.js';

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

function buildMutationId(prefix, businessId = null) {
  const nonce = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  return `${businessId || 'unknown'}:${prefix}:${nonce}`;
}

function canQueueLocalSuppliers() {
  return Boolean(
    LOCAL_SYNC_CONFIG.enabled
    && LOCAL_SYNC_CONFIG.shadowWritesEnabled
    && (
      LOCAL_SYNC_CONFIG.localWrites?.allLocalFirst
      || LOCAL_SYNC_CONFIG.localWrites?.suppliers
    )
  );
}

function shouldForceSuppliersLocalFirst() {
  return Boolean(canQueueLocalSuppliers());
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

async function triggerBackgroundOutboxSync() {
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    runOutboxTick().catch(() => {});
  }
}

function buildSupplierLocalSnapshot({
  businessId,
  supplierId,
  formData = {},
  taxColumn = 'nit'
}) {
  const snapshot = {
    id: supplierId,
    business_id: businessId,
    business_name: formData.business_name || '',
    contact_name: formData.contact_name || null,
    email: formData.email || null,
    phone: formData.phone || null,
    address: formData.address || null,
    notes: formData.notes || null,
    created_at: formData.created_at || new Date().toISOString()
  };

  if (taxColumn === 'nit') {
    snapshot.nit = formData.nit || null;
  } else {
    snapshot.tax_id = formData.nit || null;
  }

  return snapshot;
}

async function enqueueLocalSupplierMutation({
  businessId,
  supplierId = null,
  formData = {},
  taxColumn = 'nit',
  mutationType = 'supplier.create'
}) {
  const resolvedSupplierId = supplierId || (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`);
  const supplier = buildSupplierLocalSnapshot({
    businessId,
    supplierId: resolvedSupplierId,
    formData,
    taxColumn
  });

  const payload = mutationType === 'supplier.delete'
    ? { supplier_id: resolvedSupplierId }
    : mutationType === 'supplier.update'
    ? {
      supplier_id: resolvedSupplierId,
      tax_column: taxColumn,
      update: supplier
    }
    : {
      supplier_id: resolvedSupplierId,
      tax_column: taxColumn,
      supplier
    };

  const queued = await enqueueOutboxMutation({
    businessId,
    mutationType,
    payload,
    mutationId: buildMutationId(`${mutationType}.local`, businessId)
  });

  if (!queued) {
    throw new Error('No se pudo guardar el proveedor localmente');
  }

  return {
    supplier,
    taxColumn,
    localOnly: true,
    pendingSync: true
  };
}

export async function saveSupplierWithTaxFallback({
  businessId,
  formData,
  supplierId = null,
  preferredTaxColumn = 'nit'
}) {
  if (shouldForceSuppliersLocalFirst()) {
    const localResult = await enqueueLocalSupplierMutation({
      businessId,
      supplierId,
      formData,
      taxColumn: preferredTaxColumn,
      mutationType: supplierId ? 'supplier.update' : 'supplier.create'
    });
    await triggerBackgroundOutboxSync();
    return localResult;
  }

  const offlineMode = typeof navigator !== 'undefined' && navigator.onLine === false;
  if (offlineMode && canQueueLocalSuppliers()) {
    return enqueueLocalSupplierMutation({
      businessId,
      supplierId,
      formData,
      taxColumn: preferredTaxColumn,
      mutationType: supplierId ? 'supplier.update' : 'supplier.create'
    });
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

  if (error && canQueueLocalSuppliers() && isConnectivityError(error)) {
    return enqueueLocalSupplierMutation({
      businessId,
      supplierId,
      formData,
      taxColumn: preferredTaxColumn,
      mutationType: supplierId ? 'supplier.update' : 'supplier.create'
    });
  }

  if (error && isMissingSupplierColumnError(error, preferredTaxColumn)) {
    const retryPayload = { ...primaryPayload };
    delete retryPayload[preferredTaxColumn];
    retryPayload[fallbackTaxColumn] = formData.nit || null;

    const retryResult = await execute(retryPayload);
    data = retryResult?.data || null;
    error = retryResult?.error || null;

    if (error && canQueueLocalSuppliers() && isConnectivityError(error)) {
      return enqueueLocalSupplierMutation({
        businessId,
        supplierId,
        formData,
        taxColumn: preferredTaxColumn,
        mutationType: supplierId ? 'supplier.update' : 'supplier.create'
      });
    }

    if (!error) {
      resolvedTaxColumn = fallbackTaxColumn;
    }
  }

  if (error) throw error;

  await enqueueOutboxMutation({
    businessId,
    mutationType: supplierId ? 'supplier.update' : 'supplier.create',
    payload: supplierId
      ? {
        supplier_id: supplierId,
        tax_column: resolvedTaxColumn,
        update: {
          ...data,
          ...buildSupplierPayload({
            formData,
            taxColumn: resolvedTaxColumn
          })
        }
      }
      : {
        supplier_id: data?.id || null,
        tax_column: resolvedTaxColumn,
        supplier: data || buildSupplierLocalSnapshot({
          businessId,
          supplierId: data?.id || null,
          formData,
          taxColumn: resolvedTaxColumn
        })
      },
    mutationId: buildMutationId(
      supplierId ? 'supplier.update' : 'supplier.create',
      businessId
    )
  });

  return {
    supplier: data || null,
    taxColumn: resolvedTaxColumn,
    localOnly: false
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

  if (shouldForceSuppliersLocalFirst()) {
    const localResult = await enqueueLocalSupplierMutation({
      businessId,
      supplierId,
      mutationType: 'supplier.delete'
    });
    await triggerBackgroundOutboxSync();
    return localResult;
  }

  const offlineMode = typeof navigator !== 'undefined' && navigator.onLine === false;
  if (offlineMode && canQueueLocalSuppliers()) {
    return enqueueLocalSupplierMutation({
      businessId,
      supplierId,
      mutationType: 'supplier.delete'
    });
  }

  const { error } = await supabaseAdapter.deleteSupplierById(supplierId);
  if (error && canQueueLocalSuppliers() && isConnectivityError(error)) {
    return enqueueLocalSupplierMutation({
      businessId,
      supplierId,
      mutationType: 'supplier.delete'
    });
  }
  if (error) throw error;

  await enqueueOutboxMutation({
    businessId,
    mutationType: 'supplier.delete',
    payload: {
      supplier_id: supplierId
    },
    mutationId: buildMutationId('supplier.delete', businessId)
  });

  return {
    success: true,
    localOnly: false
  };
}
