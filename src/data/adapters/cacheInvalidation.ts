import { readCacheInvalidateMatching } from './readCacheStore.js';

function nonEmpty(value: unknown): string | null {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

function forceMesaSnapshotAsAvailable(_params: Record<string, unknown> = {}): false {
  return false;
}

async function invalidateLocalReadCachePrefixes(prefixes: Array<string | null> = []): Promise<number> {
  const filtered = [...new Set((prefixes || []).map(nonEmpty).filter(Boolean))];
  if (filtered.length === 0) return 0;

  return readCacheInvalidateMatching((key) => (
    filtered.some((prefix) => key.startsWith(prefix))
  ));
}

export async function invalidateSaleCache(params: { businessId?: string | null; saleId?: string | null } = {}): Promise<number> {
  const { businessId, saleId = null } = params;
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

export async function invalidatePurchaseCache(params: { businessId?: string | null; purchaseId?: string | null; supplierId?: string | null } = {}): Promise<number> {
  const { businessId, purchaseId = null, supplierId = null } = params;
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

export async function invalidateOrderCache(params: { businessId?: string | null; orderId?: string | null; tableId?: string | null; saleId?: string | null; releaseMesaSnapshot?: boolean } = {}): Promise<number> {
  const { businessId, orderId = null, tableId = null, saleId = null, releaseMesaSnapshot = false } = params;
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
    } as Record<string, unknown>);
  }
  return deleted;
}

export async function invalidateInventoryCache(params: { businessId?: string | null; productId?: string | null; supplierId?: string | null } = {}): Promise<number> {
  const { businessId, productId = null, supplierId = null } = params;
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

export async function invalidateComboCache(params: { businessId?: string | null; comboId?: string | null } = {}): Promise<number> {
  const { businessId, comboId = null } = params;
  const bid = nonEmpty(businessId);
  const cid = nonEmpty(comboId);

  const prefixes = [
    bid ? `combos:${bid}:` : null,
    cid ? `combo:${cid}` : null
  ];

  return invalidateLocalReadCachePrefixes(prefixes);
}

export async function invalidateInvoiceCache(params: { businessId?: string | null; invoiceId?: string | null } = {}): Promise<number> {
  const { businessId, invoiceId = null } = params;
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

function pickFirstSaleIdFromPayload(payload: Record<string, unknown> = {}): string | null {
  const directSaleId = nonEmpty(payload?.sale_id);
  if (directSaleId) return directSaleId;

  const saleIds = Array.isArray(payload?.sale_ids) ? (payload.sale_ids as unknown[]) : [];
  for (const value of saleIds) {
    const normalized = nonEmpty(value);
    if (normalized) return normalized;
  }

  return null;
}

export async function invalidateFromOutboxEvent(event: Record<string, unknown> = {}): Promise<number> {
  const mutationType = nonEmpty(event?.mutation_type);
  const businessId = nonEmpty(event?.business_id);
  const payload: Record<string, unknown> = event?.payload && typeof event.payload === 'object' ? (event.payload as Record<string, unknown>) : {};

  if (!mutationType || !businessId) return 0;

  if (mutationType.startsWith('sale.')) {
    const orderId = (payload?.order_id as string) || null;
    const tableId = (payload?.table_id as string) || null;
    const hasMesaContext = Boolean(nonEmpty(orderId) || nonEmpty(tableId));

    if (hasMesaContext) {
      const shouldReleaseMesaSnapshot = mutationType === 'sale.create';
      const [saleInvalidated, orderInvalidated] = await Promise.all([
        invalidateSaleCache({
          businessId,
          saleId: (payload?.sale_id as string) || null
        }),
        invalidateOrderCache({
          businessId,
          orderId: orderId as string,
          tableId: tableId as string,
          saleId: (payload?.sale_id as string) || null,
          releaseMesaSnapshot: shouldReleaseMesaSnapshot
        })
      ]);
      return Number(saleInvalidated || 0) + Number(orderInvalidated || 0);
    }

    return invalidateSaleCache({
      businessId,
      saleId: (payload?.sale_id as string) || null
    });
  }

  if (mutationType.startsWith('purchase.')) {
    return invalidatePurchaseCache({
      businessId,
      purchaseId: (payload?.purchase_id as string) || null,
      supplierId: (payload?.supplier_id as string) || null
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
      orderId: (payload?.order_id as string) || null,
      tableId: (payload?.table_id as string) || null,
      saleId: pickFirstSaleIdFromPayload(payload),
      releaseMesaSnapshot: shouldReleaseMesaSnapshot
    });
  }

  if (mutationType.startsWith('product.')) {
    return invalidateInventoryCache({
      businessId,
      productId: (payload?.product_id as string) || null,
      supplierId: (payload?.supplier_id as string) || null
    });
  }

  if (mutationType.startsWith('supplier.')) {
    return invalidatePurchaseCache({
      businessId,
      supplierId: (payload?.supplier_id as string) || null
    });
  }

  if (mutationType.startsWith('invoice.')) {
    return invalidateInvoiceCache({
      businessId,
      invoiceId: (payload?.invoice_id as string) || null
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
