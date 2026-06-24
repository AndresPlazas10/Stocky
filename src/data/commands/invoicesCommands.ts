import { supabaseAdapter } from '../adapters/supabaseAdapter';
import { invalidateInvoiceCache } from '../adapters/cacheInvalidation';
import { enqueueOutboxMutation } from '../../sync/outboxShadow';
import type { Invoice, InvoiceItem } from '../../types';

interface InvoiceItemInput {
  product_id?: string | null;
  product_name?: string;
  quantity?: number;
  unit_price?: number;
  total?: number;
}

function buildMutationId(prefix: string, businessId: string | null = null): string {
  const nonce = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  return `${businessId || 'unknown'}:${prefix}:${nonce}`;
}

function normalizeInvoiceItems(items: InvoiceItemInput[] = []): InvoiceItemInput[] {
  const source = Array.isArray(items) ? items : [];
  return source.map((item) => ({
    product_id: item.product_id || null,
    product_name: item.product_name || 'Producto',
    quantity: Number(item.quantity || 0),
    unit_price: Number(item.unit_price || 0),
    total: Number(item.total || (Number(item.quantity || 0) * Number(item.unit_price || 0)))
  }));
}

interface CreateInvoiceResult {
  invoice: Partial<Invoice> | null;
  invoiceNumber: string;
  invoiceItems: Array<Partial<InvoiceItem> & { created_at: string }>;
  localOnly: boolean;
}

export async function createInvoiceWithItemsAndStock({
  businessId,
  employeeId = null,
  paymentMethod = 'cash',
  total = 0,
  notes = '',
  items = []
}: {
  businessId: string;
  employeeId?: string | null;
  paymentMethod?: string;
  total?: number;
  notes?: string;
  items?: InvoiceItemInput[];
}): Promise<CreateInvoiceResult> {
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

    await invalidateInvoiceCache({
      businessId,
      invoiceId: invoice?.id || null
    });

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
  } catch (error: unknown) {
    const message = String((error as { message?: string })?.message || '');
    if (message.includes('generate_invoice_number')) {
      throw new Error(`Error al generar número de factura: ${message}`);
    }
    if (message.includes('invoice') || message.includes('factura')) {
      throw new Error(`Error al crear factura: ${message}`);
    }
    throw new Error(message || 'Error desconocido al crear factura');
  }
}

export async function markInvoiceAsSent({
  invoiceId,
  businessId = null
}: {
  invoiceId: string;
  businessId?: string | null;
}): Promise<{ localOnly: boolean }> {
  const sentAt = new Date().toISOString();
  const { error } = await supabaseAdapter.updateInvoiceById(invoiceId, {
    status: 'sent',
    sent_at: sentAt
  });

  if (error) {
    throw new Error(`Error al actualizar estado de factura: ${error.message}`);
  }

  await invalidateInvoiceCache({
    businessId,
    invoiceId
  });

  await enqueueOutboxMutation({
    businessId,
    mutationType: 'invoice.sent',
    payload: {
      invoice_id: invoiceId,
      sent_at: sentAt
    },
    mutationId: buildMutationId('invoice.sent', businessId)
  });

  return { localOnly: false };
}

interface CancelInvoiceResult {
  restoreError: unknown;
  localOnly: boolean;
}

export async function cancelInvoiceAndRestoreStock({
  invoiceId,
  businessId = null,
  invoiceItems = []
}: {
  invoiceId: string;
  businessId?: string | null;
  invoiceItems?: InvoiceItemInput[];
}): Promise<CancelInvoiceResult> {
  const productUpdates = (invoiceItems || [])
    .map((item) => ({
      product_id: item.product_id,
      quantity: Number(item.quantity || 0)
    }))
    .filter((item) => item.product_id && item.quantity > 0);

  const cancelledAt = new Date().toISOString();
  const { error: cancelError } = await supabaseAdapter.updateInvoiceById(invoiceId, {
    status: 'cancelled',
    cancelled_at: cancelledAt
  });

  if (cancelError) {
    throw new Error(`Error al cancelar factura: ${cancelError.message}`);
  }

  let restoreError: unknown = null;

  if (productUpdates.length > 0) {
    try {
      const { error } = await supabaseAdapter.restoreStockBatch(productUpdates);
      if (error) restoreError = error;
    } catch (error: unknown) {
      restoreError = error;
    }
  }

  await invalidateInvoiceCache({
    businessId,
    invoiceId
  });

  await enqueueOutboxMutation({
    businessId,
    mutationType: 'invoice.cancel',
    payload: {
      invoice_id: invoiceId,
      items_count: productUpdates.length,
      product_updates: productUpdates,
      restore_stock_warning: Boolean(restoreError),
      cancelled_at: cancelledAt
    },
    mutationId: buildMutationId('invoice.cancel', businessId)
  });

  return {
    restoreError,
    localOnly: false
  };
}

export async function deleteInvoiceCascade({
  invoiceId,
  businessId = null
}: {
  invoiceId: string;
  businessId?: string | null;
}): Promise<{ localOnly: boolean }> {
  const { error: itemsError } = await supabaseAdapter.deleteInvoiceItemsByInvoiceId(invoiceId);
  if (itemsError) {
    throw new Error(`Error al eliminar items: ${itemsError.message}`);
  }

  const { error: deleteError } = await supabaseAdapter.deleteInvoiceById(invoiceId);
  if (deleteError) {
    throw new Error(`Error al eliminar factura: ${deleteError.message}`);
  }

  await invalidateInvoiceCache({
    businessId,
    invoiceId
  });

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
