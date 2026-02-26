import { supabaseAdapter } from '../adapters/supabaseAdapter';
import { enqueueOutboxMutation } from '../../sync/outboxShadow.js';
import LOCAL_SYNC_CONFIG from '../../config/localSync.js';
import { runOutboxTick } from '../../sync/syncBootstrap.js';
import { invalidateOrderCache } from '../adapters/cacheInvalidation.js';
import { getLocalDbClient } from '../../localdb/client.js';

function buildMutationId(prefix, businessId = null) {
  const nonce = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  return `${businessId || 'unknown'}:${prefix}:${nonce}`;
}

function canQueueLocalOrders() {
  return Boolean(
    LOCAL_SYNC_CONFIG.enabled
    && LOCAL_SYNC_CONFIG.shadowWritesEnabled
    && (
      LOCAL_SYNC_CONFIG.localWrites?.orders
      || LOCAL_SYNC_CONFIG.localWrites?.tables
    )
  );
}

function shouldForceOrdersLocalFirst() {
  return Boolean(
    canQueueLocalOrders()
    && (
      LOCAL_SYNC_CONFIG.localWrites?.allLocalFirst
      || LOCAL_SYNC_CONFIG.localWrites?.ordersLocalFirst
      || LOCAL_SYNC_CONFIG.localWrites?.tablesLocalFirst
    )
  );
}

function isConnectivityError(errorLike) {
  const message = String(errorLike?.message || errorLike || '').toLowerCase();
  return (
    message.includes('failed to fetch')
    || message.includes('networkerror')
    || message.includes('network request failed')
    || message.includes('fetch failed')
    || message.includes('load failed')
    || message.includes('network')
  );
}

function isMissingTablesUpdatedAtColumnError(errorLike) {
  const message = String(errorLike?.message || errorLike || '').toLowerCase();
  return (
    message.includes('column "updated_at"')
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

async function triggerBackgroundOutboxSync() {
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    runOutboxTick().catch(() => {});
  }
}

function normalizeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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

  try {
    const db = getLocalDbClient();
    await db.init();
    await db.purgeOutboxEventsForTable({
      businessId,
      tableId,
      orderIds,
      preserveMutationIds
    });
  } catch {
    // best-effort
  }

  await invalidateOrderCache({ businessId, tableId });
  if (Array.isArray(orderIds) && orderIds.length > 0) {
    await Promise.all(orderIds.map((orderId) => invalidateOrderCache({ businessId, orderId, tableId })));
  }
}

function buildLocalTableRow({ businessId, tableNumber }) {
  const tableId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  return {
    id: tableId,
    business_id: businessId,
    table_number: tableNumber,
    status: 'available',
    current_order_id: null,
    created_at: new Date().toISOString()
  };
}

async function enqueueLocalTableCreate({
  businessId,
  tableNumber
}) {
  const table = buildLocalTableRow({ businessId, tableNumber });
  const queued = await enqueueOutboxMutation({
    businessId,
    mutationType: 'table.create',
    payload: {
      local_write: true,
      table_id: table.id,
      table_number: table.table_number,
      table
    },
    mutationId: buildMutationId('table.create.local', businessId)
  });

  if (!queued) {
    throw new Error('No se pudo guardar la mesa localmente');
  }

  return {
    ...table,
    __localOnly: true,
    pendingSync: true
  };
}

export async function createTable({ businessId, tableNumber }) {
  if (shouldForceOrdersLocalFirst()) {
    const localResult = await enqueueLocalTableCreate({ businessId, tableNumber });
    await triggerBackgroundOutboxSync();
    return localResult;
  }

  const offlineMode = typeof navigator !== 'undefined' && navigator.onLine === false;
  if (offlineMode && canQueueLocalOrders()) {
    return enqueueLocalTableCreate({ businessId, tableNumber });
  }

  const { data, error } = await supabaseAdapter.insertTable({
    business_id: businessId,
    table_number: tableNumber,
    status: 'available'
  });
  if (error) {
    if (canQueueLocalOrders() && isConnectivityError(error)) {
      const localResult = await enqueueLocalTableCreate({ businessId, tableNumber });
      await invalidateOrderCache({ businessId });
      await triggerBackgroundOutboxSync();
      return localResult;
    }
    throw error;
  }

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

function buildLocalOrderRow({ businessId, tableId, userId = null }) {
  return {
    id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
    business_id: businessId,
    table_id: tableId,
    user_id: userId,
    status: 'open',
    total: 0,
    opened_at: new Date().toISOString()
  };
}

async function enqueueLocalOrderCreate({
  businessId,
  tableId,
  userId = null
}) {
  const order = buildLocalOrderRow({ businessId, tableId, userId });
  const queued = await enqueueOutboxMutation({
    businessId,
    mutationType: 'order.create',
    payload: {
      local_write: true,
      order_id: order.id,
      table_id: tableId,
      user_id: userId,
      order
    },
    mutationId: buildMutationId('order.create.local', businessId)
  });

  if (!queued) {
    throw new Error('No se pudo guardar la orden localmente');
  }

  return {
    ...order,
    __localOnly: true,
    pendingSync: true
  };
}

export async function createOrderAndOccupyTable({ businessId, tableId, userId = null }) {
  if (shouldForceOrdersLocalFirst()) {
    const localResult = await enqueueLocalOrderCreate({ businessId, tableId, userId });
    await invalidateOrderCache({ businessId, tableId, orderId: localResult?.id || null });
    await triggerBackgroundOutboxSync();
    return localResult;
  }

  const offlineMode = typeof navigator !== 'undefined' && navigator.onLine === false;
  if (offlineMode && canQueueLocalOrders()) {
    const localResult = await enqueueLocalOrderCreate({ businessId, tableId, userId });
    await invalidateOrderCache({ businessId, tableId, orderId: localResult?.id || null });
    return localResult;
  }

  const { data: newOrder, error: orderError } = await supabaseAdapter.insertOrder({
    business_id: businessId,
    table_id: tableId,
    user_id: userId,
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
          if (recoverTableError && !isMissingTablesUpdatedAtColumnError(recoverTableError)) {
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

    if (canQueueLocalOrders() && isConnectivityError(orderError)) {
      const localResult = await enqueueLocalOrderCreate({ businessId, tableId, userId });
      await invalidateOrderCache({ businessId, tableId, orderId: localResult?.id || null });
      await triggerBackgroundOutboxSync();
      return localResult;
    }
    throw orderError;
  }

  const { error: updateError } = await supabaseAdapter.updateTableById(tableId, {
    current_order_id: newOrder.id,
    status: 'occupied'
  });
  if (updateError && !isMissingTablesUpdatedAtColumnError(updateError)) throw updateError;

  await enqueueOutboxMutation({
    businessId,
    mutationType: 'order.create',
    payload: {
      order_id: newOrder?.id || null,
      table_id: tableId,
      user_id: userId
    },
    mutationId: buildMutationId('order.create', businessId)
  });
  await invalidateOrderCache({ businessId, tableId, orderId: newOrder?.id || null });

  return {
    ...newOrder,
    __localOnly: false
  };
}

async function enqueueLocalOrderTotalUpdate({
  orderId,
  total,
  businessId = null
}) {
  const queued = await enqueueOutboxMutation({
    businessId,
    mutationType: 'order.total.update',
    payload: {
      local_write: true,
      order_id: orderId,
      total: normalizeNumber(total, 0)
    },
    mutationId: buildMutationId('order.total.update.local', businessId)
  });

  if (!queued) {
    throw new Error('No se pudo guardar el total localmente');
  }

  return {
    id: orderId,
    total: normalizeNumber(total, 0),
    __localOnly: true,
    pendingSync: true
  };
}

export async function updateOrderTotalById({ orderId, total, businessId = null }) {
  if (shouldForceOrdersLocalFirst()) {
    const localResult = await enqueueLocalOrderTotalUpdate({
      orderId,
      total,
      businessId
    });
    await invalidateOrderCache({ businessId, orderId });
    await triggerBackgroundOutboxSync();
    return localResult;
  }

  const offlineMode = typeof navigator !== 'undefined' && navigator.onLine === false;
  if (offlineMode && canQueueLocalOrders()) {
    const localResult = await enqueueLocalOrderTotalUpdate({
      orderId,
      total,
      businessId
    });
    await invalidateOrderCache({ businessId, orderId });
    return localResult;
  }

  const { error } = await supabaseAdapter.updateOrderById(orderId, { total });
  if (error) {
    if (canQueueLocalOrders() && isConnectivityError(error)) {
      const localResult = await enqueueLocalOrderTotalUpdate({
        orderId,
        total,
        businessId
      });
      await invalidateOrderCache({ businessId, orderId });
      await triggerBackgroundOutboxSync();
      return localResult;
    }
    throw error;
  }

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

async function enqueueLocalBulkQuantityUpdate(
  pendingEntries = [],
  { businessId = null, orderId = null } = {}
) {
  const queued = await enqueueOutboxMutation({
    businessId,
    mutationType: 'order.item.bulk_quantity_update',
    payload: {
      local_write: true,
      order_id: orderId,
      updates: pendingEntries.map(([itemId, quantity]) => ({
        item_id: itemId,
        quantity: Number(quantity || 0)
      }))
    },
    mutationId: buildMutationId('order.item.bulk_quantity_update.local', businessId)
  });

  if (!queued) {
    throw new Error('No se pudo guardar la actualización localmente');
  }

  return {
    __localOnly: true,
    pendingSync: true,
    updatedCount: pendingEntries.length
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

  if (shouldForceOrdersLocalFirst()) {
    const localResult = await enqueueLocalBulkQuantityUpdate(pendingEntries, { businessId, orderId });
    await invalidateOrderCache({ businessId, orderId });
    await triggerBackgroundOutboxSync();
    return localResult;
  }

  const offlineMode = typeof navigator !== 'undefined' && navigator.onLine === false;
  if (offlineMode && canQueueLocalOrders()) {
    const localResult = await enqueueLocalBulkQuantityUpdate(pendingEntries, { businessId, orderId });
    await invalidateOrderCache({ businessId, orderId });
    return localResult;
  }

  const updateResults = await Promise.all(
    pendingEntries.map(([itemId, quantity]) => supabaseAdapter.updateOrderItemById(itemId, { quantity }))
  );
  const failedUpdate = updateResults.find((result) => result.error);
  if (failedUpdate?.error) {
    if (canQueueLocalOrders() && isConnectivityError(failedUpdate.error)) {
      const localResult = await enqueueLocalBulkQuantityUpdate(pendingEntries, { businessId, orderId });
      await invalidateOrderCache({ businessId, orderId });
      await triggerBackgroundOutboxSync();
      return localResult;
    }
    throw failedUpdate.error;
  }

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

async function enqueueLocalOrderItemDelete(itemId, { businessId = null, orderId = null } = {}) {
  const queued = await enqueueOutboxMutation({
    businessId,
    mutationType: 'order.item.delete',
    payload: {
      local_write: true,
      order_id: orderId,
      item_id: itemId
    },
    mutationId: buildMutationId('order.item.delete.local', businessId)
  });

  if (!queued) {
    throw new Error('No se pudo guardar la eliminación localmente');
  }

  return {
    id: itemId,
    __localOnly: true,
    pendingSync: true
  };
}

export async function deleteOrderItemById(itemId, { businessId = null, orderId = null } = {}) {
  if (shouldForceOrdersLocalFirst()) {
    const localResult = await enqueueLocalOrderItemDelete(itemId, { businessId, orderId });
    await invalidateOrderCache({ businessId, orderId });
    await triggerBackgroundOutboxSync();
    return localResult;
  }

  const offlineMode = typeof navigator !== 'undefined' && navigator.onLine === false;
  if (offlineMode && canQueueLocalOrders()) {
    const localResult = await enqueueLocalOrderItemDelete(itemId, { businessId, orderId });
    await invalidateOrderCache({ businessId, orderId });
    return localResult;
  }

  const { error } = await supabaseAdapter.deleteOrderItemById(itemId);
  if (error) {
    if (canQueueLocalOrders() && isConnectivityError(error)) {
      const localResult = await enqueueLocalOrderItemDelete(itemId, { businessId, orderId });
      await invalidateOrderCache({ businessId, orderId });
      await triggerBackgroundOutboxSync();
      return localResult;
    }
    throw error;
  }

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

async function enqueueLocalOrderItemQuantityUpdate({
  itemId,
  quantity,
  businessId = null,
  orderId = null
}) {
  const queued = await enqueueOutboxMutation({
    businessId,
    mutationType: 'order.item.update_quantity',
    payload: {
      local_write: true,
      order_id: orderId,
      item_id: itemId,
      quantity: Number(quantity || 0)
    },
    mutationId: buildMutationId('order.item.update_quantity.local', businessId)
  });

  if (!queued) {
    throw new Error('No se pudo guardar la cantidad localmente');
  }

  return {
    id: itemId,
    quantity: Number(quantity || 0),
    __localOnly: true,
    pendingSync: true
  };
}

export async function updateOrderItemQuantityById({ itemId, quantity, businessId = null, orderId = null }) {
  if (shouldForceOrdersLocalFirst()) {
    const localResult = await enqueueLocalOrderItemQuantityUpdate({
      itemId,
      quantity,
      businessId,
      orderId
    });
    await invalidateOrderCache({ businessId, orderId });
    await triggerBackgroundOutboxSync();
    return localResult;
  }

  const offlineMode = typeof navigator !== 'undefined' && navigator.onLine === false;
  if (offlineMode && canQueueLocalOrders()) {
    const localResult = await enqueueLocalOrderItemQuantityUpdate({
      itemId,
      quantity,
      businessId,
      orderId
    });
    await invalidateOrderCache({ businessId, orderId });
    return localResult;
  }

  const { error } = await supabaseAdapter.updateOrderItemById(itemId, { quantity });
  if (error) {
    if (canQueueLocalOrders() && isConnectivityError(error)) {
      const localResult = await enqueueLocalOrderItemQuantityUpdate({
        itemId,
        quantity,
        businessId,
        orderId
      });
      await invalidateOrderCache({ businessId, orderId });
      await triggerBackgroundOutboxSync();
      return localResult;
    }
    throw error;
  }

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

async function enqueueLocalOrderItemInsert({
  row,
  businessId = null
}) {
  const itemId = row?.id || (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`);
  const quantity = Number(row?.quantity || 0);
  const price = Number(row?.price || 0);
  const payload = {
    local_write: true,
    order_id: row?.order_id || null,
    item_id: itemId,
    product_id: row?.product_id || null,
    combo_id: row?.combo_id || null,
    quantity,
    price
  };
  const queued = await enqueueOutboxMutation({
    businessId,
    mutationType: 'order.item.insert',
    payload,
    mutationId: buildMutationId('order.item.insert.local', businessId)
  });

  if (!queued) {
    throw new Error('No se pudo guardar el item localmente');
  }

  return {
    id: itemId,
    order_id: row?.order_id || null,
    product_id: row?.product_id || null,
    combo_id: row?.combo_id || null,
    quantity,
    price,
    subtotal: quantity * price,
    __localOnly: true,
    pendingSync: true
  };
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

export async function insertOrderItem({ row, selectSql = 'id', businessId = null }) {
  if (shouldForceOrdersLocalFirst()) {
    const localResult = await enqueueLocalOrderItemInsert({ row, businessId });
    await invalidateOrderCache({ businessId, orderId: row?.order_id || null });
    await triggerBackgroundOutboxSync();
    return localResult;
  }

  const offlineMode = typeof navigator !== 'undefined' && navigator.onLine === false;
  if (offlineMode && canQueueLocalOrders()) {
    const localResult = await enqueueLocalOrderItemInsert({ row, businessId });
    await invalidateOrderCache({ businessId, orderId: row?.order_id || null });
    return localResult;
  }

  const { data, error } = await supabaseAdapter.insertOrderItem(row, selectSql);
  if (error) {
    if (canQueueLocalOrders() && isConnectivityError(error)) {
      const localResult = await enqueueLocalOrderItemInsert({ row, businessId });
      await invalidateOrderCache({ businessId, orderId: row?.order_id || null });
      await triggerBackgroundOutboxSync();
      return localResult;
    }
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

async function enqueueLocalDeleteOrderAndReleaseTable({ orderId, tableId, businessId = null }) {
  const queued = await enqueueOutboxMutation({
    businessId,
    mutationType: 'order.delete_and_release_table',
    payload: {
      local_write: true,
      order_id: orderId,
      table_id: tableId
    },
    mutationId: buildMutationId('order.delete_and_release_table.local', businessId)
  });

  if (!queued) {
    throw new Error('No se pudo guardar el cierre localmente');
  }

  return {
    order_id: orderId,
    table_id: tableId,
    __localOnly: true,
    pendingSync: true
  };
}

export async function deleteOrderAndReleaseTable({ orderId, tableId, businessId = null }) {
  if (shouldForceOrdersLocalFirst()) {
    const localResult = await enqueueLocalDeleteOrderAndReleaseTable({
      orderId,
      tableId,
      businessId
    });
    await invalidateOrderCache({ businessId, orderId, tableId });
    await triggerBackgroundOutboxSync();
    return localResult;
  }

  const offlineMode = typeof navigator !== 'undefined' && navigator.onLine === false;
  if (offlineMode && canQueueLocalOrders()) {
    const localResult = await enqueueLocalDeleteOrderAndReleaseTable({
      orderId,
      tableId,
      businessId
    });
    await invalidateOrderCache({ businessId, orderId, tableId });
    return localResult;
  }

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
  if (releaseTableError && !isMissingTablesUpdatedAtColumnError(releaseTableError)) {
    if (canQueueLocalOrders() && isConnectivityError(releaseTableError)) {
      const localResult = await enqueueLocalDeleteOrderAndReleaseTable({
        orderId,
        tableId,
        businessId
      });
      await invalidateOrderCache({ businessId, orderId, tableId });
      await triggerBackgroundOutboxSync();
      return localResult;
    }
    throw releaseTableError;
  }

  const { error: deleteOrderError } = await supabaseAdapter.deleteOrderById(orderId);
  if (deleteOrderError) {
    if (canQueueLocalOrders() && isConnectivityError(deleteOrderError)) {
      const localResult = await enqueueLocalDeleteOrderAndReleaseTable({
        orderId,
        tableId,
        businessId
      });
      await invalidateOrderCache({ businessId, orderId, tableId });
      await triggerBackgroundOutboxSync();
      return localResult;
    }
    throw deleteOrderError;
  }

  await enqueueOutboxMutation({
    businessId,
    mutationType: 'order.delete_and_release_table',
    payload: {
      order_id: orderId,
      table_id: tableId
    },
    mutationId: buildMutationId('order.delete_and_release_table', businessId)
  });
  await invalidateOrderCache({ businessId, orderId, tableId });

  return {
    order_id: orderId,
    table_id: tableId,
    __localOnly: false
  };
}

async function enqueueLocalTableDeleteCascade(tableId, { businessId = null } = {}) {
  const queued = await enqueueOutboxMutation({
    businessId,
    mutationType: 'table.delete_cascade_orders',
    payload: {
      local_write: true,
      table_id: tableId
    },
    mutationId: buildMutationId('table.delete_cascade_orders.local', businessId)
  });

  if (!queued) {
    throw new Error('No se pudo guardar la eliminación localmente');
  }

  return {
    table_id: tableId,
    __localOnly: true,
    pendingSync: true
  };
}

export async function deleteTableCascadeOrders(tableId, { businessId = null } = {}) {
  const associatedOrderIds = await getAssociatedOrderIdsForTable({ businessId, tableId });

  if (shouldForceOrdersLocalFirst()) {
    await purgeLocalTableCascadeArtifacts({
      businessId,
      tableId,
      orderIds: associatedOrderIds
    });
    const localResult = await enqueueLocalTableDeleteCascade(tableId, { businessId });
    await invalidateOrderCache({ businessId, tableId });
    await triggerBackgroundOutboxSync();
    return localResult;
  }

  const offlineMode = typeof navigator !== 'undefined' && navigator.onLine === false;
  if (offlineMode && canQueueLocalOrders()) {
    await purgeLocalTableCascadeArtifacts({
      businessId,
      tableId,
      orderIds: associatedOrderIds
    });
    const localResult = await enqueueLocalTableDeleteCascade(tableId, { businessId });
    await invalidateOrderCache({ businessId, tableId });
    return localResult;
  }

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
  if (releaseTableError && !isMissingTablesUpdatedAtColumnError(releaseTableError)) {
    if (canQueueLocalOrders() && isConnectivityError(releaseTableError)) {
      await purgeLocalTableCascadeArtifacts({
        businessId,
        tableId,
        orderIds: associatedOrderIds
      });
      const localResult = await enqueueLocalTableDeleteCascade(tableId, { businessId });
      await invalidateOrderCache({ businessId, tableId });
      await triggerBackgroundOutboxSync();
      return localResult;
    }
    throw releaseTableError;
  }

  const { error: ordersError } = businessId
    ? await supabaseAdapter.deleteOrdersByBusinessAndTableId({ businessId, tableId })
    : await supabaseAdapter.deleteOrdersByTableId(tableId);
  if (ordersError) {
    if (canQueueLocalOrders() && isConnectivityError(ordersError)) {
      await purgeLocalTableCascadeArtifacts({
        businessId,
        tableId,
        orderIds: associatedOrderIds
      });
      const localResult = await enqueueLocalTableDeleteCascade(tableId, { businessId });
      await invalidateOrderCache({ businessId, tableId });
      await triggerBackgroundOutboxSync();
      return localResult;
    }
    throw ordersError;
  }

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
