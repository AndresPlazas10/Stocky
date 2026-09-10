import { readCacheInvalidateMatching } from './readCacheStore.js';

function nonEmpty(value: unknown): string | null {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

async function invalidateLocalReadCachePrefixes(prefixes: Array<string | null> = []): Promise<number> {
  const filtered = [...new Set((prefixes || []).map(nonEmpty).filter(Boolean))];
  if (filtered.length === 0) return 0;

  return readCacheInvalidateMatching((key) => (
    filtered.some((prefix) => key.startsWith(prefix))
  ));
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

export async function invalidateOrderCache(params: { businessId?: string | null; orderId?: string | null; tableId?: string | null; saleId?: string | null } = {}): Promise<number> {
  const { businessId, orderId = null, tableId = null, saleId = null } = params;
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
  return invalidateLocalReadCachePrefixes(prefixes);
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

export default {
  invalidatePurchaseCache,
  invalidateOrderCache,
  invalidateInventoryCache,
  invalidateComboCache,
  invalidateInvoiceCache
};
