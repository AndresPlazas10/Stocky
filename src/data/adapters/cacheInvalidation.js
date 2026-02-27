import LOCAL_SYNC_CONFIG from '../../config/localSync.js';
import { getLocalDbClient } from '../../localdb/client.js';
import { logger } from '../../utils/logger.js';

function nonEmpty(value) {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function getOfflineSnapshotStorageKey(key) {
  const normalizedKey = nonEmpty(key);
  if (!normalizedKey) return null;
  return `stocky.offline_snapshot.${normalizedKey}`;
}

function forceMesaSnapshotAsAvailable({
  businessId,
  tableId = null,
  orderId = null
} = {}) {
  if (typeof window === 'undefined') return false;
  const bid = nonEmpty(businessId);
  if (!bid) return false;

  const tid = nonEmpty(tableId);
  const oid = nonEmpty(orderId);
  if (!tid && !oid) return false;

  const snapshotStorageKey = getOfflineSnapshotStorageKey(`mesas.list:${bid}`);
  if (!snapshotStorageKey) return false;

  try {
    const raw = window.localStorage.getItem(snapshotStorageKey);
    if (!raw) return false;

    const parsed = JSON.parse(raw);
    const mesas = Array.isArray(parsed?.payload) ? parsed.payload : null;
    if (!mesas || mesas.length === 0) return false;

    let touched = false;
    const nextMesas = mesas.map((mesa) => {
      const mesaId = nonEmpty(mesa?.id);
      const mesaOrderId = nonEmpty(mesa?.current_order_id);
      const matchesTable = Boolean(tid && mesaId && mesaId === tid);
      const matchesOrder = Boolean(oid && mesaOrderId && mesaOrderId === oid);

      if (!matchesTable && !matchesOrder) return mesa;
      touched = true;

      return {
        ...mesa,
        status: 'available',
        current_order_id: null,
        orders: null
      };
    });

    if (!touched) return false;

    window.localStorage.setItem(snapshotStorageKey, JSON.stringify({
      updated_at: new Date().toISOString(),
      payload: nextMesas
    }));
    return true;
  } catch {
    return false;
  }
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
    bid ? `sales:list:${bid}:` : null,
    bid ? `reports:${bid}:sales:` : null,
    bid ? `reports:${bid}:sale_details_cost` : null,
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
    bid ? `purchases:list:${bid}:` : null,
    bid ? `reports:${bid}:purchases:` : null,
    pid ? `purchases:${pid}:` : null,
    spid ? `supplier:${spid}` : null
  ];

  return invalidateLocalReadCachePrefixes(prefixes);
}

export async function invalidateOrderCache({
  businessId,
  orderId = null,
  tableId = null,
  saleId = null,
  releaseMesaSnapshot = false
} = {}) {
  const bid = nonEmpty(businessId);
  const oid = nonEmpty(orderId);
  const tid = nonEmpty(tableId);
  const sid = nonEmpty(saleId);

  const prefixes = [
    bid ? `tables:${bid}:` : null,
    bid ? `orders:${bid}:open` : null,
    bid ? `products:orders:${bid}:` : null,
    bid ? `products:subset:${bid}:` : null,
    bid ? `sales:${bid}:` : null,
    oid ? `orders:${oid}:` : null,
    sid ? `sales:${sid}:` : null,
    tid ? `table:${tid}` : null
  ];
  const deleted = await invalidateLocalReadCachePrefixes(prefixes);
  if (releaseMesaSnapshot) {
    forceMesaSnapshotAsAvailable({
      businessId: bid,
      tableId: tid,
      orderId: oid
    });
  }
  return deleted;
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
    const orderId = payload?.order_id || null;
    const tableId = payload?.table_id || null;
    const hasMesaContext = Boolean(nonEmpty(orderId) || nonEmpty(tableId));

    if (hasMesaContext) {
      const shouldReleaseMesaSnapshot = mutationType === 'sale.create';
      const [saleInvalidated, orderInvalidated] = await Promise.all([
        invalidateSaleCache({
          businessId,
          saleId: payload?.sale_id || null
        }),
        invalidateOrderCache({
          businessId,
          orderId,
          tableId,
          saleId: payload?.sale_id || null,
          releaseMesaSnapshot: shouldReleaseMesaSnapshot
        })
      ]);
      return Number(saleInvalidated || 0) + Number(orderInvalidated || 0);
    }

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
    const shouldReleaseMesaSnapshot = (
      mutationType === 'order.delete_and_release_table'
      || mutationType === 'table.delete_cascade_orders'
      || mutationType === 'order.close.single'
      || mutationType === 'order.close.split'
    );
    return invalidateOrderCache({
      businessId,
      orderId: payload?.order_id || null,
      tableId: payload?.table_id || null,
      saleId: pickFirstSaleIdFromPayload(payload),
      releaseMesaSnapshot: shouldReleaseMesaSnapshot
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
