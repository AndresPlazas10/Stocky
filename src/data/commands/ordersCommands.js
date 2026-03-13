import { supabaseAdapter } from '../adapters/supabaseAdapter';
import { enqueueOutboxMutation } from '../../sync/outboxShadow.js';
import LOCAL_SYNC_CONFIG from '../../config/localSync.js';
import { invalidateOrderCache } from '../adapters/cacheInvalidation.js';

let openCloseRpcCompatibility = 'unknown';

function buildMutationId(prefix, businessId = null) {
  const nonce = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  return `${businessId || 'unknown'}:${prefix}:${nonce}`;
}

function isMissingTablesUpdatedAtColumnError(errorLike) {
  const message = String(errorLike?.message || errorLike || '').toLowerCase();
  return (
    message.includes('column "updated_at"')
    && message.includes('relation "tables"')
    && message.includes('does not exist')
  );
}

function isMissingTablesOpenedAtColumnError(errorLike) {
  const message = String(errorLike?.message || errorLike || '').toLowerCase();
  return (
    message.includes('column "opened_at"')
    && message.includes('relation "tables"')
    && message.includes('does not exist')
  );
}

function isOpenOrderAlreadyExistsForTableError(errorLike) {
  const message = String(errorLike?.message || errorLike || '').toLowerCase();
  return (
    message.includes('ya existe una orden abierta para la mesa')
    || (
      message.includes('orden abierta')
      && message.includes('mesa')
      && message.includes('ya existe')
    )
  );
}

function isConflictError(errorLike) {
  const code = String(errorLike?.code || '').toLowerCase();
  const message = String(errorLike?.message || errorLike || '').toLowerCase();
  const status = Number(errorLike?.status || errorLike?.statusCode || 0);
  return (
    code === '23505'
    || status === 409
    || message.includes('duplicate key')
    || message.includes('already exists')
    || message.includes('conflict')
  );
}

function isOpenCloseRpcMissingError(errorLike) {
  const code = String(errorLike?.code || '').toLowerCase();
  const message = String(errorLike?.message || errorLike || '').toLowerCase();
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

function normalizeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function resolveActorUserId(userId = null) {
  const normalizedUserId = String(userId || '').trim();
  if (normalizedUserId) return normalizedUserId;
  try {
    const { data } = await supabaseAdapter.getCurrentUser();
    const resolved = String(data?.user?.id || '').trim();
    return resolved || null;
  } catch {
    return null;
  }
}

async function getAssociatedOrderIdsForTable({ businessId, tableId }) {
  if (!businessId || !tableId) return [];
  try {
    const { data, error } = await supabaseAdapter.getOrdersByTableId({ businessId, tableId });
    if (error) return [];
    return (Array.isArray(data) ? data : [])
      .map((order) => String(order?.id || '').trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function purgeLocalTableCascadeArtifacts({
  businessId,
  tableId,
  orderIds = [],
  preserveMutationIds = []
}) {
  if (!businessId || !tableId) return;
  if (!LOCAL_SYNC_CONFIG.enabled) return;
  void preserveMutationIds;

  await invalidateOrderCache({ businessId, tableId });
  if (Array.isArray(orderIds) && orderIds.length > 0) {
    await Promise.all(orderIds.map((orderId) => invalidateOrderCache({ businessId, orderId, tableId })));
  }
}

export async function createTable({ businessId, tableNumber }) {
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

export async function createOrderAndOccupyTable({ businessId, tableId, userId = null }) {
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
      const orderId = String(rpcRow?.current_order_id || '').trim();
      if (!orderId) {
        throw new Error('open_close_table_transaction no devolvió current_order_id');
      }

      await enqueueOutboxMutation({
        businessId,
        mutationType: 'order.create',
        payload: {
          order_id: orderId,
          table_id: tableId,
          user_id: actorUserId
        },
        mutationId: buildMutationId('order.create', businessId)
      });
      await invalidateOrderCache({ businessId, tableId, orderId });

      return {
        id: orderId,
        business_id: String(rpcRow?.business_id || businessId || '').trim() || businessId,
        table_id: tableId,
        user_id: actorUserId,
        status: 'open',
        total: 0,
        opened_at: rpcRow?.opened_at || null,
        __localOnly: false,
        __rpc: true
      };
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
          (order) => String(order?.table_id || '') === String(tableId || '')
        );
        if (recoveredOrder?.id) {
          const { error: recoverTableError } = await supabaseAdapter.updateTableById(tableId, {
            current_order_id: recoveredOrder.id,
            status: 'occupied'
          });
          if (
            recoverTableError
            && !isMissingTablesUpdatedAtColumnError(recoverTableError)
            && !isMissingTablesOpenedAtColumnError(recoverTableError)
          ) {
            throw recoverTableError;
          }

          await invalidateOrderCache({ businessId, tableId, orderId: recoveredOrder.id });
          return {
            ...recoveredOrder,
            __localOnly: false,
            __recoveredExistingOrder: true
          };
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

  await enqueueOutboxMutation({
    businessId,
    mutationType: 'order.create',
    payload: {
      order_id: newOrder?.id || null,
      table_id: tableId,
      user_id: actorUserId
    },
    mutationId: buildMutationId('order.create', businessId)
  });
  await invalidateOrderCache({ businessId, tableId, orderId: newOrder?.id || null });

  return {
    ...newOrder,
    __localOnly: false
  };
}

export async function updateOrderTotalById({ orderId, total, businessId = null }) {
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
  pendingEntries = [],
  { businessId = null, orderId = null } = {}
) {
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

export async function deleteOrderItemById(itemId, { businessId = null, orderId = null } = {}) {
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
}) {
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

export async function getOrderItemById({ itemId, selectSql }) {
  const { data, error } = await supabaseAdapter.getOrderItemById(itemId, selectSql);
  if (error) throw error;
  return data || null;
}

async function mergeDuplicateOrderItemInsert({
  row,
  businessId = null,
  selectSql = 'id'
}) {
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
  if (findError || !existingItem?.id) return null;

  const currentQty = normalizeNumber(existingItem.quantity, 0);
  const incomingQty = normalizeNumber(row?.quantity, 0);
  const nextQuantity = currentQty + incomingQty;

  await updateOrderItemQuantityById({
    itemId: existingItem.id,
    quantity: nextQuantity,
    businessId,
    orderId
  });

  if (selectSql && selectSql !== 'id') {
    const { data: refreshed, error: refreshedError } = await supabaseAdapter.getOrderItemById(
      existingItem.id,
      selectSql
    );
    if (!refreshedError && refreshed) {
      return {
        ...refreshed,
        __localOnly: false,
        __resolvedConflictAsUpdate: true
      };
    }
  }

  const price = normalizeNumber(existingItem.price, normalizeNumber(row?.price, 0));
  return {
    id: existingItem.id,
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
}) {
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
      item_id: data?.id || null,
      product_id: row?.product_id || null,
      combo_id: row?.combo_id || null,
      quantity: Number(row?.quantity || 0),
      price: Number(row?.price || 0)
    },
    mutationId: buildMutationId('order.item.insert', businessId)
  });
  await invalidateOrderCache({ businessId, orderId: row?.order_id || null });

  return {
    ...(data || {}),
    __localOnly: false
  };
}

export async function deleteOrderAndReleaseTable({
  orderId,
  tableId,
  businessId = null,
  userId = null
}) {
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

export async function deleteTableCascadeOrders(tableId, { businessId = null } = {}) {
  const associatedOrderIds = await getAssociatedOrderIdsForTable({ businessId, tableId });

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
    businessId,
    tableId,
    orderIds: associatedOrderIds,
    preserveMutationIds: [mutationId]
  });

  return {
    table_id: tableId,
    __localOnly: false
  };
}
