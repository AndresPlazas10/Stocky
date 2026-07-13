import { supabaseAdapter } from '../adapters/supabaseAdapter';
import { enqueueOutboxMutation } from '../../sync/outboxShadow';
import LOCAL_SYNC_CONFIG from '../../config/localSync';
import { invalidateOrderCache } from '../adapters/cacheInvalidation';
import type { Order, OrderItem, Table } from '../../types';

let openCloseRpcCompatibility: 'unknown' | 'supported' | 'unsupported' = 'unknown';

function buildMutationId(prefix: string, businessId: string | null = null): string {
  const nonce = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  return `${businessId || 'unknown'}:${prefix}:${nonce}`;
}

interface ErrorLike {
  message?: string;
  code?: string;
  status?: number;
  statusCode?: number;
}

function isMissingTablesUpdatedAtColumnError(errorLike: unknown): boolean {
  const message = String((errorLike as ErrorLike)?.message || errorLike || '').toLowerCase();
  return (
    message.includes('column "updated_at"')
    && message.includes('relation "tables"')
    && message.includes('does not exist')
  );
}

function isMissingTablesOpenedAtColumnError(errorLike: unknown): boolean {
  const message = String((errorLike as ErrorLike)?.message || errorLike || '').toLowerCase();
  return (
    message.includes('column "opened_at"')
    && message.includes('relation "tables"')
    && message.includes('does not exist')
  );
}

function isOpenOrderAlreadyExistsForTableError(errorLike: unknown): boolean {
  const message = String((errorLike as ErrorLike)?.message || errorLike || '').toLowerCase();
  return (
    message.includes('ya existe una orden abierta para la mesa')
    || (
      message.includes('orden abierta')
      && message.includes('mesa')
      && message.includes('ya existe')
    )
  );
}

function isConflictError(errorLike: unknown): boolean {
  const code = String((errorLike as ErrorLike)?.code || '').toLowerCase();
  const message = String((errorLike as ErrorLike)?.message || errorLike || '').toLowerCase();
  const status = Number((errorLike as ErrorLike)?.status || (errorLike as ErrorLike)?.statusCode || 0);
  return (
    code === '23505'
    || status === 409
    || message.includes('duplicate key')
    || message.includes('already exists')
    || message.includes('conflict')
  );
}

function isOpenCloseRpcMissingError(errorLike: unknown): boolean {
  const code = String((errorLike as ErrorLike)?.code || '').toLowerCase();
  const message = String((errorLike as ErrorLike)?.message || errorLike || '').toLowerCase();
  return (
    code === '42883'
    || (
      message.includes('open_close_table_transaction')
      && (
        message.includes('does not exist')
        || message.includes('could not find the function')
        || message.includes('function public.open_close_table_transaction')
      )
    )
  );
}

function normalizeNumber(value: unknown, fallback: number = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function resolveActorUserId(userId: string | null = null): Promise<string | null> {
  const normalizedUserId = String(userId || '').trim();
  if (normalizedUserId) return normalizedUserId;
  try {
    const { data } = await supabaseAdapter.getCurrentUser();
    const resolved = String((data as { user?: { id?: string } })?.user?.id || '').trim();
    return resolved || null;
  } catch {
    return null;
  }
}

async function getAssociatedOrderIdsForTable({
  businessId,
  tableId
}: {
  businessId: string;
  tableId: string;
}): Promise<string[]> {
  if (!businessId || !tableId) return [];
  try {
    const { data, error } = await supabaseAdapter.getOrdersByTableId({ businessId, tableId });
    if (error) return [];
    return (Array.isArray(data) ? data : [])
      .map((order) => String((order as { id?: string })?.id || '').trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

interface PurgeOptions {
  businessId: string;
  tableId: string;
  orderIds?: string[];
  preserveMutationIds?: string[];
}

async function purgeLocalTableCascadeArtifacts({
  businessId,
  tableId,
  orderIds = [],
  preserveMutationIds = []
}: PurgeOptions): Promise<void> {
  if (!businessId || !tableId) return;
  if (!LOCAL_SYNC_CONFIG.enabled) return;
  void preserveMutationIds;

  await invalidateOrderCache({ businessId, tableId });
  if (Array.isArray(orderIds) && orderIds.length > 0) {
    await Promise.all(orderIds.map((orderId) => invalidateOrderCache({ businessId, orderId, tableId })));
  }
}

interface TableCreateResult extends Partial<Table> {
  __localOnly: boolean;
}

export async function createTable({
  businessId,
  tableNumber
}: {
  businessId: string;
  tableNumber: string;
}): Promise<TableCreateResult> {
  const { data, error } = await supabaseAdapter.insertTable({
    business_id: businessId,
    table_number: tableNumber,
    status: 'available'
  });
  if (error) throw error;

  await enqueueOutboxMutation({
    businessId,
    mutationType: 'table.create',
    payload: {
      table_id: data?.id || null,
      table_number: tableNumber
    },
    mutationId: buildMutationId('table.create', businessId)
  });

  return {
    ...(data || {}),
    __localOnly: false
  };
}

interface OrderResult extends Partial<Order> {
  __localOnly: boolean;
  __rpc?: boolean;
  __recoveredExistingOrder?: boolean;
}

export async function createOrderAndOccupyTable({
  businessId,
  tableId,
  userId = null
}: {
  businessId: string;
  tableId: string;
  userId?: string | null;
}): Promise<OrderResult> {
  const actorUserId = await resolveActorUserId(userId);

  if (openCloseRpcCompatibility !== 'unsupported' && actorUserId) {
    const { data: rpcData, error: rpcError } = await supabaseAdapter.openCloseTableTransactionRpc({
      tableId,
      action: 'open',
      userId: actorUserId
    });

    if (!rpcError) {
      openCloseRpcCompatibility = 'supported';
      const rpcRow = Array.isArray(rpcData) ? rpcData[0] : rpcData;
      const orderId = String((rpcRow as { current_order_id?: string })?.current_order_id || '').trim();
      if (!orderId) {
        throw new Error('open_close_table_transaction no devolvió current_order_id');
      }

      await Promise.all([
        enqueueOutboxMutation({
          businessId,
          mutationType: 'order.create',
          payload: {
            order_id: orderId,
            table_id: tableId,
            user_id: actorUserId
          },
          mutationId: buildMutationId('order.create', businessId)
        }),
        invalidateOrderCache({ businessId, tableId, orderId }),
      ]);

      return {
        id: orderId,
        business_id: String((rpcRow as { business_id?: string })?.business_id || businessId || '').trim() || businessId,
        table_id: tableId,
        status: 'open',
        total: 0,
        opened_at: (rpcRow as { opened_at?: string })?.opened_at || null,
        __localOnly: false,
        __rpc: true
      } as OrderResult;
    }

    if (
      isOpenCloseRpcMissingError(rpcError)
      || isMissingTablesUpdatedAtColumnError(rpcError)
      || isMissingTablesOpenedAtColumnError(rpcError)
    ) {
      openCloseRpcCompatibility = 'unsupported';
    } else {
      throw rpcError;
    }
  }

  const { data: newOrder, error: orderError } = await supabaseAdapter.insertOrder({
    business_id: businessId,
    table_id: tableId,
    user_id: actorUserId,
    status: 'open',
    total: 0
  });

  if (orderError) {
    if (isOpenOrderAlreadyExistsForTableError(orderError)) {
      const { data: openOrders, error: openOrdersError } = await supabaseAdapter.getOpenOrdersByBusiness(
        businessId,
        'id, business_id, table_id, user_id, status, total, opened_at'
      );
      if (!openOrdersError) {
        const recoveredOrder = (openOrders || []).find(
          (order) => String((order as { table_id?: string })?.table_id || '') === String(tableId || '')
        );
        if ((recoveredOrder as { id?: string })?.id) {
          const { error: recoverTableError } = await supabaseAdapter.updateTableById(tableId, {
            current_order_id: (recoveredOrder as unknown as { id: string }).id,
            status: 'occupied'
          });
          if (
            recoverTableError
            && !isMissingTablesUpdatedAtColumnError(recoverTableError)
            && !isMissingTablesOpenedAtColumnError(recoverTableError)
          ) {
            throw recoverTableError;
          }

          await invalidateOrderCache({ businessId, tableId, orderId: (recoveredOrder as unknown as { id: string }).id });
          return {
            ...(recoveredOrder as unknown as Record<string, unknown>),
            __localOnly: false,
            __recoveredExistingOrder: true
          } as OrderResult;
        }
      }
    }

    throw orderError;
  }

  const { error: updateError } = await supabaseAdapter.updateTableById(tableId, {
    current_order_id: newOrder.id,
    status: 'occupied'
  });
  if (
    updateError
    && !isMissingTablesUpdatedAtColumnError(updateError)
    && !isMissingTablesOpenedAtColumnError(updateError)
  ) throw updateError;

  await Promise.all([
    enqueueOutboxMutation({
      businessId,
      mutationType: 'order.create',
      payload: {
        order_id: newOrder?.id || null,
        table_id: tableId,
        user_id: actorUserId
      },
      mutationId: buildMutationId('order.create', businessId)
    }),
    invalidateOrderCache({ businessId, tableId, orderId: newOrder?.id || null }),
  ]);

  return {
    ...newOrder,
    __localOnly: false
  };
}

export async function updateOrderTotalById({
  orderId,
  total,
  businessId = null
}: {
  orderId: string;
  total: number;
  businessId?: string | null;
}): Promise<{ id: string; total: number; __localOnly: boolean }> {
  const { error } = await supabaseAdapter.updateOrderById(orderId, { total });
  if (error) throw error;

  await enqueueOutboxMutation({
    businessId,
    mutationType: 'order.total.update',
    payload: {
      order_id: orderId,
      total: Number(total || 0)
    },
    mutationId: buildMutationId('order.total.update', businessId)
  });
  await invalidateOrderCache({ businessId, orderId });

  return {
    id: orderId,
    total: normalizeNumber(total, 0),
    __localOnly: false
  };
}

export async function persistOrderItemQuantities(
  pendingEntries: Array<[string, number]> = [],
  { businessId = null, orderId = null }: { businessId?: string | null; orderId?: string | null } = {}
): Promise<{ __localOnly: boolean; updatedCount: number }> {
  if (!Array.isArray(pendingEntries) || pendingEntries.length === 0) {
    return {
      __localOnly: false,
      updatedCount: 0
    };
  }

  const updateResults = await Promise.all(
    pendingEntries.map(([itemId, quantity]) => supabaseAdapter.updateOrderItemById(itemId, { quantity }))
  );
  const failedUpdate = updateResults.find((result) => result.error);
  if (failedUpdate?.error) throw failedUpdate.error;

  await enqueueOutboxMutation({
    businessId,
    mutationType: 'order.item.bulk_quantity_update',
    payload: {
      order_id: orderId,
      updates: pendingEntries.map(([itemId, quantity]) => ({
        item_id: itemId,
        quantity: Number(quantity || 0)
      }))
    },
    mutationId: buildMutationId('order.item.bulk_quantity_update', businessId)
  });
  await invalidateOrderCache({ businessId, orderId });

  return {
    __localOnly: false,
    updatedCount: pendingEntries.length
  };
}

export async function deleteOrderItemById(
  itemId: string,
  { businessId = null, orderId = null }: { businessId?: string | null; orderId?: string | null } = {}
): Promise<{ id: string; __localOnly: boolean }> {
  const { error } = await supabaseAdapter.deleteOrderItemById(itemId);
  if (error) throw error;

  await enqueueOutboxMutation({
    businessId,
    mutationType: 'order.item.delete',
    payload: {
      order_id: orderId,
      item_id: itemId
    },
    mutationId: buildMutationId('order.item.delete', businessId)
  });
  await invalidateOrderCache({ businessId, orderId });

  return {
    id: itemId,
    __localOnly: false
  };
}

export async function updateOrderItemQuantityById({
  itemId,
  quantity,
  businessId = null,
  orderId = null,
  preferLocal = false
}: {
  itemId: string;
  quantity: number;
  businessId?: string | null;
  orderId?: string | null;
  preferLocal?: boolean;
}): Promise<{ id: string; quantity: number; __localOnly: boolean }> {
  void preferLocal;

  const { error } = await supabaseAdapter.updateOrderItemById(itemId, { quantity });
  if (error) throw error;

  await enqueueOutboxMutation({
    businessId,
    mutationType: 'order.item.update_quantity',
    payload: {
      order_id: orderId,
      item_id: itemId,
      quantity: Number(quantity || 0)
    },
    mutationId: buildMutationId('order.item.update_quantity', businessId)
  });
  await invalidateOrderCache({ businessId, orderId });

  return {
    id: itemId,
    quantity: Number(quantity || 0),
    __localOnly: false
  };
}

export async function getOrderItemById({
  itemId,
  selectSql
}: {
  itemId: string;
  selectSql?: string;
}): Promise<Partial<OrderItem> | null> {
  const { data, error } = await supabaseAdapter.getOrderItemById(itemId, selectSql);
  if (error) throw error;
  return (data as Partial<OrderItem>) || null;
}

interface OrderItemRow {
  order_id?: string;
  product_id?: string | null;
  combo_id?: string | null;
  quantity?: number;
  price?: number;
  id?: string;
  [key: string]: unknown;
}

async function mergeDuplicateOrderItemInsert({
  row,
  businessId = null,
  selectSql = 'id'
}: {
  row: OrderItemRow;
  businessId?: string | null;
  selectSql?: string;
}): Promise<Record<string, unknown> | null> {
  const orderId = row?.order_id || null;
  const productId = row?.product_id || null;
  const comboId = row?.combo_id || null;

  if (!orderId || (!productId && !comboId)) return null;

  const { data: existingItem, error: findError } = await supabaseAdapter.getOrderItemByOrderAndReference({
    orderId,
    productId,
    comboId,
    selectSql: 'id, quantity, price'
  });
  if (findError || !(existingItem as { id?: string })?.id) return null;

  const currentQty = normalizeNumber((existingItem as { quantity?: number })?.quantity, 0);
  const incomingQty = normalizeNumber(row?.quantity, 0);
  const nextQuantity = currentQty + incomingQty;

  await updateOrderItemQuantityById({
    itemId: (existingItem as { id: string }).id,
    quantity: nextQuantity,
    businessId,
    orderId
  });

  if (selectSql && selectSql !== 'id') {
    const { data: refreshed, error: refreshedError } = await supabaseAdapter.getOrderItemById(
      (existingItem as { id: string }).id,
      selectSql
    );
    if (!refreshedError && refreshed) {
      return {
        ...(refreshed as unknown as Record<string, unknown>),
        __localOnly: false,
        __resolvedConflictAsUpdate: true
      } as Record<string, unknown>;
    }
  }

  const price = normalizeNumber((existingItem as { price?: number })?.price, normalizeNumber(row?.price, 0));
  return {
    id: (existingItem as { id: string }).id,
    order_id: orderId,
    product_id: productId,
    combo_id: comboId,
    quantity: nextQuantity,
    price,
    subtotal: nextQuantity * price,
    __localOnly: false,
    __resolvedConflictAsUpdate: true
  };
}

export async function insertOrderItem({
  row,
  selectSql = 'id',
  businessId = null,
  preferLocal = false
}: {
  row: OrderItemRow;
  selectSql?: string;
  businessId?: string | null;
  preferLocal?: boolean;
}): Promise<Record<string, unknown>> {
  void preferLocal;

  const { data, error } = await supabaseAdapter.insertOrderItem(row, selectSql);
  if (error) {
    if (isConflictError(error)) {
      const mergedResult = await mergeDuplicateOrderItemInsert({
        row,
        businessId,
        selectSql
      });
      if (mergedResult) {
        await invalidateOrderCache({ businessId, orderId: row?.order_id || null });
        return mergedResult;
      }
    }
    throw error;
  }

  await enqueueOutboxMutation({
    businessId,
    mutationType: 'order.item.insert',
    payload: {
      order_id: row?.order_id || null,
      item_id: (data as unknown as Record<string, unknown>)?.id || null,
      product_id: row?.product_id || null,
      combo_id: row?.combo_id || null,
      quantity: Number(row?.quantity || 0),
      price: Number(row?.price || 0)
    },
    mutationId: buildMutationId('order.item.insert', businessId)
  });
  await invalidateOrderCache({ businessId, orderId: row?.order_id || null });

  return {
    ...(data as unknown as Record<string, unknown> || {}),
    __localOnly: false
  } as Record<string, unknown>;
}

export async function deleteOrderAndReleaseTable({
  orderId,
  tableId,
  businessId = null,
  userId = null
}: {
  orderId: string;
  tableId: string;
  businessId?: string | null;
  userId?: string | null;
}): Promise<{ order_id: string; table_id: string; __localOnly: boolean }> {
  let releasedViaRpc = false;
  const actorUserId = await resolveActorUserId(userId);

  if (openCloseRpcCompatibility !== 'unsupported' && actorUserId) {
    const { error: rpcError } = await supabaseAdapter.openCloseTableTransactionRpc({
      tableId,
      action: 'close',
      userId: actorUserId
    });

    if (!rpcError) {
      openCloseRpcCompatibility = 'supported';
      releasedViaRpc = true;
    } else if (
      isOpenCloseRpcMissingError(rpcError)
      || isMissingTablesUpdatedAtColumnError(rpcError)
      || isMissingTablesOpenedAtColumnError(rpcError)
    ) {
      openCloseRpcCompatibility = 'unsupported';
    } else {
      throw rpcError;
    }
  }

  if (!releasedViaRpc) {
    const { error: releaseTableError } = businessId
      ? await supabaseAdapter.updateTableByBusinessAndId({
        businessId,
        tableId,
        payload: {
          current_order_id: null,
          status: 'available'
        }
      })
      : await supabaseAdapter.updateTableById(tableId, {
        current_order_id: null,
        status: 'available'
      });
    if (
      releaseTableError
      && !isMissingTablesUpdatedAtColumnError(releaseTableError)
      && !isMissingTablesOpenedAtColumnError(releaseTableError)
    ) {
      throw releaseTableError;
    }
  }

  const { error: deleteOrderError } = await supabaseAdapter.deleteOrderById(orderId);
  if (deleteOrderError) throw deleteOrderError;

  await enqueueOutboxMutation({
    businessId,
    mutationType: 'order.delete_and_release_table',
    payload: {
      order_id: orderId,
      table_id: tableId
    },
    mutationId: buildMutationId('order.delete_and_release_table', businessId)
  });
  await invalidateOrderCache({ businessId, orderId, tableId, releaseMesaSnapshot: true });

  return {
    order_id: orderId,
    table_id: tableId,
    __localOnly: false
  };
}

export async function deleteTableCascadeOrders(
  tableId: string,
  { businessId = null }: { businessId?: string | null } = {}
): Promise<{ table_id: string; __localOnly: boolean }> {
  const associatedOrderIds = await getAssociatedOrderIdsForTable({ businessId: businessId!, tableId });

  const { error: releaseTableError } = businessId
    ? await supabaseAdapter.updateTableByBusinessAndId({
      businessId,
      tableId,
      payload: {
        current_order_id: null,
        status: 'available'
      }
    })
    : await supabaseAdapter.updateTableById(tableId, {
      current_order_id: null,
      status: 'available'
    });
  if (
    releaseTableError
    && !isMissingTablesUpdatedAtColumnError(releaseTableError)
    && !isMissingTablesOpenedAtColumnError(releaseTableError)
  ) {
    throw releaseTableError;
  }

  const { error: ordersError } = businessId
    ? await supabaseAdapter.deleteOrdersByBusinessAndTableId({ businessId, tableId })
    : await supabaseAdapter.deleteOrdersByTableId(tableId);
  if (ordersError) throw ordersError;

  const { error: tableError } = businessId
    ? await supabaseAdapter.deleteTableByBusinessAndId({ businessId, tableId })
    : await supabaseAdapter.deleteTableById(tableId);
  if (tableError) throw tableError;

  const mutationId = buildMutationId('table.delete_cascade_orders', businessId);
  await enqueueOutboxMutation({
    businessId,
    mutationType: 'table.delete_cascade_orders',
    payload: {
      table_id: tableId
    },
    mutationId
  });
  await purgeLocalTableCascadeArtifacts({
    businessId: businessId!,
    tableId,
    orderIds: associatedOrderIds,
    preserveMutationIds: [mutationId]
  });

  return {
    table_id: tableId,
    __localOnly: false
  };
}
