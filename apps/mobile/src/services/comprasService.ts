import { getSupabaseClient } from '../lib/supabase';

export type CompraSupplierRecord = {
  id: string;
  business_name: string | null;
  contact_name: string | null;
};

export type CompraProductRecord = {
  id: string;
  name: string;
  purchase_price: number;
  supplier_id: string | null;
  stock: number;
  manage_stock: boolean;
  is_active: boolean;
};

export type CompraRecord = {
  id: string;
  business_id: string;
  user_id: string | null;
  supplier_id: string | null;
  payment_method: string;
  notes: string | null;
  total: number;
  created_at: string | null;
  supplier: CompraSupplierRecord | null;
};

export type CompraDetailRecord = {
  id: string;
  purchase_id: string;
  product_id: string | null;
  quantity: number;
  unit_cost: number;
  subtotal: number;
  product?: {
    name?: string;
    code?: string;
    purchase_price?: number;
  } | null;
};

export type CompraCartItem = {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  manage_stock: boolean;
};

export type ListPurchaseCatalogOptions = {
  forceRefresh?: boolean;
  ttlMs?: number;
};

export type ListRecentComprasOptions = {
  forceRefresh?: boolean;
  ttlMs?: number;
};

export type FirstCompraDayOptions = {
  forceRefresh?: boolean;
  ttlMs?: number;
};

const DEFAULT_PURCHASE_CATALOG_CACHE_TTL_MS = 45_000;
const DEFAULT_PURCHASE_HISTORY_CACHE_TTL_MS = 15_000;
const DEFAULT_FIRST_COMPRA_DAY_CACHE_TTL_MS = 5 * 60_000;
const purchaseProductsCacheByBusinessId = new Map<string, {
  items: CompraProductRecord[];
  cachedAt: number;
}>();
const purchaseSuppliersCacheByBusinessId = new Map<string, {
  items: CompraSupplierRecord[];
  cachedAt: number;
}>();
const purchaseProductsInFlightByBusinessId = new Map<string, Promise<CompraProductRecord[]>>();
const purchaseSuppliersInFlightByBusinessId = new Map<string, Promise<CompraSupplierRecord[]>>();
const purchaseHistoryCacheByKey = new Map<string, {
  items: CompraRecord[];
  cachedAt: number;
}>();
const purchaseHistoryInFlightByKey = new Map<string, Promise<CompraRecord[]>>();
const firstCompraDayCacheByBusinessId = new Map<string, {
  dayKey: string | null;
  cachedAt: number;
}>();
const firstCompraDayInFlightByBusinessId = new Map<string, Promise<string | null>>();
let recentPurchasesFastRpcCompatibility: 'unknown' | 'supported' | 'unsupported' = 'unknown';
let recentPurchasesRpcCompatibility: 'unknown' | 'supported' | 'unsupported' = 'unknown';

function buildPurchaseHistoryCacheKey(businessId: string, limit: number) {
  return `${normalizeBusinessId(businessId)}::${Math.max(1, Math.floor(Number(limit) || 0))}`;
}

function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeBusinessId(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeReference(value: unknown): string | null {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  const lower = normalized.toLowerCase();
  if (lower === 'null' || lower === 'undefined') return null;
  return normalized;
}

function normalizeNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizePurchasePaymentMethod(value: unknown): string {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) return 'cash';
  if (normalized === 'efectivo') return 'cash';
  if (normalized === 'tarjeta') return 'card';
  if (normalized === 'transferencia') return 'transfer';
  return normalized;
}

function isMissingCreatePurchaseRpcError(errorLike: any) {
  const code = normalizeText(errorLike?.code);
  const message = normalizeText(errorLike?.message).toLowerCase();
  return code === 'PGRST202'
    || code === '42883'
    || message.includes('create_purchase_complete');
}

function isMissingSupplierJoinRelationError(errorLike: any) {
  const code = normalizeText(errorLike?.code).toUpperCase();
  const message = normalizeText(errorLike?.message).toLowerCase();
  return code === 'PGRST200'
    || message.includes('could not find a relationship')
    || message.includes('relationship')
    || message.includes('purchases_supplier_id_fkey');
}

function isMissingListRecentPurchasesRpcError(errorLike: any) {
  const code = normalizeText(errorLike?.code).toUpperCase();
  const message = normalizeText(errorLike?.message).toLowerCase();
  return code === 'PGRST202'
    || code === '42883'
    || message.includes('list_recent_purchases_with_supplier')
    || message.includes('could not find the function')
    || message.includes('schema cache');
}

function isMissingListRecentPurchasesFastRpcError(errorLike: any) {
  const code = normalizeText(errorLike?.code).toUpperCase();
  const message = normalizeText(errorLike?.message).toLowerCase();
  return code === 'PGRST202'
    || code === '42883'
    || message.includes('list_recent_purchases_fast')
    || message.includes('could not find the function')
    || message.includes('schema cache');
}

function normalizeSupplier(row: any): CompraSupplierRecord {
  return {
    id: normalizeText(row?.id),
    business_name: normalizeReference(row?.business_name),
    contact_name: normalizeReference(row?.contact_name),
  };
}

function normalizeProduct(row: any): CompraProductRecord {
  return {
    id: normalizeText(row?.id),
    name: normalizeText(row?.name) || 'Producto',
    purchase_price: normalizeNumber(row?.purchase_price, 0),
    supplier_id: normalizeReference(row?.supplier_id),
    stock: normalizeNumber(row?.stock, 0),
    manage_stock: row?.manage_stock !== false,
    is_active: row?.is_active !== false,
  };
}

function normalizeCompra(row: any, supplierMap: Map<string, CompraSupplierRecord>): CompraRecord {
  const supplierId = normalizeReference(row?.supplier_id);
  const embeddedSupplier = row?.supplier ? normalizeSupplier(row.supplier) : null;
  const supplier = embeddedSupplier || (supplierId ? supplierMap.get(supplierId) || null : null);

  return {
    id: normalizeText(row?.id),
    business_id: normalizeText(row?.business_id),
    user_id: normalizeReference(row?.user_id),
    supplier_id: supplierId,
    payment_method: normalizePurchasePaymentMethod(row?.payment_method),
    notes: normalizeReference(row?.notes),
    total: normalizeNumber(row?.total, 0),
    created_at: normalizeReference(row?.created_at),
    supplier,
  };
}

function normalizeCompraDetail(row: any): CompraDetailRecord {
  return {
    id: normalizeText(row?.id),
    purchase_id: normalizeText(row?.purchase_id),
    product_id: normalizeReference(row?.product_id),
    quantity: normalizeNumber(row?.quantity, 0),
    unit_cost: normalizeNumber(row?.unit_cost, 0),
    subtotal: normalizeNumber(row?.subtotal, normalizeNumber(row?.quantity, 0) * normalizeNumber(row?.unit_cost, 0)),
    product: row?.product
      ? {
          name: row.product.name ? String(row.product.name) : undefined,
          code: row.product.code ? String(row.product.code) : undefined,
          purchase_price: normalizeNumber(row.product.purchase_price, 0),
        }
      : null,
  };
}

async function assertPurchasableProductsManageStock({
  businessId,
  cart = [],
}: {
  businessId: string;
  cart: CompraCartItem[];
}) {
  const localBlocked = (Array.isArray(cart) ? cart : []).filter((item) => item?.manage_stock === false);
  if (localBlocked.length > 0) {
    const sampleNames = localBlocked
      .map((item) => normalizeText(item?.product_name || item?.product_id))
      .filter(Boolean)
      .slice(0, 3);
    throw new Error(
      `No puedes registrar compras de productos sin control de stock${sampleNames.length ? `: ${sampleNames.join(', ')}` : ''}.`,
    );
  }

  const unknownIds = Array.from(new Set(
    (Array.isArray(cart) ? cart : [])
      .filter((item) => item?.manage_stock === undefined || item?.manage_stock === null)
      .map((item) => normalizeText(item?.product_id))
      .filter(Boolean),
  ));
  if (unknownIds.length === 0) return;

  const client = getSupabaseClient();
  const { data, error } = await client
    .from('products')
    .select('id,manage_stock')
    .eq('business_id', businessId)
    .in('id', unknownIds);

  if (error) throw error;
  const byId = new Map((Array.isArray(data) ? data : []).map((row: any) => [String(row.id), row.manage_stock !== false]));
  const blocked = unknownIds.filter((id) => byId.get(id) === false);
  if (blocked.length > 0) {
    throw new Error('No puedes registrar compras de productos sin control de stock.');
  }
}

async function createPurchaseLegacy({
  businessId,
  userId,
  supplierId,
  paymentMethod,
  notes,
  cart,
  total,
}: {
  businessId: string;
  userId: string;
  supplierId: string;
  paymentMethod: string;
  notes: string | null;
  cart: CompraCartItem[];
  total: number;
}) {
  const client = getSupabaseClient();
  const purchaseInsert = await client
    .from('purchases')
    .insert([
      {
        business_id: businessId,
        user_id: userId,
        supplier_id: supplierId,
        payment_method: paymentMethod,
        notes,
        total,
        created_at: new Date().toISOString(),
      },
    ])
    .select('id')
    .single();

  if (purchaseInsert.error) throw purchaseInsert.error;
  const purchaseId = normalizeText(purchaseInsert.data?.id);
  if (!purchaseId) throw new Error('No se pudo crear la compra.');

  const detailRows = (Array.isArray(cart) ? cart : []).map((item) => ({
    purchase_id: purchaseId,
    product_id: item.product_id,
    quantity: Number(item.quantity || 0),
    unit_cost: Number(item.unit_price || 0),
    subtotal: Number(item.quantity || 0) * Number(item.unit_price || 0),
  }));

  const detailsInsert = await client
    .from('purchase_details')
    .insert(detailRows);

  if (detailsInsert.error) {
    await client.from('purchases').delete().eq('id', purchaseId);
    throw detailsInsert.error;
  }

  const productIds = Array.from(new Set(detailRows.map((row) => normalizeText(row.product_id)).filter(Boolean)));
  if (productIds.length > 0) {
    const productsResult = await client
      .from('products')
      .select('id,stock,manage_stock')
      .eq('business_id', businessId)
      .in('id', productIds);

    if (productsResult.error) throw productsResult.error;
    const productById = new Map((Array.isArray(productsResult.data) ? productsResult.data : []).map((row: any) => [String(row.id), row]));
    const cartByProductId = new Map((Array.isArray(cart) ? cart : []).map((item) => [item.product_id, item]));

    for (const productId of productIds) {
      const product = productById.get(productId);
      const item = cartByProductId.get(productId);
      if (!product || !item) continue;

      const currentStock = normalizeNumber(product.stock, 0);
      const shouldManageStock = product.manage_stock !== false;
      const nextStock = shouldManageStock ? currentStock + Number(item.quantity || 0) : currentStock;

      const update = await client
        .from('products')
        .update({
          stock: nextStock,
          purchase_price: Number(item.unit_price || 0),
        })
        .eq('id', productId)
        .eq('business_id', businessId);

      if (update.error) throw update.error;
    }
  }

  return { purchaseId };
}

export function invalidatePurchaseCatalogCache(businessId?: string) {
  const normalizedBusinessId = normalizeBusinessId(businessId);
  if (normalizedBusinessId) {
    purchaseProductsCacheByBusinessId.delete(normalizedBusinessId);
    purchaseSuppliersCacheByBusinessId.delete(normalizedBusinessId);
    purchaseProductsInFlightByBusinessId.delete(normalizedBusinessId);
    purchaseSuppliersInFlightByBusinessId.delete(normalizedBusinessId);
    return;
  }

  purchaseProductsCacheByBusinessId.clear();
  purchaseSuppliersCacheByBusinessId.clear();
  purchaseProductsInFlightByBusinessId.clear();
  purchaseSuppliersInFlightByBusinessId.clear();
}

export function invalidatePurchaseHistoryCache(businessId?: string) {
  const normalizedBusinessId = normalizeBusinessId(businessId);
  if (normalizedBusinessId) {
    Array.from(purchaseHistoryCacheByKey.keys()).forEach((key) => {
      if (key.startsWith(`${normalizedBusinessId}::`)) {
        purchaseHistoryCacheByKey.delete(key);
      }
    });
    Array.from(purchaseHistoryInFlightByKey.keys()).forEach((key) => {
      if (key.startsWith(`${normalizedBusinessId}::`)) {
        purchaseHistoryInFlightByKey.delete(key);
      }
    });
    firstCompraDayCacheByBusinessId.delete(normalizedBusinessId);
    firstCompraDayInFlightByBusinessId.delete(normalizedBusinessId);
    return;
  }

  purchaseHistoryCacheByKey.clear();
  purchaseHistoryInFlightByKey.clear();
  firstCompraDayCacheByBusinessId.clear();
  firstCompraDayInFlightByBusinessId.clear();
}

export async function listPurchaseProducts(
  businessId: string,
  options?: ListPurchaseCatalogOptions,
): Promise<CompraProductRecord[]> {
  const normalizedBusinessId = normalizeBusinessId(businessId);
  if (!normalizedBusinessId) return [];

  const forceRefresh = options?.forceRefresh === true;
  const ttlMs = Number.isFinite(Number(options?.ttlMs))
    ? Math.max(0, Number(options?.ttlMs))
    : DEFAULT_PURCHASE_CATALOG_CACHE_TTL_MS;

  if (!forceRefresh) {
    const cached = purchaseProductsCacheByBusinessId.get(normalizedBusinessId);
    if (cached && (Date.now() - cached.cachedAt) <= ttlMs) return cached.items;
  }

  const inFlight = purchaseProductsInFlightByBusinessId.get(normalizedBusinessId);
  if (inFlight) return inFlight;

  const request = (async () => {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('products')
      .select('id,name,purchase_price,supplier_id,stock,manage_stock,is_active')
      .eq('business_id', normalizedBusinessId)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) throw error;
    const normalized = (Array.isArray(data) ? data : []).map(normalizeProduct);
    purchaseProductsCacheByBusinessId.set(normalizedBusinessId, {
      items: normalized,
      cachedAt: Date.now(),
    });
    return normalized;
  })();

  purchaseProductsInFlightByBusinessId.set(normalizedBusinessId, request);

  try {
    return await request;
  } finally {
    purchaseProductsInFlightByBusinessId.delete(normalizedBusinessId);
  }
}

export async function listPurchaseSuppliers(
  businessId: string,
  options?: ListPurchaseCatalogOptions,
): Promise<CompraSupplierRecord[]> {
  const normalizedBusinessId = normalizeBusinessId(businessId);
  if (!normalizedBusinessId) return [];

  const forceRefresh = options?.forceRefresh === true;
  const ttlMs = Number.isFinite(Number(options?.ttlMs))
    ? Math.max(0, Number(options?.ttlMs))
    : DEFAULT_PURCHASE_CATALOG_CACHE_TTL_MS;

  if (!forceRefresh) {
    const cached = purchaseSuppliersCacheByBusinessId.get(normalizedBusinessId);
    if (cached && (Date.now() - cached.cachedAt) <= ttlMs) return cached.items;
  }

  const inFlight = purchaseSuppliersInFlightByBusinessId.get(normalizedBusinessId);
  if (inFlight) return inFlight;

  const request = (async () => {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('suppliers')
      .select('id,business_name,contact_name')
      .eq('business_id', normalizedBusinessId)
      .order('business_name', { ascending: true });

    if (error) throw error;
    const normalized = (Array.isArray(data) ? data : []).map(normalizeSupplier);
    purchaseSuppliersCacheByBusinessId.set(normalizedBusinessId, {
      items: normalized,
      cachedAt: Date.now(),
    });
    return normalized;
  })();

  purchaseSuppliersInFlightByBusinessId.set(normalizedBusinessId, request);

  try {
    return await request;
  } finally {
    purchaseSuppliersInFlightByBusinessId.delete(normalizedBusinessId);
  }
}

export async function listRecentCompras(
  businessId: string,
  limit = 40,
  options?: ListRecentComprasOptions,
): Promise<CompraRecord[]> {
  const normalizedBusinessId = normalizeBusinessId(businessId);
  if (!normalizedBusinessId) return [];
  const normalizedLimit = Math.max(1, Math.floor(Number(limit) || 40));
  const forceRefresh = options?.forceRefresh === true;
  const ttlMs = Number.isFinite(Number(options?.ttlMs))
    ? Math.max(0, Number(options?.ttlMs))
    : DEFAULT_PURCHASE_HISTORY_CACHE_TTL_MS;
  const cacheKey = buildPurchaseHistoryCacheKey(normalizedBusinessId, normalizedLimit);

  if (!forceRefresh) {
    const cached = purchaseHistoryCacheByKey.get(cacheKey);
    if (cached && (Date.now() - cached.cachedAt) <= ttlMs) return cached.items;
  }

  const inFlight = purchaseHistoryInFlightByKey.get(cacheKey);
  if (inFlight) return inFlight;

  const request = (async () => {
    const client = getSupabaseClient();
    const cachedSuppliers = purchaseSuppliersCacheByBusinessId.get(normalizedBusinessId)?.items;
    let supplierMap = new Map<string, CompraSupplierRecord>(
      (Array.isArray(cachedSuppliers) ? cachedSuppliers : []).map((supplier) => [supplier.id, supplier] as const),
    );
    let purchases: any[] = [];
    let loadedByRpc = false;

    if (recentPurchasesFastRpcCompatibility !== 'unsupported') {
      const fastRpcResult = await client.rpc('list_recent_purchases_fast', {
        p_business_id: normalizedBusinessId,
        p_limit: normalizedLimit,
      });

      if (!fastRpcResult.error) {
        recentPurchasesFastRpcCompatibility = 'supported';
        purchases = Array.isArray(fastRpcResult.data) ? fastRpcResult.data : [];
        loadedByRpc = true;
      } else if (isMissingListRecentPurchasesFastRpcError(fastRpcResult.error)) {
        recentPurchasesFastRpcCompatibility = 'unsupported';
      } else {
        throw fastRpcResult.error;
      }
    }

    if (!loadedByRpc && recentPurchasesRpcCompatibility !== 'unsupported') {
      const rpcResult = await client.rpc('list_recent_purchases_with_supplier', {
        p_business_id: normalizedBusinessId,
        p_limit: normalizedLimit,
      });

      if (!rpcResult.error) {
        recentPurchasesRpcCompatibility = 'supported';
        purchases = Array.isArray(rpcResult.data) ? rpcResult.data : [];
        loadedByRpc = true;
      } else if (isMissingListRecentPurchasesRpcError(rpcResult.error)) {
        recentPurchasesRpcCompatibility = 'unsupported';
      } else {
        throw rpcResult.error;
      }
    }

    if (!loadedByRpc) {
      const enrichedPurchases = await client
        .from('purchases')
        .select(`
          id,
          business_id,
          user_id,
          supplier_id,
          payment_method,
          notes,
          total,
          created_at,
          supplier:suppliers!purchases_supplier_id_fkey (
            id,
            business_name,
            contact_name
          )
        `)
        .eq('business_id', normalizedBusinessId)
        .order('created_at', { ascending: false })
        .limit(normalizedLimit);

      if (!enrichedPurchases.error) {
        purchases = Array.isArray(enrichedPurchases.data) ? enrichedPurchases.data : [];
      } else if (isMissingSupplierJoinRelationError(enrichedPurchases.error)) {
        const fallbackPurchases = await client
          .from('purchases')
          .select('id,business_id,user_id,supplier_id,payment_method,notes,total,created_at')
          .eq('business_id', normalizedBusinessId)
          .order('created_at', { ascending: false })
          .limit(normalizedLimit);

        if (fallbackPurchases.error) throw fallbackPurchases.error;
        purchases = Array.isArray(fallbackPurchases.data) ? fallbackPurchases.data : [];

        const supplierIds = Array.from(new Set(
          purchases.map((row: any) => normalizeReference(row?.supplier_id)).filter(Boolean) as string[],
        ));

        if (supplierIds.length > 0) {
          const suppliersResult = await client
            .from('suppliers')
            .select('id,business_name,contact_name')
            .eq('business_id', normalizedBusinessId)
            .in('id', supplierIds);

          if (suppliersResult.error) throw suppliersResult.error;
          supplierMap = new Map(
            (Array.isArray(suppliersResult.data) ? suppliersResult.data : []).map((row: any) => {
              const normalized = normalizeSupplier(row);
              return [normalized.id, normalized] as const;
            }),
          );
        }
      } else {
        throw enrichedPurchases.error;
      }
    }

    const normalized = purchases.map((row: any) => normalizeCompra(row, supplierMap));
    purchaseHistoryCacheByKey.set(cacheKey, {
      items: normalized,
      cachedAt: Date.now(),
    });
    return normalized;
  })();

  purchaseHistoryInFlightByKey.set(cacheKey, request);

  try {
    return await request;
  } finally {
    purchaseHistoryInFlightByKey.delete(cacheKey);
  }
}

export async function getFirstCompraDayKey(
  businessId: string,
  options?: FirstCompraDayOptions,
): Promise<string | null> {
  const normalizedBusinessId = normalizeBusinessId(businessId);
  if (!normalizedBusinessId) return null;
  const forceRefresh = options?.forceRefresh === true;
  const ttlMs = Number.isFinite(Number(options?.ttlMs))
    ? Math.max(0, Number(options?.ttlMs))
    : DEFAULT_FIRST_COMPRA_DAY_CACHE_TTL_MS;

  if (!forceRefresh) {
    const cached = firstCompraDayCacheByBusinessId.get(normalizedBusinessId);
    if (cached && (Date.now() - cached.cachedAt) <= ttlMs) return cached.dayKey;
  }

  const inFlight = firstCompraDayInFlightByBusinessId.get(normalizedBusinessId);
  if (inFlight) return inFlight;

  const request = (async () => {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('purchases')
    .select('created_at')
    .eq('business_id', normalizedBusinessId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  const rawDate = normalizeReference(data?.created_at);
  if (!rawDate) {
    firstCompraDayCacheByBusinessId.set(normalizedBusinessId, {
      dayKey: null,
      cachedAt: Date.now(),
    });
    return null;
  }

  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) {
    firstCompraDayCacheByBusinessId.set(normalizedBusinessId, {
      dayKey: null,
      cachedAt: Date.now(),
    });
    return null;
  }

  const year = parsed.getFullYear();
  const month = `${parsed.getMonth() + 1}`.padStart(2, '0');
  const day = `${parsed.getDate()}`.padStart(2, '0');
  const dayKey = `${year}-${month}-${day}`;
  firstCompraDayCacheByBusinessId.set(normalizedBusinessId, {
    dayKey,
    cachedAt: Date.now(),
  });
  return dayKey;
  })();

  firstCompraDayInFlightByBusinessId.set(normalizedBusinessId, request);

  try {
    return await request;
  } finally {
    firstCompraDayInFlightByBusinessId.delete(normalizedBusinessId);
  }
}

export async function listCompraDetails(purchaseId: string): Promise<CompraDetailRecord[]> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('purchase_details')
    .select('id,purchase_id,product_id,quantity,unit_cost,subtotal,product:products(name,code,purchase_price)')
    .eq('purchase_id', purchaseId)
    .order('id', { ascending: true });

  if (error) throw error;
  return (Array.isArray(data) ? data : []).map(normalizeCompraDetail);
}

export async function createCompraWithRpcFallback({
  businessId,
  userId,
  supplierId,
  paymentMethod,
  notes,
  cart,
}: {
  businessId: string;
  userId: string;
  supplierId: string;
  paymentMethod: string;
  notes?: string | null;
  cart: CompraCartItem[];
}): Promise<{ purchaseId: string | null; total: number }> {
  if (!Array.isArray(cart) || cart.length === 0) {
    throw new Error('Agrega al menos un producto a la compra.');
  }
  if (!supplierId) {
    throw new Error('Selecciona un proveedor.');
  }

  await assertPurchasableProductsManageStock({ businessId, cart });

  const normalizedPaymentMethod = normalizePurchasePaymentMethod(paymentMethod);
  const normalizedNotes = normalizeReference(notes);
  const purchaseItemsPayload = cart.map((item) => ({
    product_id: item.product_id,
    quantity: Number(item.quantity || 0),
    unit_cost: Number(item.unit_price || 0),
  }));
  const total = cart.reduce(
    (sum, item) => sum + (Number(item.quantity || 0) * Number(item.unit_price || 0)),
    0,
  );

  const client = getSupabaseClient();
  let rpcData: any = null;
  let rpcError: any = null;
  ({ data: rpcData, error: rpcError } = await client.rpc('create_purchase_complete', {
    p_business_id: businessId,
    p_user_id: userId,
    p_supplier_id: supplierId,
    p_payment_method: normalizedPaymentMethod,
    p_notes: normalizedNotes,
    p_items: purchaseItemsPayload,
  }));

  let purchaseId: string | null = null;
  if (rpcError) {
    if (!isMissingCreatePurchaseRpcError(rpcError)) {
      throw new Error(rpcError.message || 'Error al registrar la compra.');
    }

    const legacy = await createPurchaseLegacy({
      businessId,
      userId,
      supplierId,
      paymentMethod: normalizedPaymentMethod,
      notes: normalizedNotes,
      cart,
      total,
    });
    purchaseId = normalizeReference(legacy.purchaseId);
  } else {
    const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    purchaseId = normalizeReference(row?.purchase_id);
  }

  invalidatePurchaseHistoryCache(businessId);

  return {
    purchaseId,
    total,
  };
}

export async function deleteCompraWithStockFallback({
  purchaseId,
  businessId,
}: {
  purchaseId: string;
  businessId: string;
}): Promise<{ appliedManualFallback: boolean }> {
  const client = getSupabaseClient();
  const detailsResult = await client
    .from('purchase_details')
    .select('product_id,quantity')
    .eq('purchase_id', purchaseId);
  if (detailsResult.error) throw detailsResult.error;

  const groupedMap = new Map<string, number>();
  (Array.isArray(detailsResult.data) ? detailsResult.data : []).forEach((row: any) => {
    const productId = normalizeReference(row?.product_id);
    const quantity = Number(row?.quantity || 0);
    if (!productId || quantity <= 0) return;
    groupedMap.set(productId, (groupedMap.get(productId) || 0) + quantity);
  });
  const grouped = Array.from(groupedMap.entries()).map(([product_id, quantity]) => ({ product_id, quantity }));
  const productIds = grouped.map((row) => row.product_id);

  let beforeMap = new Map<string, { stock: number; manage_stock: boolean }>();
  if (productIds.length > 0) {
    const beforeResult = await client
      .from('products')
      .select('id,stock,manage_stock')
      .eq('business_id', businessId)
      .in('id', productIds);

    if (beforeResult.error) throw beforeResult.error;
    beforeMap = new Map(
      (Array.isArray(beforeResult.data) ? beforeResult.data : []).map((row: any) => [
        String(row.id),
        { stock: Number(row.stock || 0), manage_stock: row.manage_stock !== false },
      ]),
    );
  }

  const deleteDetails = await client
    .from('purchase_details')
    .delete()
    .eq('purchase_id', purchaseId);
  if (deleteDetails.error) throw deleteDetails.error;

  const deletePurchase = await client
    .from('purchases')
    .delete()
    .eq('id', purchaseId)
    .eq('business_id', businessId);
  if (deletePurchase.error) throw deletePurchase.error;

  let appliedManualFallback = false;
  if (productIds.length > 0) {
    const afterResult = await client
      .from('products')
      .select('id,stock,manage_stock')
      .eq('business_id', businessId)
      .in('id', productIds);

    if (afterResult.error) throw afterResult.error;
    const afterMap = new Map(
      (Array.isArray(afterResult.data) ? afterResult.data : []).map((row: any) => [
        String(row.id),
        { stock: Number(row.stock || 0), manage_stock: row.manage_stock !== false },
      ]),
    );

    const managedGrouped = grouped.filter((row) => beforeMap.get(row.product_id)?.manage_stock !== false);
    const unchanged = managedGrouped.every((row) => {
      const before = beforeMap.get(row.product_id)?.stock;
      const after = afterMap.get(row.product_id)?.stock;
      return Number.isFinite(before) && Number.isFinite(after) && before === after;
    });

    if (unchanged) {
      for (const row of managedGrouped) {
        const afterStock = afterMap.get(row.product_id)?.stock;
        if (!Number.isFinite(afterStock)) continue;
        const nextStock = Number(afterStock) - Number(row.quantity || 0);

        const update = await client
          .from('products')
          .update({ stock: nextStock })
          .eq('id', row.product_id)
          .eq('business_id', businessId);

        if (update.error) throw update.error;
      }
      appliedManualFallback = true;
    }
  }

  invalidatePurchaseHistoryCache(businessId);

  return { appliedManualFallback };
}
