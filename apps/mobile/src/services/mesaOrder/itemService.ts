import { getSupabaseClient } from '../../lib/supabase';
import { normalizeText, normalizeNumber } from '../../utils/normalization';
import { isFunctionUnavailableError, isMissingColumnError } from '../../utils/supabaseErrors';
import { normalizeOrderId } from './internal';
import { calculateOrderTotal } from './utils';
import { calculateOrderUnits } from '@stocky/shared/order-normalization';
import type {
  MesaOrderItem,
  MesaOrderCatalogItem,
  MesaOpenOrderSnapshot,
} from './types';
import type { SupabaseErrorLike } from '../../types/errors';

const ORDER_ITEMS_CACHE_TTL_MS = 120_000;
const orderItemsCacheByOrderId = new Map<
  string,
  {
    items: MesaOrderItem[];
    cachedAt: number;
  }
>();
const orderItemsInFlightByOrderId = new Map<string, Promise<MesaOrderItem[]>>();
let openOrderSnapshotFastRpcCompatibility: 'unknown' | 'supported' | 'unsupported' = 'unknown';
let openOrderSnapshotRpcCompatibility: 'unknown' | 'supported' | 'unsupported' = 'unknown';

let rpcPreloadPromise: Promise<void> | null = null;

function isMissingListOpenOrderSnapshotRpcError(errorLike: SupabaseErrorLike) {
  return isFunctionUnavailableError(errorLike, 'list_open_order_snapshot');
}

function isMissingListOpenOrderSnapshotFastRpcError(errorLike: SupabaseErrorLike) {
  return isFunctionUnavailableError(errorLike, 'list_open_order_snapshot_fast');
}

function normalizeJsonArray(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value as Record<string, unknown>[];
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as Record<string, unknown>[]) : [];
  } catch (_error) {
    return [];
  }
}

function normalizeOrderItem(row: Record<string, unknown>): MesaOrderItem {
  const quantity = normalizeNumber(row?.quantity, 0);
  const price = normalizeNumber(row?.price, 0);
  const subtotal = normalizeNumber(row?.subtotal, quantity * price);

  const productRecord =
    row.products && typeof row.products === 'object' && row.products !== null
      ? (row.products as Record<string, unknown>)
      : null;
  const comboRecord =
    row.combos && typeof row.combos === 'object' && row.combos !== null
      ? (row.combos as Record<string, unknown>)
      : null;

  return {
    id: normalizeText(row?.id),
    order_id: normalizeText(row?.order_id),
    product_id: row?.product_id ? String(row.product_id) : null,
    combo_id: row?.combo_id ? String(row.combo_id) : null,
    quantity,
    price,
    subtotal,
    products: productRecord
      ? {
          id: productRecord.id ? String(productRecord.id) : undefined,
          name: productRecord.name ? String(productRecord.name) : undefined,
          code: productRecord.code ? String(productRecord.code) : undefined,
          category: productRecord.category ? String(productRecord.category) : undefined,
        }
      : null,
    category: productRecord?.category ? String(productRecord.category) : undefined,
    combos: comboRecord
      ? {
          id: comboRecord.id ? String(comboRecord.id) : undefined,
          nombre: comboRecord.nombre ? String(comboRecord.nombre) : undefined,
        }
      : null,
  };
}

async function persistOrderTotal(orderId: string, total: number): Promise<void> {
  const client = getSupabaseClient();
  const withTotal = await client.from('orders').update({ total }).eq('id', orderId);

  if (
    withTotal.error &&
    !isMissingColumnError(withTotal.error, { tableName: 'orders', columnName: 'total' })
  ) {
    throw withTotal.error;
  }
}

export async function persistOrderNotes(orderId: string, notes: string): Promise<void> {
  const client = getSupabaseClient();
  const cleanNotes = String(notes || '').trim().slice(0, 500);
  const result = await client.from('orders').update({ notes: cleanNotes }).eq('id', orderId);

  if (
    result.error &&
    !isMissingColumnError(result.error, { tableName: 'orders', columnName: 'notes' })
  ) {
    throw result.error;
  }
}

async function updateOrderItemSubtotal({
  itemId,
  quantity,
  price,
}: {
  itemId: string;
  quantity: number;
  price: number;
}) {
  const client = getSupabaseClient();
  const { error } = await client.from('order_items').update({ quantity, price }).eq('id', itemId);

  if (error) throw error;
}

async function listOrderItemsBase(orderId: string) {
  const client = getSupabaseClient();

  return client
    .from('order_items')
    .select(
      `
      id,
      order_id,
      product_id,
      combo_id,
      quantity,
      price,
      subtotal,
      products:products!order_items_product_id_fkey (id,name,category),
      combos:combos!order_items_combo_id_fkey (id,nombre)
    `,
    )
    .eq('order_id', orderId)
    .order('id', { ascending: true });
}

export function preloadRpcCompatibility(): Promise<void> {
  if (rpcPreloadPromise) return rpcPreloadPromise;

  rpcPreloadPromise = (async () => {
    try {
      const client = getSupabaseClient();
      const { error } = await client.rpc('list_open_order_snapshot_fast', {
        p_order_id: '00000000-0000-0000-0000-000000000000',
      });

      if (error) {
        if (isMissingListOpenOrderSnapshotFastRpcError(error)) {
          openOrderSnapshotFastRpcCompatibility = 'unsupported';
        } else {
          openOrderSnapshotFastRpcCompatibility = 'supported';
        }
      } else {
        openOrderSnapshotFastRpcCompatibility = 'supported';
      }
    } catch {
      openOrderSnapshotFastRpcCompatibility = 'unknown';
    }
  })();

  return rpcPreloadPromise;
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

export function setOrderItemsCacheSnapshot(orderId: string, items: MesaOrderItem[]): void {
  const normalizedOrderId = normalizeOrderId(orderId);
  if (!normalizedOrderId) return;
  orderItemsCacheByOrderId.set(normalizedOrderId, {
    items: Array.isArray(items) ? items : [],
    cachedAt: Date.now(),
  });
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
    if (cached && Date.now() - cached.cachedAt <= ORDER_ITEMS_CACHE_TTL_MS) {
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
    if (cached && Date.now() - cached.cachedAt <= ORDER_ITEMS_CACHE_TTL_MS) {
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
      const fastRpcRow = Array.isArray(fastRpcResult.data)
        ? fastRpcResult.data[0]
        : fastRpcResult.data;
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
    const { error } = await client.from('order_items').delete().eq('id', itemId);

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

  const aggregated = new Map<
    string,
    {
      order_id: string;
      product_id: string | null;
      combo_id: string | null;
      quantity: number;
      price: number;
      referenceItem: MesaOrderItem | null;
    }
  >();

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
    (sum, row) =>
      sum +
      Math.max(0, normalizeNumber(row.quantity, 0)) * Math.max(0, normalizeNumber(row.price, 0)),
    0,
  );
  const localSnapshotItems: MesaOrderItem[] = targetRows.map((row, index) => ({
    id:
      normalizeText(row.referenceItem?.id) ||
      `${row.product_id ? `p:${row.product_id}` : `c:${row.combo_id}`}-${index}`,
    order_id: orderId,
    product_id: row.product_id,
    combo_id: row.combo_id,
    quantity: Math.max(0, Math.floor(normalizeNumber(row.quantity, 0))),
    price: Math.max(0, normalizeNumber(row.price, 0)),
    subtotal:
      Math.max(0, Math.floor(normalizeNumber(row.quantity, 0))) *
      Math.max(0, normalizeNumber(row.price, 0)),
    products: row.referenceItem?.products || null,
    combos: row.referenceItem?.combos || null,
  }));

  try {
    const rpcResult = await Promise.race([
      client.rpc('persist_order_snapshot', {
        p_order_id: orderId,
        p_items: rpcPayload,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('persist_order_snapshot timeout')), 8_000),
      ),
    ]);

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

    if (__DEV__) {
      console.warn('[persistOrderSnapshot] RPC error, using manual fallback:', rpcResult.error);
    }
  } catch (rpcError) {
    if (__DEV__) {
      console.warn('[persistOrderSnapshot] RPC failed, using manual fallback:', rpcError);
    }
  }

  const { data: currentRows, error: currentRowsError } = await client
    .from('order_items')
    .select('id, product_id, combo_id, quantity, price')
    .eq('order_id', orderId)
    .order('id', { ascending: true });

  if (currentRowsError) throw currentRowsError;

  const currentByKey = new Map<
    string,
    {
      id: string;
      product_id: string | null;
      combo_id: string | null;
      quantity: number;
      price: number;
    }
  >();
  const duplicateIdsToDelete: string[] = [];

  (Array.isArray(currentRows) ? currentRows : []).forEach((row) => {
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

  const targetKeys = new Set(
    targetRows.map((row) => (row.product_id ? `p:${row.product_id}` : `c:${row.combo_id}`)),
  );
  const staleIdsToDelete: string[] = [];
  currentByKey.forEach((row, key) => {
    if (!targetKeys.has(key)) {
      staleIdsToDelete.push(row.id);
    }
  });

  const upsertResults = await Promise.allSettled(
    targetRows.map((row) => {
      const key = row.product_id ? `p:${row.product_id}` : `c:${row.combo_id}`;
      const existing = currentByKey.get(key);

      if (existing?.id) {
        return updateOrderItemSubtotal({
          itemId: existing.id,
          quantity: row.quantity,
          price: row.price,
        });
      }

      return client
        .from('order_items')
        .insert([
          {
            order_id: row.order_id,
            product_id: row.product_id,
            combo_id: row.combo_id,
            quantity: row.quantity,
            price: row.price,
          },
        ])
        .then((result) => {
          if (result.error) throw result.error;
        });
    }),
  );

  const failedUpserts = upsertResults.filter((r) => r.status === 'rejected');
  if (failedUpserts.length > 0 && __DEV__) {
    console.warn(
      '[persistOrderSnapshot] fallback upsert errors:',
      failedUpserts.map((r) => (r as PromiseRejectedResult).reason?.message || r),
    );
  }

  const idsToDelete = [...duplicateIdsToDelete, ...staleIdsToDelete];
  if (idsToDelete.length > 0) {
    const deleteResult = await client.from('order_items').delete().in('id', idsToDelete);

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
