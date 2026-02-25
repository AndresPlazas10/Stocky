import LOCAL_SYNC_CONFIG from '../../config/localSync.js';
import { getLocalDbClient } from '../../localdb/client.js';
import { logger } from '../../utils/logger.js';

function nonEmpty(value) {
  const normalized = String(value || '').trim();
  return normalized || null;
}

async function invalidateLocalReadCachePrefixes(prefixes = []) {
  if (!LOCAL_SYNC_CONFIG.enabled) return 0;

  const filtered = [...new Set((prefixes || []).map(nonEmpty).filter(Boolean))];
  if (filtered.length === 0) return 0;

  try {
    const db = getLocalDbClient();
    await db.init();
    return db.deleteCacheByPrefixes(filtered);
  } catch (error) {
    logger.warn('[local-cache] invalidation failed', {
      prefixes: filtered,
      error: error?.message || String(error)
    });
    return 0;
  }
}

export async function invalidateSaleCache({
  businessId,
  saleId = null
} = {}) {
  const bid = nonEmpty(businessId);
  const sid = nonEmpty(saleId);

  const prefixes = [
    bid ? `products:sales:${bid}:` : null,
    bid ? `products:purchases:${bid}:` : null,
    bid ? `products:orders:${bid}:` : null,
    bid ? `products:subset:${bid}:` : null,
    bid ? `tables:${bid}:current_order` : null,
    bid ? `business:${bid}:name` : null,
    bid ? `sales:${bid}:` : null,
    sid ? `sales:${sid}:` : null
  ];

  return invalidateLocalReadCachePrefixes(prefixes);
}

export async function invalidatePurchaseCache({
  businessId,
  purchaseId = null,
  supplierId = null
} = {}) {
  const bid = nonEmpty(businessId);
  const pid = nonEmpty(purchaseId);
  const spid = nonEmpty(supplierId);

  const prefixes = [
    bid ? `products:sales:${bid}:` : null,
    bid ? `products:purchases:${bid}:` : null,
    bid ? `products:orders:${bid}:` : null,
    bid ? `products:subset:${bid}:` : null,
    bid ? `suppliers:${bid}:` : null,
    pid ? `purchases:${pid}:` : null,
    spid ? `supplier:${spid}` : null
  ];

  return invalidateLocalReadCachePrefixes(prefixes);
}

export async function invalidateOrderCache({
  businessId,
  orderId = null,
  tableId = null,
  saleId = null
} = {}) {
  const bid = nonEmpty(businessId);
  const oid = nonEmpty(orderId);
  const tid = nonEmpty(tableId);
  const sid = nonEmpty(saleId);

  const prefixes = [
    bid ? `tables:${bid}:` : null,
    bid ? `products:orders:${bid}:` : null,
    bid ? `products:subset:${bid}:` : null,
    bid ? `sales:${bid}:` : null,
    oid ? `orders:${oid}:` : null,
    sid ? `sales:${sid}:` : null,
    tid ? `table:${tid}` : null
  ];

  return invalidateLocalReadCachePrefixes(prefixes);
}

export async function invalidateInventoryCache({
  businessId,
  productId = null,
  supplierId = null
} = {}) {
  const bid = nonEmpty(businessId);
  const pid = nonEmpty(productId);
  const spid = nonEmpty(supplierId);

  const prefixes = [
    bid ? `products:inventory:${bid}:` : null,
    bid ? `products:sales:${bid}:` : null,
    bid ? `products:purchases:${bid}:` : null,
    bid ? `products:orders:${bid}:` : null,
    bid ? `products:invoices:${bid}:` : null,
    'products:stock_subset:' ,
    bid ? `products:subset:${bid}:` : null,
    bid ? `suppliers:${bid}:` : null,
    pid ? `product:${pid}:` : null,
    spid ? `supplier:${spid}` : null
  ];

  return invalidateLocalReadCachePrefixes(prefixes);
}

export async function invalidateInvoiceCache({
  businessId,
  invoiceId = null
} = {}) {
  const bid = nonEmpty(businessId);
  const iid = nonEmpty(invoiceId);

  const prefixes = [
    bid ? `invoices:${bid}:` : null,
    bid ? `products:invoices:${bid}:` : null,
    bid ? `products:sales:${bid}:` : null,
    bid ? `products:orders:${bid}:` : null,
    bid ? `products:purchases:${bid}:` : null,
    'products:stock_subset:',
    iid ? `invoice:${iid}:` : null
  ];

  return invalidateLocalReadCachePrefixes(prefixes);
}

function pickFirstSaleIdFromPayload(payload = {}) {
  const directSaleId = nonEmpty(payload?.sale_id);
  if (directSaleId) return directSaleId;

  const saleIds = Array.isArray(payload?.sale_ids) ? payload.sale_ids : [];
  for (const value of saleIds) {
    const normalized = nonEmpty(value);
    if (normalized) return normalized;
  }

  return null;
}

export async function invalidateFromOutboxEvent(event = {}) {
  const mutationType = nonEmpty(event?.mutation_type);
  const businessId = nonEmpty(event?.business_id);
  const payload = event?.payload && typeof event.payload === 'object' ? event.payload : {};

  if (!mutationType || !businessId) return 0;

  if (mutationType.startsWith('sale.')) {
    return invalidateSaleCache({
      businessId,
      saleId: payload?.sale_id || null
    });
  }

  if (mutationType.startsWith('purchase.')) {
    return invalidatePurchaseCache({
      businessId,
      purchaseId: payload?.purchase_id || null,
      supplierId: payload?.supplier_id || null
    });
  }

  if (
    mutationType.startsWith('order.')
    || mutationType.startsWith('table.')
  ) {
    return invalidateOrderCache({
      businessId,
      orderId: payload?.order_id || null,
      tableId: payload?.table_id || null,
      saleId: pickFirstSaleIdFromPayload(payload)
    });
  }

  if (mutationType.startsWith('product.')) {
    return invalidateInventoryCache({
      businessId,
      productId: payload?.product_id || null,
      supplierId: payload?.supplier_id || null
    });
  }

  if (mutationType.startsWith('supplier.')) {
    return invalidatePurchaseCache({
      businessId,
      supplierId: payload?.supplier_id || null
    });
  }

  if (mutationType.startsWith('invoice.')) {
    return invalidateInvoiceCache({
      businessId,
      invoiceId: payload?.invoice_id || null
    });
  }

  return 0;
}

export default {
  invalidateSaleCache,
  invalidatePurchaseCache,
  invalidateOrderCache,
  invalidateInventoryCache,
  invalidateInvoiceCache,
  invalidateFromOutboxEvent
};
