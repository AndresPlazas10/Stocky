import { getSupabaseClient } from '../lib/supabase';

export type MesaOrderProduct = {
  id: string;
  item_type: 'product';
  product_id: string;
  combo_id: null;
  name: string;
  code: string | null;
  sale_price: number;
  stock: number;
  manage_stock: boolean;
  combo_items: [];
};

export type MesaOrderCombo = {
  id: string;
  item_type: 'combo';
  product_id: null;
  combo_id: string;
  name: string;
  code: null;
  sale_price: number;
  stock: null;
  manage_stock: false;
  combo_items: Array<{
    producto_id: string;
    cantidad: number;
    products?: {
      id?: string;
      name?: string;
      stock?: number;
      manage_stock?: boolean;
    } | null;
  }>;
};

export type MesaOrderCatalogItem = MesaOrderProduct | MesaOrderCombo;

export type MesaOrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  combo_id: string | null;
  quantity: number;
  price: number;
  subtotal: number;
  products?: {
    id?: string;
    name?: string;
    code?: string;
    category?: string;
  } | null;
  combos?: {
    id?: string;
    nombre?: string;
  } | null;
};

export type StockShortage = {
  product_id: string;
  product_name: string;
  available_stock: number;
  quantity: number;
};

export type ComboComponentShortage = {
  product_id: string;
  product_name: string;
  available_stock: number;
  required_quantity: number;
};

export type CatalogLookup = {
  productById: Map<string, MesaOrderProduct>;
  comboById: Map<string, MesaOrderCombo>;
};

export type ListCatalogItemsOptions = {
  forceRefresh?: boolean;
  ttlMs?: number;
};

export type MesaOpenOrderSnapshot = {
  orderId: string;
  items: MesaOrderItem[];
  total: number;
  units: number;
};

const DEFAULT_CATALOG_CACHE_TTL_MS = 180_000;
const catalogCacheByBusinessId = new Map<string, {
  items: MesaOrderCatalogItem[];
  cachedAt: number;
}>();
const catalogInFlightByBusinessId = new Map<string, Promise<MesaOrderCatalogItem[]>>();
const ORDER_ITEMS_CACHE_TTL_MS = 120_000;
const orderItemsCacheByOrderId = new Map<string, {
  items: MesaOrderItem[];
  cachedAt: number;
}>();
const orderItemsInFlightByOrderId = new Map<string, Promise<MesaOrderItem[]>>();
let openOrderSnapshotFastRpcCompatibility: 'unknown' | 'supported' | 'unsupported' = 'unknown';
let openOrderSnapshotRpcCompatibility: 'unknown' | 'supported' | 'unsupported' = 'unknown';

function normalizeNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeText(value: unknown, fallback = ''): string {
  const raw = String(value || '').trim();
  return raw || fallback;
}

function normalizeBusinessId(value: unknown): string {
  return String(value || '').trim();
}

function normalizeOrderId(value: unknown): string {
  return String(value || '').trim();
}

function compareCatalogNames(left: MesaOrderCatalogItem, right: MesaOrderCatalogItem): number {
  const leftName = String(left?.name || '').trim();
  const rightName = String(right?.name || '').trim();
  return leftName.localeCompare(rightName, 'es', { sensitivity: 'base' });
}

function mergeCatalogByName(
  products: MesaOrderProduct[],
  combos: MesaOrderCombo[],
): MesaOrderCatalogItem[] {
  const merged: MesaOrderCatalogItem[] = [];
  let i = 0;
  let j = 0;

  while (i < products.length && j < combos.length) {
    const product = products[i];
    const combo = combos[j];
    if (compareCatalogNames(product, combo) <= 0) {
      merged.push(product);
      i += 1;
    } else {
      merged.push(combo);
      j += 1;
    }
  }

  while (i < products.length) {
    merged.push(products[i]);
    i += 1;
  }

  while (j < combos.length) {
    merged.push(combos[j]);
    j += 1;
  }

  return merged;
}

function isMissingColumnError(errorLike: any, { tableName, columnName }: { tableName: string; columnName: string }) {
  const message = String(errorLike?.message || '').toLowerCase();
  return (
    message.includes('column')
    && message.includes(`"${String(columnName || '').toLowerCase()}"`)
    && message.includes('relation')
    && message.includes(`"${String(tableName || '').toLowerCase()}"`)
    && message.includes('does not exist')
  );
}

function isFunctionUnavailableError(errorLike: any, functionName: string) {
  const code = String(errorLike?.code || '').toLowerCase();
  const message = String(errorLike?.message || '').toLowerCase();
  return (
    code === 'pgrst202'
    || code === '42883'
    || (
      message.includes(String(functionName || '').toLowerCase())
      && (
        message.includes('does not exist')
        || message.includes('could not find the function')
        || message.includes('schema cache')
        || message.includes('not found')
      )
    )
  );
}

function isMissingListOpenOrderSnapshotRpcError(errorLike: any) {
  return isFunctionUnavailableError(errorLike, 'list_open_order_snapshot');
}

function isMissingListOpenOrderSnapshotFastRpcError(errorLike: any) {
  return isFunctionUnavailableError(errorLike, 'list_open_order_snapshot_fast');
}

function normalizeJsonArray(value: unknown): any[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    return [];
  }
}

function normalizeProduct(row: any): MesaOrderProduct {
  const id = normalizeText(row?.id);
  return {
    id,
    item_type: 'product',
    product_id: id,
    combo_id: null,
    name: normalizeText(row?.name, 'Producto'),
    code: row?.code ? String(row.code) : null,
    sale_price: normalizeNumber(row?.sale_price, 0),
    stock: normalizeNumber(row?.stock, 0),
    manage_stock: row?.manage_stock !== false,
    combo_items: [],
  };
}

function normalizeCombo(row: any): MesaOrderCombo {
  const id = normalizeText(row?.id);
  const comboItemsSource = Array.isArray(row?.combo_items) ? row.combo_items : [];

  return {
    id,
    item_type: 'combo',
    product_id: null,
    combo_id: id,
    name: normalizeText(row?.nombre || row?.name, 'Combo'),
    code: null,
    sale_price: normalizeNumber(row?.precio_venta ?? row?.sale_price, 0),
    stock: null,
    manage_stock: false,
    combo_items: comboItemsSource
      .map((item: any) => ({
        producto_id: normalizeText(item?.producto_id),
        cantidad: normalizeNumber(item?.cantidad, 0),
        products: item?.products
          ? {
              id: item.products.id ? String(item.products.id) : undefined,
              name: item.products.name ? String(item.products.name) : undefined,
              stock: normalizeNumber(item.products.stock, 0),
              manage_stock: item.products.manage_stock !== false,
            }
          : null,
      }))
      .filter((item: any) => item.producto_id && item.cantidad > 0),
  };
}

function normalizeOrderItem(row: any): MesaOrderItem {
  const quantity = normalizeNumber(row?.quantity, 0);
  const price = normalizeNumber(row?.price, 0);
  const subtotal = normalizeNumber(row?.subtotal, quantity * price);

  return {
    id: normalizeText(row?.id),
    order_id: normalizeText(row?.order_id),
    product_id: row?.product_id ? String(row.product_id) : null,
    combo_id: row?.combo_id ? String(row.combo_id) : null,
    quantity,
    price,
    subtotal,
    products: row?.products
      ? {
          id: row.products.id ? String(row.products.id) : undefined,
          name: row.products.name ? String(row.products.name) : undefined,
          code: row.products.code ? String(row.products.code) : undefined,
          category: row.products.category ? String(row.products.category) : undefined,
        }
      : null,
    combos: row?.combos
      ? {
          id: row.combos.id ? String(row.combos.id) : undefined,
          nombre: row.combos.nombre ? String(row.combos.nombre) : undefined,
        }
      : null,
  };
}

export function getOrderItemName(item: MesaOrderItem): string {
  return item?.products?.name || item?.combos?.nombre || 'Item';
}

export function calculateOrderTotal(items: MesaOrderItem[]): number {
  return (Array.isArray(items) ? items : []).reduce(
    (sum, item) => sum + normalizeNumber(item.subtotal, normalizeNumber(item.quantity, 0) * normalizeNumber(item.price, 0)),
    0,
  );
}

function calculateOrderUnits(items: MesaOrderItem[]): number {
  return (Array.isArray(items) ? items : []).reduce(
    (sum, item) => sum + Math.max(0, Math.floor(normalizeNumber(item?.quantity, 0))),
    0,
  );
}

export function calculateCashChange(total: number, amountReceived: string | number | null | undefined) {
  const normalizedTotal = Math.round(normalizeNumber(total, 0));
  const raw = String(amountReceived ?? '').trim().replace(/\s|\$/g, '');
  const normalizedPaid = raw ? Number(raw.replace(/\./g, '').replace(',', '.')) : NaN;

  if (!Number.isFinite(normalizedPaid)) {
    return { isValid: false, change: 0, paid: 0, reason: 'invalid' as const };
  }
  if (normalizedPaid < normalizedTotal) {
    return { isValid: false, change: 0, paid: normalizedPaid, reason: 'insufficient' as const };
  }

  return {
    isValid: true,
    change: Math.round(normalizedPaid - normalizedTotal),
    paid: Math.round(normalizedPaid),
    reason: null,
  } as const;
}

export async function listProductsForMesaOrder(businessId: string): Promise<MesaOrderProduct[]> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('products')
    .select('id, code, name, sale_price, stock, manage_stock')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .order('name', { ascending: true })
    .limit(300);

  if (error) throw error;
  return (Array.isArray(data) ? data : []).map(normalizeProduct);
}

export async function listCombosForMesaOrder(businessId: string): Promise<MesaOrderCombo[]> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('combos')
    .select(`
      id,
      nombre,
      precio_venta,
      estado,
      combo_items (
        producto_id,
        cantidad
      )
    `)
    .eq('business_id', businessId)
    .order('nombre', { ascending: true })
    .limit(200);

  if (error) throw error;

  return (Array.isArray(data) ? data : [])
    .filter((row: any) => String(row?.estado || 'active').toLowerCase() !== 'inactive')
    .map(normalizeCombo);
}

function hydrateComboComponentsWithProducts(
  combos: MesaOrderCombo[],
  products: MesaOrderProduct[],
): MesaOrderCombo[] {
  const productById = new Map<string, MesaOrderProduct>();
  (Array.isArray(products) ? products : []).forEach((product) => {
    const productId = normalizeText(product?.product_id);
    if (!productId) return;
    productById.set(productId, product);
  });

  return (Array.isArray(combos) ? combos : []).map((combo) => ({
    ...combo,
    combo_items: (Array.isArray(combo.combo_items) ? combo.combo_items : []).map((component) => {
      if (component?.products) return component;
      const productId = normalizeText(component?.producto_id);
      const product = productById.get(productId);
      if (!product) return component;
      return {
        ...component,
        products: {
          id: product.product_id,
          name: product.name,
          stock: product.stock,
          manage_stock: product.manage_stock,
        },
      };
    }),
  }));
}

export function invalidateCatalogItemsCache(businessId?: string) {
  const normalizedBusinessId = normalizeBusinessId(businessId);
  if (normalizedBusinessId) {
    catalogCacheByBusinessId.delete(normalizedBusinessId);
    catalogInFlightByBusinessId.delete(normalizedBusinessId);
    return;
  }

  catalogCacheByBusinessId.clear();
  catalogInFlightByBusinessId.clear();
}

export function invalidateOrderItemsCache(orderId?: string) {
  const normalizedOrderId = normalizeOrderId(orderId);
  if (normalizedOrderId) {
    orderItemsCacheByOrderId.delete(normalizedOrderId);
    orderItemsInFlightByOrderId.delete(normalizedOrderId);
    return;
  }

  orderItemsCacheByOrderId.clear();
  orderItemsInFlightByOrderId.clear();
}

export async function listCatalogItems(
  businessId: string,
  options?: ListCatalogItemsOptions,
): Promise<MesaOrderCatalogItem[]> {
  const normalizedBusinessId = normalizeBusinessId(businessId);
  if (!normalizedBusinessId) return [];

  const forceRefresh = options?.forceRefresh === true;
  const ttlMs = Number.isFinite(Number(options?.ttlMs))
    ? Math.max(1_000, Number(options?.ttlMs))
    : DEFAULT_CATALOG_CACHE_TTL_MS;

  if (!forceRefresh) {
    const cached = catalogCacheByBusinessId.get(normalizedBusinessId);
    if (cached && (Date.now() - cached.cachedAt) <= ttlMs) {
      return cached.items;
    }
  }

  const inFlight = catalogInFlightByBusinessId.get(normalizedBusinessId);
  if (inFlight) return inFlight;

  const loadPromise = Promise.all([
    listProductsForMesaOrder(normalizedBusinessId),
    listCombosForMesaOrder(normalizedBusinessId),
  ])
    .then(([products, combos]) => {
      const hydratedCombos = hydrateComboComponentsWithProducts(combos, products);
      const merged = mergeCatalogByName(products, hydratedCombos);

      catalogCacheByBusinessId.set(normalizedBusinessId, {
        items: merged,
        cachedAt: Date.now(),
      });
      return merged;
    })
    .finally(() => {
      if (catalogInFlightByBusinessId.get(normalizedBusinessId) === loadPromise) {
        catalogInFlightByBusinessId.delete(normalizedBusinessId);
      }
    });

  catalogInFlightByBusinessId.set(normalizedBusinessId, loadPromise);
  return loadPromise;
}

async function listOrderItemsBase(orderId: string) {
  const client = getSupabaseClient();

  return client
    .from('order_items')
    .select(`
      id,
      order_id,
      product_id,
      combo_id,
      quantity,
      price,
      subtotal,
      products:products!order_items_product_id_fkey (id,name,category),
      combos:combos!order_items_combo_id_fkey (id,nombre)
    `)
    .eq('order_id', orderId)
    .order('id', { ascending: true });
}

export async function listOrderItems(
  orderId: string,
  options?: { forceRefresh?: boolean },
): Promise<MesaOrderItem[]> {
  const normalizedOrderId = normalizeOrderId(orderId);
  if (!normalizedOrderId) return [];
  const forceRefresh = options?.forceRefresh === true;

  if (!forceRefresh) {
    const cached = orderItemsCacheByOrderId.get(normalizedOrderId);
    if (cached && (Date.now() - cached.cachedAt) <= ORDER_ITEMS_CACHE_TTL_MS) {
      return cached.items;
    }
    const inFlight = orderItemsInFlightByOrderId.get(normalizedOrderId);
    if (inFlight) return inFlight;
  }

  const loadPromise = (async () => {
    const result = await listOrderItemsBase(normalizedOrderId);
    if (result.error) throw result.error;
    return (Array.isArray(result.data) ? result.data : []).map(normalizeOrderItem);
  })()
    .then((items) => {
      orderItemsCacheByOrderId.set(normalizedOrderId, {
        items,
        cachedAt: Date.now(),
      });
      return items;
    })
    .finally(() => {
      if (orderItemsInFlightByOrderId.get(normalizedOrderId) === loadPromise) {
        orderItemsInFlightByOrderId.delete(normalizedOrderId);
      }
    });

  orderItemsInFlightByOrderId.set(normalizedOrderId, loadPromise);
  return loadPromise;
}

export function getOrderItemsCacheSnapshot(orderId: string): { items: MesaOrderItem[]; cachedAt: number } | null {
  const normalizedOrderId = normalizeOrderId(orderId);
  if (!normalizedOrderId) return null;
  return orderItemsCacheByOrderId.get(normalizedOrderId) || null;
}

export function setOrderItemsCacheSnapshot(orderId: string, items: MesaOrderItem[]): void {
  const normalizedOrderId = normalizeOrderId(orderId);
  if (!normalizedOrderId) return;
  orderItemsCacheByOrderId.set(normalizedOrderId, {
    items: Array.isArray(items) ? items : [],
    cachedAt: Date.now(),
  });
}

export async function loadOpenOrderSnapshot(
  orderId: string,
  options?: { forceRefresh?: boolean },
): Promise<MesaOpenOrderSnapshot> {
  const normalizedOrderId = normalizeOrderId(orderId);
  if (!normalizedOrderId) {
    return {
      orderId: '',
      items: [],
      total: 0,
      units: 0,
    };
  }

  const forceRefresh = options?.forceRefresh === true;
  if (!forceRefresh) {
    const cached = orderItemsCacheByOrderId.get(normalizedOrderId);
    if (cached && (Date.now() - cached.cachedAt) <= ORDER_ITEMS_CACHE_TTL_MS) {
      return {
        orderId: normalizedOrderId,
        items: cached.items,
        total: calculateOrderTotal(cached.items),
        units: calculateOrderUnits(cached.items),
      };
    }
  }

  if (openOrderSnapshotFastRpcCompatibility !== 'unsupported') {
    const client = getSupabaseClient();
    const fastRpcResult = await client.rpc('list_open_order_snapshot_fast', {
      p_order_id: normalizedOrderId,
    });

    if (!fastRpcResult.error) {
      openOrderSnapshotFastRpcCompatibility = 'supported';
      const fastRpcRow = Array.isArray(fastRpcResult.data) ? fastRpcResult.data[0] : fastRpcResult.data;
      const items = normalizeJsonArray(fastRpcRow?.items).map(normalizeOrderItem);
      const fallbackTotal = calculateOrderTotal(items);
      const fallbackUnits = calculateOrderUnits(items);
      const total = Math.max(0, normalizeNumber(fastRpcRow?.total, fallbackTotal));
      const units = Math.max(0, Math.floor(normalizeNumber(fastRpcRow?.units, fallbackUnits)));

      orderItemsCacheByOrderId.set(normalizedOrderId, {
        items,
        cachedAt: Date.now(),
      });

      return {
        orderId: normalizedOrderId,
        items,
        total,
        units,
      };
    }

    if (isMissingListOpenOrderSnapshotFastRpcError(fastRpcResult.error)) {
      openOrderSnapshotFastRpcCompatibility = 'unsupported';
    } else {
      throw fastRpcResult.error;
    }
  }

  if (openOrderSnapshotRpcCompatibility !== 'unsupported') {
    const client = getSupabaseClient();
    const rpcResult = await client.rpc('list_open_order_snapshot', {
      p_order_id: normalizedOrderId,
    });

    if (!rpcResult.error) {
      openOrderSnapshotRpcCompatibility = 'supported';
      const rpcRow = Array.isArray(rpcResult.data) ? rpcResult.data[0] : rpcResult.data;
      const items = normalizeJsonArray(rpcRow?.items).map(normalizeOrderItem);
      const fallbackTotal = calculateOrderTotal(items);
      const fallbackUnits = calculateOrderUnits(items);
      const total = Math.max(0, normalizeNumber(rpcRow?.total, fallbackTotal));
      const units = Math.max(0, Math.floor(normalizeNumber(rpcRow?.units, fallbackUnits)));

      orderItemsCacheByOrderId.set(normalizedOrderId, {
        items,
        cachedAt: Date.now(),
      });

      return {
        orderId: normalizedOrderId,
        items,
        total,
        units,
      };
    }

    if (isMissingListOpenOrderSnapshotRpcError(rpcResult.error)) {
      openOrderSnapshotRpcCompatibility = 'unsupported';
    } else {
      throw rpcResult.error;
    }
  }

  const items = await listOrderItems(normalizedOrderId, { forceRefresh });
  return {
    orderId: normalizedOrderId,
    items,
    total: calculateOrderTotal(items),
    units: calculateOrderUnits(items),
  };
}

export async function listOrderItemUnitsByOrderIds(orderIds: string[]): Promise<Record<string, number>> {
  const normalizedIds = Array.from(
    new Set(
      (Array.isArray(orderIds) ? orderIds : [])
        .map((id) => String(id || '').trim())
        .filter(Boolean),
    ),
  );

  if (normalizedIds.length === 0) return {};

  const client = getSupabaseClient();
  const { data, error } = await client
    .from('order_items')
    .select('order_id, quantity')
    .in('order_id', normalizedIds);

  if (error) throw error;

  const totals: Record<string, number> = {};
  (Array.isArray(data) ? data : []).forEach((row: any) => {
    const orderId = normalizeText(row?.order_id);
    if (!orderId) return;
    const quantity = Math.max(0, Math.floor(normalizeNumber(row?.quantity, 0)));
    totals[orderId] = (totals[orderId] || 0) + quantity;
  });

  return totals;
}

export async function syncOrderTotal(orderId: string): Promise<number> {
  const client = getSupabaseClient();
  const items = await listOrderItems(orderId);
  const total = calculateOrderTotal(items);

  const withTotal = await client
    .from('orders')
    .update({ total })
    .eq('id', orderId);

  if (withTotal.error && !isMissingColumnError(withTotal.error, { tableName: 'orders', columnName: 'total' })) {
    throw withTotal.error;
  }

  return total;
}

async function persistOrderTotal(orderId: string, total: number): Promise<void> {
  const client = getSupabaseClient();
  const withTotal = await client
    .from('orders')
    .update({ total })
    .eq('id', orderId);

  if (withTotal.error && !isMissingColumnError(withTotal.error, { tableName: 'orders', columnName: 'total' })) {
    throw withTotal.error;
  }
}

async function updateOrderItemSubtotal({ itemId, quantity, price }: { itemId: string; quantity: number; price: number }) {
  const client = getSupabaseClient();
  const withSubtotal = await client
    .from('order_items')
    .update({ quantity, subtotal: quantity * price })
    .eq('id', itemId);

  if (!withSubtotal.error) return;

  const fallback = await client
    .from('order_items')
    .update({ quantity })
    .eq('id', itemId);

  if (!fallback.error) return;

  throw fallback.error;
}

export async function addCatalogItemToOrder({
  orderId,
  catalogItem,
  quantity = 1,
}: {
  orderId: string;
  catalogItem: MesaOrderCatalogItem;
  quantity?: number;
}): Promise<{ item: MesaOrderItem }> {
  const client = getSupabaseClient();
  const safeQty = Math.max(1, Math.floor(normalizeNumber(quantity, 1)));

  let existingQuery = client
    .from('order_items')
    .select('id, quantity, price')
    .eq('order_id', orderId)
    .limit(1);

  if (catalogItem.item_type === 'combo') {
    existingQuery = existingQuery.eq('combo_id', catalogItem.combo_id).is('product_id', null);
  } else {
    existingQuery = existingQuery.eq('product_id', catalogItem.product_id).is('combo_id', null);
  }

  const { data: existingItem, error: existingError } = await existingQuery.maybeSingle();
  if (existingError) throw existingError;

  if (existingItem?.id) {
    const nextQuantity = normalizeNumber(existingItem.quantity, 0) + safeQty;
    const itemPrice = normalizeNumber(existingItem.price, catalogItem.sale_price);
    await updateOrderItemSubtotal({ itemId: String(existingItem.id), quantity: nextQuantity, price: itemPrice });
    invalidateOrderItemsCache(orderId);
    return {
      item: {
        id: String(existingItem.id),
        order_id: orderId,
        product_id: catalogItem.item_type === 'product' ? catalogItem.product_id : null,
        combo_id: catalogItem.item_type === 'combo' ? catalogItem.combo_id : null,
        quantity: nextQuantity,
        price: itemPrice,
        subtotal: nextQuantity * itemPrice,
        products: null,
        combos: null,
      },
    };
  } else {
    const row = {
      order_id: orderId,
      product_id: catalogItem.item_type === 'product' ? catalogItem.product_id : null,
      combo_id: catalogItem.item_type === 'combo' ? catalogItem.combo_id : null,
      quantity: safeQty,
      price: catalogItem.sale_price,
    };

    const insert = await client
      .from('order_items')
      .insert([row])
      .select('id')
      .single();

    if (insert.error) throw insert.error;
    invalidateOrderItemsCache(orderId);
    return {
      item: {
        id: normalizeText(insert.data?.id),
        order_id: orderId,
        product_id: catalogItem.item_type === 'product' ? catalogItem.product_id : null,
        combo_id: catalogItem.item_type === 'combo' ? catalogItem.combo_id : null,
        quantity: safeQty,
        price: normalizeNumber(catalogItem.sale_price, 0),
        subtotal: safeQty * normalizeNumber(catalogItem.sale_price, 0),
        products: null,
        combos: null,
      },
    };
  }
}

export async function addProductToOrder({
  orderId,
  product,
  quantity = 1,
}: {
  orderId: string;
  product: MesaOrderProduct;
  quantity?: number;
}): Promise<{ item: MesaOrderItem }> {
  return addCatalogItemToOrder({
    orderId,
    catalogItem: product,
    quantity,
  });
}

export async function updateOrderItemQuantityInOrder({
  orderId,
  itemId,
  quantity,
}: {
  orderId: string;
  itemId: string;
  quantity: number;
}): Promise<{ items: MesaOrderItem[]; total: number }> {
  const client = getSupabaseClient();
  const safeQty = Math.floor(normalizeNumber(quantity, 0));

  if (safeQty <= 0) {
    return removeOrderItemFromOrder({ orderId, itemId });
  }

  const { data: currentItem, error: currentError } = await client
    .from('order_items')
    .select('id, price')
    .eq('id', itemId)
    .maybeSingle();

  if (currentError) throw currentError;
  const currentPrice = normalizeNumber(currentItem?.price, 0);

  await updateOrderItemSubtotal({
    itemId,
    quantity: safeQty,
    price: currentPrice,
  });

  invalidateOrderItemsCache(orderId);
  const items = await listOrderItems(orderId);
  const total = calculateOrderTotal(items);
  await persistOrderTotal(orderId, total);

  return { items, total };
}

export async function syncOrderItemQuantity({
  orderId,
  itemId,
  quantity,
  price,
  total,
}: {
  orderId: string;
  itemId: string;
  quantity: number;
  price: number;
  total: number;
}): Promise<void> {
  const client = getSupabaseClient();
  const safeQty = Math.floor(normalizeNumber(quantity, 0));

  if (safeQty <= 0) {
    const { error } = await client
      .from('order_items')
      .delete()
      .eq('id', itemId);

    if (error) throw error;
  } else {
    await updateOrderItemSubtotal({
      itemId,
      quantity: safeQty,
      price: normalizeNumber(price, 0),
    });
  }

  await persistOrderTotal(orderId, Math.max(0, normalizeNumber(total, 0)));
  invalidateOrderItemsCache(orderId);
}

export async function persistOrderSnapshot({
  orderId,
  items,
  skipReload = false,
}: {
  orderId: string;
  items: MesaOrderItem[];
  skipReload?: boolean;
}): Promise<{ items: MesaOrderItem[]; total: number }> {
  const client = getSupabaseClient();
  const source = Array.isArray(items) ? items : [];

  // Canonicaliza y agrupa por identidad para evitar duplicados en insercion.
  const aggregated = new Map<string, {
    order_id: string;
    product_id: string | null;
    combo_id: string | null;
    quantity: number;
    price: number;
    referenceItem: MesaOrderItem | null;
  }>();

  source.forEach((item) => {
    const quantity = Math.max(0, Math.floor(normalizeNumber(item?.quantity, 0)));
    if (quantity <= 0) return;

    const price = Math.max(0, normalizeNumber(item?.price, 0));
    const productId = item?.product_id ? String(item.product_id) : null;
    const comboId = item?.combo_id ? String(item.combo_id) : null;
    const hasSingleIdentity = (productId ? 1 : 0) + (comboId ? 1 : 0) === 1;
    if (!hasSingleIdentity) return;

    const key = productId ? `p:${productId}` : `c:${comboId}`;
    const existing = aggregated.get(key);
    if (!existing) {
      aggregated.set(key, {
        order_id: orderId,
        product_id: productId,
        combo_id: comboId,
        quantity,
        price,
        referenceItem: item,
      });
      return;
    }

    existing.quantity += quantity;
    existing.price = price;
    if (!existing.referenceItem) {
      existing.referenceItem = item;
    }
  });

  const targetRows = Array.from(aggregated.values());
  const rpcPayload = targetRows.map((row) => ({
    product_id: row.product_id,
    combo_id: row.combo_id,
    quantity: row.quantity,
    price: row.price,
  }));
  const totalFromSnapshot = targetRows.reduce(
    (sum, row) => sum + (Math.max(0, normalizeNumber(row.quantity, 0)) * Math.max(0, normalizeNumber(row.price, 0))),
    0,
  );
  const localSnapshotItems: MesaOrderItem[] = targetRows.map((row, index) => ({
    id: normalizeText(row.referenceItem?.id) || `${row.product_id ? `p:${row.product_id}` : `c:${row.combo_id}`}-${index}`,
    order_id: orderId,
    product_id: row.product_id,
    combo_id: row.combo_id,
    quantity: Math.max(0, Math.floor(normalizeNumber(row.quantity, 0))),
    price: Math.max(0, normalizeNumber(row.price, 0)),
    subtotal: Math.max(0, Math.floor(normalizeNumber(row.quantity, 0))) * Math.max(0, normalizeNumber(row.price, 0)),
    products: row.referenceItem?.products || null,
    combos: row.referenceItem?.combos || null,
  }));

  const rpcResult = await client.rpc('persist_order_snapshot', {
    p_order_id: orderId,
    p_items: rpcPayload,
  });

  if (!rpcResult.error) {
    invalidateOrderItemsCache(orderId);
    if (skipReload) {
      return {
        items: localSnapshotItems,
        total: totalFromSnapshot,
      };
    }

    const persistedItems = await listOrderItems(orderId, { forceRefresh: true });
    const total = calculateOrderTotal(persistedItems);
    return { items: persistedItems, total };
  }

  if (!isFunctionUnavailableError(rpcResult.error, 'persist_order_snapshot')) {
    throw rpcResult.error;
  }

  const { data: currentRows, error: currentRowsError } = await client
    .from('order_items')
    .select('id, product_id, combo_id, quantity, price')
    .eq('order_id', orderId)
    .order('id', { ascending: true });

  if (currentRowsError) throw currentRowsError;

  const currentByKey = new Map<string, {
    id: string;
    product_id: string | null;
    combo_id: string | null;
    quantity: number;
    price: number;
  }>();
  const duplicateIdsToDelete: string[] = [];

  (Array.isArray(currentRows) ? currentRows : []).forEach((row: any) => {
    const rowId = normalizeText(row?.id);
    if (!rowId) return;
    const productId = row?.product_id ? String(row.product_id) : null;
    const comboId = row?.combo_id ? String(row.combo_id) : null;
    const key = productId ? `p:${productId}` : comboId ? `c:${comboId}` : '';
    if (!key) {
      duplicateIdsToDelete.push(rowId);
      return;
    }

    if (currentByKey.has(key)) {
      duplicateIdsToDelete.push(rowId);
      return;
    }

    currentByKey.set(key, {
      id: rowId,
      product_id: productId,
      combo_id: comboId,
      quantity: Math.max(0, Math.floor(normalizeNumber(row?.quantity, 0))),
      price: Math.max(0, normalizeNumber(row?.price, 0)),
    });
  });

  const targetKeys = new Set(targetRows.map((row) => (row.product_id ? `p:${row.product_id}` : `c:${row.combo_id}`)));
  const staleIdsToDelete: string[] = [];
  currentByKey.forEach((row, key) => {
    if (!targetKeys.has(key)) {
      staleIdsToDelete.push(row.id);
    }
  });

  for (const row of targetRows) {
    const key = row.product_id ? `p:${row.product_id}` : `c:${row.combo_id}`;
    const existing = currentByKey.get(key);

    if (existing?.id) {
      await updateOrderItemSubtotal({
        itemId: existing.id,
        quantity: row.quantity,
        price: row.price,
      });
      continue;
    }

    const insertResult = await client
      .from('order_items')
      .insert([{
        order_id: row.order_id,
        product_id: row.product_id,
        combo_id: row.combo_id,
        quantity: row.quantity,
        price: row.price,
      }]);

    if (insertResult.error) throw insertResult.error;
  }

  const idsToDelete = [...duplicateIdsToDelete, ...staleIdsToDelete];
  if (idsToDelete.length > 0) {
    const deleteResult = await client
      .from('order_items')
      .delete()
      .in('id', idsToDelete);

    if (deleteResult.error) throw deleteResult.error;
  }

  invalidateOrderItemsCache(orderId);
  if (skipReload) {
    await persistOrderTotal(orderId, totalFromSnapshot);
    return {
      items: localSnapshotItems,
      total: totalFromSnapshot,
    };
  }

  const persistedItems = await listOrderItems(orderId, { forceRefresh: true });
  const total = calculateOrderTotal(persistedItems);
  await persistOrderTotal(orderId, total);
  return { items: persistedItems, total };
}

export async function removeOrderItemFromOrder({
  orderId,
  itemId,
}: {
  orderId: string;
  itemId: string;
}): Promise<{ items: MesaOrderItem[]; total: number }> {
  const client = getSupabaseClient();
  const { error } = await client
    .from('order_items')
    .delete()
    .eq('id', itemId);

  if (error) throw error;

  invalidateOrderItemsCache(orderId);
  const items = await listOrderItems(orderId);
  const total = calculateOrderTotal(items);
  await persistOrderTotal(orderId, total);

  return { items, total };
}

export function evaluateOrderStockShortages({
  orderItems,
  catalogItems,
}: {
  orderItems: MesaOrderItem[];
  catalogItems: MesaOrderCatalogItem[];
}): {
  insufficientItems: StockShortage[];
  insufficientComboComponents: ComboComponentShortage[];
} {
  const items = Array.isArray(orderItems) ? orderItems : [];
  const catalog = Array.isArray(catalogItems) ? catalogItems : [];
  if (items.length === 0 || catalog.length === 0) {
    return {
      insufficientItems: [],
      insufficientComboComponents: [],
    };
  }
  const lookup = buildCatalogLookup(catalog);
  return evaluateOrderStockShortagesWithLookup({ orderItems: items, lookup });
}

export function buildCatalogLookup(catalogItems: MesaOrderCatalogItem[]): CatalogLookup {
  const productById = new Map<string, MesaOrderProduct>();
  const comboById = new Map<string, MesaOrderCombo>();
  const catalog = Array.isArray(catalogItems) ? catalogItems : [];

  catalog.forEach((item) => {
    if (item.item_type === 'product') {
      productById.set(item.product_id, item);
    } else {
      comboById.set(item.combo_id, item);
    }
  });

  return { productById, comboById };
}

export function evaluateOrderStockShortagesWithLookup({
  orderItems,
  lookup,
}: {
  orderItems: MesaOrderItem[];
  lookup: CatalogLookup;
}): {
  insufficientItems: StockShortage[];
  insufficientComboComponents: ComboComponentShortage[];
} {
  const items = Array.isArray(orderItems) ? orderItems : [];
  if (items.length === 0) {
    return {
      insufficientItems: [],
      insufficientComboComponents: [],
    };
  }

  const productById = lookup.productById;
  const comboById = lookup.comboById;

  const insufficientItems: StockShortage[] = [];

  items
    .filter((item) => item.product_id)
    .forEach((item) => {
      const product = productById.get(String(item.product_id));
      if (!product) return;
      if (product.manage_stock === false) return;

      const requested = normalizeNumber(item.quantity, 0);
      const available = normalizeNumber(product.stock, 0);

      if (requested > available) {
        insufficientItems.push({
          product_id: product.product_id,
          product_name: product.name,
          available_stock: available,
          quantity: requested,
        });
      }
    });

  const requiredByComboComponent = new Map<string, number>();

  items
    .filter((item) => item.combo_id)
    .forEach((item) => {
      const combo = comboById.get(String(item.combo_id));
      if (!combo) return;

      const comboQty = normalizeNumber(item.quantity, 0);
      combo.combo_items.forEach((component) => {
        const productId = normalizeText(component.producto_id);
        if (!productId) return;
        const componentQty = normalizeNumber(component.cantidad, 0);
        const requiredQty = comboQty * componentQty;
        if (requiredQty <= 0) return;

        const prev = requiredByComboComponent.get(productId) || 0;
        requiredByComboComponent.set(productId, prev + requiredQty);
      });
    });

  const insufficientComboComponents: ComboComponentShortage[] = [];
  requiredByComboComponent.forEach((requiredQty, productId) => {
    const product = productById.get(productId);
    const productName = product?.name || 'Producto';
    const available = normalizeNumber(product?.stock, 0);
    const manageStock = product?.manage_stock !== false;

    if (!manageStock) return;

    if (requiredQty > available) {
      insufficientComboComponents.push({
        product_id: productId,
        product_name: productName,
        available_stock: available,
        required_quantity: requiredQty,
      });
    }
  });

  return { insufficientItems, insufficientComboComponents };
}
