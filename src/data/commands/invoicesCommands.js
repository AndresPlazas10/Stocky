import { supabaseAdapter } from '../adapters/supabaseAdapter';
import { enqueueOutboxMutation } from '../../sync/outboxShadow.js';
import LOCAL_SYNC_CONFIG from '../../config/localSync.js';
import { runOutboxTick } from '../../sync/syncBootstrap.js';

function buildMutationId(prefix, businessId = null) {
  const nonce = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  return `${businessId || 'unknown'}:${prefix}:${nonce}`;
}

function canQueueLocalInvoices() {
  return Boolean(
    LOCAL_SYNC_CONFIG.enabled
    && LOCAL_SYNC_CONFIG.shadowWritesEnabled
    && (
      LOCAL_SYNC_CONFIG.localWrites?.allLocalFirst
      || LOCAL_SYNC_CONFIG.localWrites?.invoices
    )
  );
}

function shouldForceInvoicesLocalFirst() {
  return Boolean(canQueueLocalInvoices());
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

function normalizeInvoiceItems(items = []) {
  const source = Array.isArray(items) ? items : [];
  return source.map((item) => ({
    product_id: item.product_id || null,
    product_name: item.product_name || 'Producto',
    quantity: Number(item.quantity || 0),
    unit_price: Number(item.unit_price || 0),
    total: Number(item.total || (Number(item.quantity || 0) * Number(item.unit_price || 0)))
  }));
}

function buildLocalInvoiceNumber() {
  return `LOCAL-${Date.now().toString().slice(-8)}`;
}

async function triggerBackgroundOutboxSync() {
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    runOutboxTick().catch(() => {});
  }
}

async function enqueueLocalInvoiceCreate({
  businessId,
  employeeId = null,
  paymentMethod = 'cash',
  total = 0,
  notes = '',
  items = []
}) {
  const invoiceId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  const invoiceNumber = buildLocalInvoiceNumber();
  const nowIso = new Date().toISOString();
  const normalizedItems = normalizeInvoiceItems(items);

  const invoice = {
    id: invoiceId,
    business_id: businessId,
    employee_id: employeeId,
    invoice_number: invoiceNumber,
    customer_name: 'Consumidor Final',
    customer_email: null,
    customer_id_number: null,
    payment_method: paymentMethod,
    subtotal: Number(total || 0),
    tax: 0,
    total: Number(total || 0),
    notes: notes || '',
    status: 'pending',
    issued_at: nowIso,
    created_at: nowIso
  };

  const queued = await enqueueOutboxMutation({
    businessId,
    mutationType: 'invoice.create',
    payload: {
      invoice_id: invoiceId,
      invoice_number: invoiceNumber,
      total: Number(total || 0),
      items_count: normalizedItems.length,
      invoice,
      items: normalizedItems
    },
    mutationId: buildMutationId('invoice.create.local', businessId)
  });

  if (!queued) {
    throw new Error('No se pudo guardar la factura localmente');
  }

  return {
    invoice,
    invoiceNumber,
    invoiceItems: normalizedItems,
    localOnly: true,
    pendingSync: true
  };
}

export async function createInvoiceWithItemsAndStock({
  businessId,
  employeeId = null,
  paymentMethod = 'cash',
  total = 0,
  notes = '',
  items = []
}) {
  if (shouldForceInvoicesLocalFirst()) {
    const localResult = await enqueueLocalInvoiceCreate({
      businessId,
      employeeId,
      paymentMethod,
      total,
      notes,
      items
    });
    await triggerBackgroundOutboxSync();
    return localResult;
  }

  const offlineMode = typeof navigator !== 'undefined' && navigator.onLine === false;
  if (offlineMode && canQueueLocalInvoices()) {
    return enqueueLocalInvoiceCreate({
      businessId,
      employeeId,
      paymentMethod,
      total,
      notes,
      items
    });
  }

  try {
    const { data: invoiceNumber, error: numberError } = await supabaseAdapter.generateInvoiceNumber(businessId);
    if (numberError) {
      throw numberError;
    }

    const { data: invoice, error: invoiceError } = await supabaseAdapter.insertInvoice({
      business_id: businessId,
      employee_id: employeeId,
      invoice_number: invoiceNumber,
      customer_name: 'Consumidor Final',
      customer_email: null,
      customer_id_number: null,
      payment_method: paymentMethod,
      subtotal: total,
      tax: 0,
      total,
      notes,
      status: 'pending',
      issued_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    });

    if (invoiceError) {
      throw invoiceError;
    }

    const normalizedItems = normalizeInvoiceItems(items);
    const invoiceItems = normalizedItems.map((item) => ({
      invoice_id: invoice.id,
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total: item.total,
      created_at: new Date().toISOString()
    }));

    const { error: itemsError } = await supabaseAdapter.insertInvoiceItems(invoiceItems);
    if (itemsError) {
      await supabaseAdapter.deleteInvoiceById(invoice.id);
      throw itemsError;
    }

    const productUpdates = normalizedItems
      .map((item) => ({
        product_id: item.product_id,
        quantity: Number(item.quantity) || 0
      }))
      .filter((item) => item.product_id && item.quantity > 0);

    if (productUpdates.length > 0) {
      const { error: stockError } = await supabaseAdapter.updateStockBatch(productUpdates);
      if (stockError) {
        await supabaseAdapter.deleteInvoiceById(invoice.id);
        throw stockError;
      }
    }

    await enqueueOutboxMutation({
      businessId,
      mutationType: 'invoice.create',
      payload: {
        invoice_id: invoice.id,
        invoice_number: invoiceNumber,
        total: Number(total || 0),
        items_count: invoiceItems.length,
        invoice,
        items: normalizedItems
      },
      mutationId: buildMutationId('invoice.create', businessId)
    });

    return {
      invoice: invoice || null,
      invoiceNumber,
      invoiceItems,
      localOnly: false
    };
  } catch (error) {
    if (canQueueLocalInvoices() && isConnectivityError(error)) {
      return enqueueLocalInvoiceCreate({
        businessId,
        employeeId,
        paymentMethod,
        total,
        notes,
        items
      });
    }

    const message = String(error?.message || '');
    if (message.includes('generate_invoice_number')) {
      throw new Error(`Error al generar número de factura: ${message}`);
    }
    if (message.includes('invoice') || message.includes('factura')) {
      throw new Error(`Error al crear factura: ${message}`);
    }
    throw new Error(message || 'Error desconocido al crear factura');
  }
}

export async function markInvoiceAsSent({ invoiceId, businessId = null }) {
  if (shouldForceInvoicesLocalFirst()) {
    const queued = await enqueueOutboxMutation({
      businessId,
      mutationType: 'invoice.sent',
      payload: {
        invoice_id: invoiceId,
        sent_at: new Date().toISOString()
      },
      mutationId: buildMutationId('invoice.sent.local', businessId)
    });
    if (!queued) throw new Error('No se pudo guardar el envío de factura localmente');
    await triggerBackgroundOutboxSync();
    return { localOnly: true, pendingSync: true };
  }

  const offlineMode = typeof navigator !== 'undefined' && navigator.onLine === false;
  if (offlineMode && canQueueLocalInvoices()) {
    const queued = await enqueueOutboxMutation({
      businessId,
      mutationType: 'invoice.sent',
      payload: {
        invoice_id: invoiceId,
        sent_at: new Date().toISOString()
      },
      mutationId: buildMutationId('invoice.sent.local', businessId)
    });
    if (!queued) throw new Error('No se pudo guardar el envío de factura localmente');
    return { localOnly: true, pendingSync: true };
  }

  const { error } = await supabaseAdapter.updateInvoiceById(invoiceId, {
    status: 'sent',
    sent_at: new Date().toISOString()
  });

  if (error) {
    if (canQueueLocalInvoices() && isConnectivityError(error)) {
      const queued = await enqueueOutboxMutation({
        businessId,
        mutationType: 'invoice.sent',
        payload: {
          invoice_id: invoiceId,
          sent_at: new Date().toISOString()
        },
        mutationId: buildMutationId('invoice.sent.local', businessId)
      });
      if (!queued) throw new Error('No se pudo guardar el envío de factura localmente');
      return { localOnly: true, pendingSync: true };
    }

    throw new Error(`Error al actualizar estado de factura: ${error.message}`);
  }

  await enqueueOutboxMutation({
    businessId,
    mutationType: 'invoice.sent',
    payload: {
      invoice_id: invoiceId,
      sent_at: new Date().toISOString()
    },
    mutationId: buildMutationId('invoice.sent', businessId)
  });

  return { localOnly: false };
}

export async function cancelInvoiceAndRestoreStock({
  invoiceId,
  businessId = null,
  invoiceItems = []
}) {
  const productUpdates = (invoiceItems || [])
    .map((item) => ({
      product_id: item.product_id,
      quantity: Number(item.quantity || 0)
    }))
    .filter((item) => item.product_id && item.quantity > 0);

  if (shouldForceInvoicesLocalFirst()) {
    const queued = await enqueueOutboxMutation({
      businessId,
      mutationType: 'invoice.cancel',
      payload: {
        invoice_id: invoiceId,
        items_count: productUpdates.length,
        product_updates: productUpdates,
        restore_stock_warning: false,
        cancelled_at: new Date().toISOString()
      },
      mutationId: buildMutationId('invoice.cancel.local', businessId)
    });
    if (!queued) throw new Error('No se pudo guardar la cancelación localmente');
    await triggerBackgroundOutboxSync();
    return {
      restoreError: null,
      localOnly: true,
      pendingSync: true
    };
  }

  const offlineMode = typeof navigator !== 'undefined' && navigator.onLine === false;
  if (offlineMode && canQueueLocalInvoices()) {
    const queued = await enqueueOutboxMutation({
      businessId,
      mutationType: 'invoice.cancel',
      payload: {
        invoice_id: invoiceId,
        items_count: productUpdates.length,
        product_updates: productUpdates,
        restore_stock_warning: false,
        cancelled_at: new Date().toISOString()
      },
      mutationId: buildMutationId('invoice.cancel.local', businessId)
    });
    if (!queued) throw new Error('No se pudo guardar la cancelación localmente');
    return {
      restoreError: null,
      localOnly: true,
      pendingSync: true
    };
  }

  const { error: cancelError } = await supabaseAdapter.updateInvoiceById(invoiceId, {
    status: 'cancelled',
    cancelled_at: new Date().toISOString()
  });

  if (cancelError) {
    if (canQueueLocalInvoices() && isConnectivityError(cancelError)) {
      const queued = await enqueueOutboxMutation({
        businessId,
        mutationType: 'invoice.cancel',
        payload: {
          invoice_id: invoiceId,
          items_count: productUpdates.length,
          product_updates: productUpdates,
          restore_stock_warning: false,
          cancelled_at: new Date().toISOString()
        },
        mutationId: buildMutationId('invoice.cancel.local', businessId)
      });
      if (!queued) throw new Error('No se pudo guardar la cancelación localmente');
      return {
        restoreError: null,
        localOnly: true,
        pendingSync: true
      };
    }

    throw new Error(`Error al cancelar factura: ${cancelError.message}`);
  }

  let restoreError = null;

  if (productUpdates.length > 0) {
    try {
      const { error } = await supabaseAdapter.restoreStockBatch(productUpdates);
      if (error) restoreError = error;
    } catch (error) {
      restoreError = error;
    }
  }

  await enqueueOutboxMutation({
    businessId,
    mutationType: 'invoice.cancel',
    payload: {
      invoice_id: invoiceId,
      items_count: productUpdates.length,
      product_updates: productUpdates,
      restore_stock_warning: Boolean(restoreError),
      cancelled_at: new Date().toISOString()
    },
    mutationId: buildMutationId('invoice.cancel', businessId)
  });

  return {
    restoreError,
    localOnly: false
  };
}

export async function deleteInvoiceCascade({ invoiceId, businessId = null }) {
  if (shouldForceInvoicesLocalFirst()) {
    const queued = await enqueueOutboxMutation({
      businessId,
      mutationType: 'invoice.delete',
      payload: {
        invoice_id: invoiceId
      },
      mutationId: buildMutationId('invoice.delete.local', businessId)
    });
    if (!queued) throw new Error('No se pudo guardar la eliminación localmente');
    await triggerBackgroundOutboxSync();
    return { localOnly: true, pendingSync: true };
  }

  const offlineMode = typeof navigator !== 'undefined' && navigator.onLine === false;
  if (offlineMode && canQueueLocalInvoices()) {
    const queued = await enqueueOutboxMutation({
      businessId,
      mutationType: 'invoice.delete',
      payload: {
        invoice_id: invoiceId
      },
      mutationId: buildMutationId('invoice.delete.local', businessId)
    });
    if (!queued) throw new Error('No se pudo guardar la eliminación localmente');
    return { localOnly: true, pendingSync: true };
  }

  const { error: itemsError } = await supabaseAdapter.deleteInvoiceItemsByInvoiceId(invoiceId);
  if (itemsError) {
    if (canQueueLocalInvoices() && isConnectivityError(itemsError)) {
      const queued = await enqueueOutboxMutation({
        businessId,
        mutationType: 'invoice.delete',
        payload: {
          invoice_id: invoiceId
        },
        mutationId: buildMutationId('invoice.delete.local', businessId)
      });
      if (!queued) throw new Error('No se pudo guardar la eliminación localmente');
      return { localOnly: true, pendingSync: true };
    }

    throw new Error(`Error al eliminar items: ${itemsError.message}`);
  }

  const { error: deleteError } = await supabaseAdapter.deleteInvoiceById(invoiceId);
  if (deleteError) {
    if (canQueueLocalInvoices() && isConnectivityError(deleteError)) {
      const queued = await enqueueOutboxMutation({
        businessId,
        mutationType: 'invoice.delete',
        payload: {
          invoice_id: invoiceId
        },
        mutationId: buildMutationId('invoice.delete.local', businessId)
      });
      if (!queued) throw new Error('No se pudo guardar la eliminación localmente');
      return { localOnly: true, pendingSync: true };
    }

    throw new Error(`Error al eliminar factura: ${deleteError.message}`);
  }

  await enqueueOutboxMutation({
    businessId,
    mutationType: 'invoice.delete',
    payload: {
      invoice_id: invoiceId
    },
    mutationId: buildMutationId('invoice.delete', businessId)
  });

  return { localOnly: false };
}
