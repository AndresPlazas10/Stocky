import { isConnectivityError } from '../data/commands/salesOutboxRetryPolicy.js';

async function resolveSupabaseAdapter() {
  try {
    const mod = await import('../data/adapters/supabaseAdapter.js');
    return mod?.supabaseAdapter || null;
  } catch {
    return null;
  }
}

function isDuplicateRecordError(errorLike) {
  const code = String(errorLike?.code || '').trim();
  const message = String(errorLike?.message || errorLike || '').toLowerCase();
  return code === '23505' || message.includes('duplicate key');
}

function buildInvoiceStockUpdates(items = []) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => ({
      product_id: item?.product_id,
      quantity: Number(item?.quantity || 0)
    }))
    .filter((item) => item.product_id && item.quantity > 0);
}

export async function handleProductCreateMutation(event, {
  getProductSyncStateByIdFn = null,
  insertProductFn = null
} = {}) {
  const payload = event?.payload && typeof event.payload === 'object' ? event.payload : {};
  const productRow = payload?.product && typeof payload.product === 'object' ? payload.product : null;
  const productId = String(payload?.product_id || productRow?.id || '').trim() || null;
  const businessId = String(
    payload?.business_id
      || productRow?.business_id
      || event?.business_id
      || ''
  ).trim();

  if (!productRow || !businessId) {
    return {
      ack: false,
      retryable: false,
      error: 'product.create inválido: faltan product row o business_id'
    };
  }

  let getter = getProductSyncStateByIdFn;
  let inserter = insertProductFn;
  if (typeof getter !== 'function' || typeof inserter !== 'function') {
    const adapter = await resolveSupabaseAdapter();
    if (typeof getter !== 'function') getter = adapter?.getProductSyncStateById;
    if (typeof inserter !== 'function') inserter = adapter?.insertProduct;
  }

  if (typeof inserter !== 'function') {
    return {
      ack: false,
      retryable: true,
      error: 'No hay adapter disponible para product.create'
    };
  }

  try {
    if (productId && typeof getter === 'function') {
      const existing = await getter({ productId, businessId });
      if (!existing?.error && existing?.data?.id) {
        return { ack: true };
      }
    }

    const rowToInsert = {
      ...productRow,
      business_id: businessId,
      id: productId || productRow?.id || undefined
    };

    const result = await inserter(rowToInsert);
    if (result?.error) {
      if (isDuplicateRecordError(result.error)) {
        return { ack: true };
      }

      const message = String(result.error?.message || result.error || 'Error en product.create');
      return {
        ack: false,
        retryable: isConnectivityError(message),
        error: message
      };
    }

    return { ack: true };
  } catch (error) {
    if (isDuplicateRecordError(error)) {
      return { ack: true };
    }

    const message = String(error?.message || error || 'Error en product.create');
    return {
      ack: false,
      retryable: isConnectivityError(message),
      error: message
    };
  }
}

export async function handleProductUpdateMutation(event, {
  updateProductByIdFn = null
} = {}) {
  const payload = event?.payload && typeof event.payload === 'object' ? event.payload : {};
  const productId = String(payload?.product_id || '').trim();
  const update = payload?.update && typeof payload.update === 'object' ? payload.update : null;

  if (!productId || !update) {
    return {
      ack: false,
      retryable: false,
      error: 'product.update inválido: faltan product_id o update'
    };
  }

  let updater = updateProductByIdFn;
  if (typeof updater !== 'function') {
    const adapter = await resolveSupabaseAdapter();
    updater = adapter?.updateProductById;
  }

  if (typeof updater !== 'function') {
    return {
      ack: false,
      retryable: true,
      error: 'No hay adapter disponible para product.update'
    };
  }

  try {
    const result = await updater(productId, update);
    if (result?.error) {
      const message = String(result.error?.message || result.error || 'Error en product.update');
      return {
        ack: false,
        retryable: isConnectivityError(message),
        error: message
      };
    }

    return { ack: true };
  } catch (error) {
    const message = String(error?.message || error || 'Error en product.update');
    return {
      ack: false,
      retryable: isConnectivityError(message),
      error: message
    };
  }
}

export async function handleProductStatusUpdateMutation(event, deps = {}) {
  const payload = event?.payload && typeof event.payload === 'object' ? event.payload : {};
  const productId = String(payload?.product_id || '').trim();
  const update = payload?.update && typeof payload.update === 'object'
    ? payload.update
    : { is_active: payload?.is_active === true };

  const normalizedEvent = {
    ...event,
    payload: {
      ...payload,
      product_id: productId,
      update
    }
  };

  return handleProductUpdateMutation(normalizedEvent, deps);
}

export async function handleProductDeleteMutation(event, {
  getProductSyncStateByIdFn = null,
  deleteProductByIdFn = null
} = {}) {
  const payload = event?.payload && typeof event.payload === 'object' ? event.payload : {};
  const productId = String(payload?.product_id || '').trim();
  const businessId = String(
    payload?.business_id
      || event?.business_id
      || ''
  ).trim();

  if (!productId) {
    return {
      ack: false,
      retryable: false,
      error: 'product.delete inválido: falta product_id'
    };
  }

  let getter = getProductSyncStateByIdFn;
  let deleter = deleteProductByIdFn;
  if (typeof getter !== 'function' || typeof deleter !== 'function') {
    const adapter = await resolveSupabaseAdapter();
    if (typeof getter !== 'function') getter = adapter?.getProductSyncStateById;
    if (typeof deleter !== 'function') deleter = adapter?.deleteProductById;
  }

  if (typeof deleter !== 'function') {
    return {
      ack: false,
      retryable: true,
      error: 'No hay adapter disponible para product.delete'
    };
  }

  try {
    // Idempotencia: si ya no existe, considerar ACK.
    if (typeof getter === 'function' && businessId) {
      const existing = await getter({ productId, businessId });
      if (!existing?.error && !existing?.data?.id) {
        return { ack: true };
      }
    }

    const result = await deleter(productId);
    if (result?.error) {
      const message = String(result.error?.message || result.error || 'Error en product.delete');
      return {
        ack: false,
        retryable: isConnectivityError(message),
        error: message
      };
    }

    return { ack: true };
  } catch (error) {
    const message = String(error?.message || error || 'Error en product.delete');
    return {
      ack: false,
      retryable: isConnectivityError(message),
      error: message
    };
  }
}

export async function handleTableCreateMutation(event, {
  getTableSyncStateByIdFn = null,
  insertTableFn = null
} = {}) {
  const payload = event?.payload && typeof event.payload === 'object' ? event.payload : {};
  const tableId = String(payload?.table_id || '').trim();
  const tableNumber = Number(payload?.table_number);
  const businessId = String(
    payload?.business_id
      || event?.business_id
      || ''
  ).trim();

  if (!tableId || !businessId || !Number.isFinite(tableNumber)) {
    return {
      ack: false,
      retryable: false,
      error: 'table.create inválido: faltan table_id, table_number o business_id'
    };
  }

  let getter = getTableSyncStateByIdFn;
  let inserter = insertTableFn;
  if (typeof getter !== 'function' || typeof inserter !== 'function') {
    const adapter = await resolveSupabaseAdapter();
    if (typeof getter !== 'function') getter = adapter?.getTableSyncStateById;
    if (typeof inserter !== 'function') inserter = adapter?.insertTable;
  }

  if (typeof inserter !== 'function') {
    return {
      ack: false,
      retryable: true,
      error: 'No hay adapter disponible para table.create'
    };
  }

  try {
    if (typeof getter === 'function') {
      const existing = await getter({ tableId, businessId });
      if (!existing?.error && existing?.data?.id) {
        return { ack: true };
      }
    }

    const row = {
      id: tableId,
      business_id: businessId,
      table_number: tableNumber,
      status: 'available'
    };

    const result = await inserter(row);
    if (result?.error) {
      if (isDuplicateRecordError(result.error)) {
        return { ack: true };
      }

      const message = String(result.error?.message || result.error || 'Error en table.create');
      return {
        ack: false,
        retryable: isConnectivityError(message),
        error: message
      };
    }

    return { ack: true };
  } catch (error) {
    if (isDuplicateRecordError(error)) {
      return { ack: true };
    }

    const message = String(error?.message || error || 'Error en table.create');
    return {
      ack: false,
      retryable: isConnectivityError(message),
      error: message
    };
  }
}

export async function handleOrderCreateMutation(event, {
  getOrderSyncStateByIdFn = null,
  insertOrderFn = null,
  updateTableByIdFn = null
} = {}) {
  const payload = event?.payload && typeof event.payload === 'object' ? event.payload : {};
  const orderId = String(payload?.order_id || '').trim();
  const tableId = String(payload?.table_id || '').trim();
  const userId = String(payload?.user_id || '').trim() || null;
  const businessId = String(
    payload?.business_id
      || event?.business_id
      || ''
  ).trim();

  if (!orderId || !tableId || !businessId) {
    return {
      ack: false,
      retryable: false,
      error: 'order.create inválido: faltan order_id, table_id o business_id'
    };
  }

  let getter = getOrderSyncStateByIdFn;
  let inserter = insertOrderFn;
  let updateTable = updateTableByIdFn;
  if (typeof getter !== 'function' || typeof inserter !== 'function' || typeof updateTable !== 'function') {
    const adapter = await resolveSupabaseAdapter();
    if (typeof getter !== 'function') getter = adapter?.getOrderSyncStateById;
    if (typeof inserter !== 'function') inserter = adapter?.insertOrder;
    if (typeof updateTable !== 'function') updateTable = adapter?.updateTableById;
  }

  if (typeof inserter !== 'function' || typeof updateTable !== 'function') {
    return {
      ack: false,
      retryable: true,
      error: 'No hay adapter disponible para order.create'
    };
  }

  try {
    if (typeof getter === 'function') {
      const existing = await getter({ orderId, businessId });
      if (!existing?.error && existing?.data?.id) {
        return { ack: true };
      }
    }

    const row = {
      id: orderId,
      business_id: businessId,
      table_id: tableId,
      user_id: userId,
      status: 'open',
      total: 0
    };

    const insertResult = await inserter(row);
    if (insertResult?.error) {
      if (isDuplicateRecordError(insertResult.error)) {
        return { ack: true };
      }

      const message = String(insertResult.error?.message || insertResult.error || 'Error en order.create');
      return {
        ack: false,
        retryable: isConnectivityError(message),
        error: message
      };
    }

    const tableResult = await updateTable(tableId, {
      current_order_id: orderId,
      status: 'occupied'
    });

    if (tableResult?.error) {
      const message = String(tableResult.error?.message || tableResult.error || 'Error al ocupar mesa en order.create');
      return {
        ack: false,
        retryable: isConnectivityError(message),
        error: message
      };
    }

    return { ack: true };
  } catch (error) {
    if (isDuplicateRecordError(error)) {
      return { ack: true };
    }

    const message = String(error?.message || error || 'Error en order.create');
    return {
      ack: false,
      retryable: isConnectivityError(message),
      error: message
    };
  }
}

export async function handleOrderDeleteAndReleaseTableMutation(event, {
  getOrderSyncStateByIdFn = null,
  getTableSyncStateByIdFn = null,
  updateTableByBusinessAndIdFn = null,
  deleteOrderByIdFn = null
} = {}) {
  const payload = event?.payload && typeof event.payload === 'object' ? event.payload : {};
  const orderId = String(payload?.order_id || '').trim();
  const tableId = String(payload?.table_id || '').trim();
  const businessId = String(
    payload?.business_id
      || event?.business_id
      || ''
  ).trim();

  if (!orderId || !tableId || !businessId) {
    return {
      ack: false,
      retryable: false,
      error: 'order.delete_and_release_table inválido: faltan order_id, table_id o business_id'
    };
  }

  let getOrder = getOrderSyncStateByIdFn;
  let getTable = getTableSyncStateByIdFn;
  let updateTable = updateTableByBusinessAndIdFn;
  let deleteOrder = deleteOrderByIdFn;
  if (
    typeof getOrder !== 'function'
    || typeof getTable !== 'function'
    || typeof updateTable !== 'function'
    || typeof deleteOrder !== 'function'
  ) {
    const adapter = await resolveSupabaseAdapter();
    if (typeof getOrder !== 'function') getOrder = adapter?.getOrderSyncStateById;
    if (typeof getTable !== 'function') getTable = adapter?.getTableSyncStateById;
    if (typeof updateTable !== 'function') updateTable = adapter?.updateTableByBusinessAndId;
    if (typeof deleteOrder !== 'function') deleteOrder = adapter?.deleteOrderById;
  }

  if (typeof updateTable !== 'function' || typeof deleteOrder !== 'function') {
    return {
      ack: false,
      retryable: true,
      error: 'No hay adapter disponible para order.delete_and_release_table'
    };
  }

  try {
    let tableReleased = false;
    if (typeof getTable === 'function') {
      const tableState = await getTable({ tableId, businessId });
      const tableStatus = String(tableState?.data?.status || '').toLowerCase();
      const currentOrderId = String(tableState?.data?.current_order_id || '').trim();
      tableReleased = !tableState?.error && tableStatus === 'available' && !currentOrderId;
    }

    if (!tableReleased) {
      const tableResult = await updateTable({
        businessId,
        tableId,
        payload: {
          current_order_id: null,
          status: 'available'
        }
      });
      if (tableResult?.error) {
        const message = String(tableResult.error?.message || tableResult.error || 'Error liberando mesa');
        return {
          ack: false,
          retryable: isConnectivityError(message),
          error: message
        };
      }
    }

    let orderExists = true;
    if (typeof getOrder === 'function') {
      const orderState = await getOrder({ orderId, businessId });
      orderExists = Boolean(!orderState?.error && orderState?.data?.id);
    }

    if (!orderExists) {
      return { ack: true };
    }

    const orderResult = await deleteOrder(orderId);
    if (orderResult?.error) {
      const message = String(orderResult.error?.message || orderResult.error || 'Error eliminando orden');
      return {
        ack: false,
        retryable: isConnectivityError(message),
        error: message
      };
    }

    return { ack: true };
  } catch (error) {
    const message = String(error?.message || error || 'Error en order.delete_and_release_table');
    return {
      ack: false,
      retryable: isConnectivityError(message),
      error: message
    };
  }
}

export async function handleTableDeleteCascadeOrdersMutation(event, {
  getTableSyncStateByIdFn = null,
  updateTableByBusinessAndIdFn = null,
  deleteOrdersByBusinessAndTableIdFn = null,
  deleteTableByBusinessAndIdFn = null
} = {}) {
  const payload = event?.payload && typeof event.payload === 'object' ? event.payload : {};
  const tableId = String(payload?.table_id || '').trim();
  const businessId = String(
    payload?.business_id
      || event?.business_id
      || ''
  ).trim();

  if (!tableId || !businessId) {
    return {
      ack: false,
      retryable: false,
      error: 'table.delete_cascade_orders inválido: faltan table_id o business_id'
    };
  }

  let getTable = getTableSyncStateByIdFn;
  let updateTable = updateTableByBusinessAndIdFn;
  let deleteOrders = deleteOrdersByBusinessAndTableIdFn;
  let deleteTable = deleteTableByBusinessAndIdFn;
  if (
    typeof getTable !== 'function'
    || typeof updateTable !== 'function'
    || typeof deleteOrders !== 'function'
    || typeof deleteTable !== 'function'
  ) {
    const adapter = await resolveSupabaseAdapter();
    if (typeof getTable !== 'function') getTable = adapter?.getTableSyncStateById;
    if (typeof updateTable !== 'function') updateTable = adapter?.updateTableByBusinessAndId;
    if (typeof deleteOrders !== 'function') deleteOrders = adapter?.deleteOrdersByBusinessAndTableId;
    if (typeof deleteTable !== 'function') deleteTable = adapter?.deleteTableByBusinessAndId;
  }

  if (typeof updateTable !== 'function' || typeof deleteOrders !== 'function' || typeof deleteTable !== 'function') {
    return {
      ack: false,
      retryable: true,
      error: 'No hay adapter disponible para table.delete_cascade_orders'
    };
  }

  try {
    if (typeof getTable === 'function') {
      const tableState = await getTable({ tableId, businessId });
      if (!tableState?.error && !tableState?.data?.id) {
        return { ack: true };
      }
    }

    const tableReleaseResult = await updateTable({
      businessId,
      tableId,
      payload: {
        current_order_id: null,
        status: 'available'
      }
    });
    if (tableReleaseResult?.error) {
      const message = String(tableReleaseResult.error?.message || tableReleaseResult.error || 'Error liberando mesa');
      return {
        ack: false,
        retryable: isConnectivityError(message),
        error: message
      };
    }

    const ordersResult = await deleteOrders({ businessId, tableId });
    if (ordersResult?.error) {
      const message = String(ordersResult.error?.message || ordersResult.error || 'Error eliminando órdenes');
      return {
        ack: false,
        retryable: isConnectivityError(message),
        error: message
      };
    }

    const tableDeleteResult = await deleteTable({ businessId, tableId });
    if (tableDeleteResult?.error) {
      const message = String(tableDeleteResult.error?.message || tableDeleteResult.error || 'Error eliminando mesa');
      return {
        ack: false,
        retryable: isConnectivityError(message),
        error: message
      };
    }

    return { ack: true };
  } catch (error) {
    const message = String(error?.message || error || 'Error en table.delete_cascade_orders');
    return {
      ack: false,
      retryable: isConnectivityError(message),
      error: message
    };
  }
}

export async function handleTableConsistencyDetectedMutation(event) {
  const payload = event?.payload && typeof event.payload === 'object' ? event.payload : {};
  const businessId = String(
    payload?.business_id
      || event?.business_id
      || ''
  ).trim();

  if (!businessId) {
    return {
      ack: false,
      retryable: false,
      error: 'table.consistency.detected inválido: falta business_id'
    };
  }

  // Evento de auditoría: por ahora solo confirmamos recepción.
  return { ack: true };
}

export async function handleTableConsistencyFixFailedMutation(event) {
  const payload = event?.payload && typeof event.payload === 'object' ? event.payload : {};
  const businessId = String(
    payload?.business_id
      || event?.business_id
      || ''
  ).trim();

  if (!businessId) {
    return {
      ack: false,
      retryable: false,
      error: 'table.consistency.fix_failed inválido: falta business_id'
    };
  }

  // Evento de auditoría: por ahora solo confirmamos recepción.
  return { ack: true };
}

async function handleOrderCloseMutation(event, {
  getOrderSyncStateByIdFn = null,
  getTableSyncStateByIdFn = null,
  updateOrderByBusinessAndIdFn = null,
  updateTableByBusinessAndIdFn = null
} = {}) {
  const payload = event?.payload && typeof event.payload === 'object' ? event.payload : {};
  const orderId = String(payload?.order_id || '').trim();
  const tableId = String(payload?.table_id || '').trim();
  const businessId = String(
    payload?.business_id
      || event?.business_id
      || ''
  ).trim();

  if (!orderId || !tableId || !businessId) {
    return {
      ack: false,
      retryable: false,
      error: 'order.close inválido: faltan order_id, table_id o business_id'
    };
  }

  let getOrder = getOrderSyncStateByIdFn;
  let getTable = getTableSyncStateByIdFn;
  let updateOrder = updateOrderByBusinessAndIdFn;
  let updateTable = updateTableByBusinessAndIdFn;
  if (
    typeof getOrder !== 'function'
    || typeof getTable !== 'function'
    || typeof updateOrder !== 'function'
    || typeof updateTable !== 'function'
  ) {
    const adapter = await resolveSupabaseAdapter();
    if (typeof getOrder !== 'function') getOrder = adapter?.getOrderSyncStateById;
    if (typeof getTable !== 'function') getTable = adapter?.getTableSyncStateById;
    if (typeof updateOrder !== 'function') updateOrder = adapter?.updateOrderByBusinessAndId;
    if (typeof updateTable !== 'function') updateTable = adapter?.updateTableByBusinessAndId;
  }

  if (typeof updateOrder !== 'function' || typeof updateTable !== 'function') {
    return {
      ack: false,
      retryable: true,
      error: 'No hay adapter disponible para order.close'
    };
  }

  try {
    let orderAlreadyClosed = false;
    if (typeof getOrder === 'function') {
      const orderState = await getOrder({ orderId, businessId });
      orderAlreadyClosed = !orderState?.error && String(orderState?.data?.status || '').toLowerCase() === 'closed';
    }

    if (!orderAlreadyClosed) {
      const orderUpdate = await updateOrder({
        businessId,
        orderId,
        payload: { status: 'closed', closed_at: new Date().toISOString() }
      });
      if (orderUpdate?.error) {
        const message = String(orderUpdate.error?.message || orderUpdate.error || 'Error en order.close (order)');
        return {
          ack: false,
          retryable: isConnectivityError(message),
          error: message
        };
      }
    }

    let tableAlreadyReleased = false;
    if (typeof getTable === 'function') {
      const tableState = await getTable({ tableId, businessId });
      const tableStatus = String(tableState?.data?.status || '').toLowerCase();
      const currentOrderId = String(tableState?.data?.current_order_id || '').trim();
      tableAlreadyReleased = !tableState?.error && tableStatus === 'available' && !currentOrderId;
    }

    if (!tableAlreadyReleased) {
      const tableUpdate = await updateTable({
        businessId,
        tableId,
        payload: {
          current_order_id: null,
          status: 'available'
        }
      });
      if (tableUpdate?.error) {
        const message = String(tableUpdate.error?.message || tableUpdate.error || 'Error en order.close (table)');
        return {
          ack: false,
          retryable: isConnectivityError(message),
          error: message
        };
      }
    }

    return { ack: true };
  } catch (error) {
    const message = String(error?.message || error || 'Error en order.close');
    return {
      ack: false,
      retryable: isConnectivityError(message),
      error: message
    };
  }
}

export async function handleOrderCloseSingleMutation(event, deps = {}) {
  return handleOrderCloseMutation(event, deps);
}

export async function handleOrderCloseSplitMutation(event, deps = {}) {
  return handleOrderCloseMutation(event, deps);
}

export async function handleOrderTotalUpdateMutation(event, {
  updateOrderByIdFn = null
} = {}) {
  const payload = event?.payload && typeof event.payload === 'object' ? event.payload : {};
  const orderId = String(payload?.order_id || '').trim();
  const total = Number(payload?.total || 0);

  if (!orderId || !Number.isFinite(total)) {
    return {
      ack: false,
      retryable: false,
      error: 'order.total.update inválido: faltan order_id o total'
    };
  }

  let updater = updateOrderByIdFn;
  if (typeof updater !== 'function') {
    const adapter = await resolveSupabaseAdapter();
    updater = adapter?.updateOrderById;
  }

  if (typeof updater !== 'function') {
    return {
      ack: false,
      retryable: true,
      error: 'No hay adapter disponible para order.total.update'
    };
  }

  try {
    const result = await updater(orderId, { total });
    if (result?.error) {
      const message = String(result.error?.message || result.error || 'Error en order.total.update');
      return {
        ack: false,
        retryable: isConnectivityError(message),
        error: message
      };
    }

    return { ack: true };
  } catch (error) {
    const message = String(error?.message || error || 'Error en order.total.update');
    return {
      ack: false,
      retryable: isConnectivityError(message),
      error: message
    };
  }
}

export async function handleOrderItemUpdateQuantityMutation(event, {
  updateOrderItemByIdFn = null
} = {}) {
  const payload = event?.payload && typeof event.payload === 'object' ? event.payload : {};
  const itemId = String(payload?.item_id || '').trim();
  const quantity = Number(payload?.quantity);

  if (!itemId || !Number.isFinite(quantity)) {
    return {
      ack: false,
      retryable: false,
      error: 'order.item.update_quantity inválido: faltan item_id o quantity'
    };
  }

  let updater = updateOrderItemByIdFn;
  if (typeof updater !== 'function') {
    const adapter = await resolveSupabaseAdapter();
    updater = adapter?.updateOrderItemById;
  }

  if (typeof updater !== 'function') {
    return {
      ack: false,
      retryable: true,
      error: 'No hay adapter disponible para order.item.update_quantity'
    };
  }

  try {
    const result = await updater(itemId, { quantity });
    if (result?.error) {
      const message = String(result.error?.message || result.error || 'Error en order.item.update_quantity');
      return {
        ack: false,
        retryable: isConnectivityError(message),
        error: message
      };
    }

    return { ack: true };
  } catch (error) {
    const message = String(error?.message || error || 'Error en order.item.update_quantity');
    return {
      ack: false,
      retryable: isConnectivityError(message),
      error: message
    };
  }
}

export async function handleOrderItemDeleteMutation(event, {
  getOrderItemSyncStateByIdFn = null,
  deleteOrderItemByIdFn = null
} = {}) {
  const payload = event?.payload && typeof event.payload === 'object' ? event.payload : {};
  const itemId = String(payload?.item_id || '').trim();

  if (!itemId) {
    return {
      ack: false,
      retryable: false,
      error: 'order.item.delete inválido: falta item_id'
    };
  }

  let getter = getOrderItemSyncStateByIdFn;
  let deleter = deleteOrderItemByIdFn;
  if (typeof getter !== 'function' || typeof deleter !== 'function') {
    const adapter = await resolveSupabaseAdapter();
    if (typeof getter !== 'function') getter = adapter?.getOrderItemSyncStateById;
    if (typeof deleter !== 'function') deleter = adapter?.deleteOrderItemById;
  }

  if (typeof deleter !== 'function') {
    return {
      ack: false,
      retryable: true,
      error: 'No hay adapter disponible para order.item.delete'
    };
  }

  try {
    if (typeof getter === 'function') {
      const existing = await getter(itemId);
      if (!existing?.error && !existing?.data?.id) {
        return { ack: true };
      }
    }

    const result = await deleter(itemId);
    if (result?.error) {
      const message = String(result.error?.message || result.error || 'Error en order.item.delete');
      return {
        ack: false,
        retryable: isConnectivityError(message),
        error: message
      };
    }

    return { ack: true };
  } catch (error) {
    const message = String(error?.message || error || 'Error en order.item.delete');
    return {
      ack: false,
      retryable: isConnectivityError(message),
      error: message
    };
  }
}

export async function handleOrderItemInsertMutation(event, {
  getOrderItemSyncStateByIdFn = null,
  insertOrderItemFn = null
} = {}) {
  const payload = event?.payload && typeof event.payload === 'object' ? event.payload : {};
  const itemId = String(payload?.item_id || '').trim();
  const orderId = String(payload?.order_id || '').trim();
  const quantity = Number(payload?.quantity);
  const price = Number(payload?.price || 0);
  const productId = payload?.product_id || null;
  const comboId = payload?.combo_id || null;

  if (!itemId || !orderId || !Number.isFinite(quantity)) {
    return {
      ack: false,
      retryable: false,
      error: 'order.item.insert inválido: faltan item_id, order_id o quantity'
    };
  }

  let getter = getOrderItemSyncStateByIdFn;
  let inserter = insertOrderItemFn;
  if (typeof getter !== 'function' || typeof inserter !== 'function') {
    const adapter = await resolveSupabaseAdapter();
    if (typeof getter !== 'function') getter = adapter?.getOrderItemSyncStateById;
    if (typeof inserter !== 'function') inserter = adapter?.insertOrderItem;
  }

  if (typeof inserter !== 'function') {
    return {
      ack: false,
      retryable: true,
      error: 'No hay adapter disponible para order.item.insert'
    };
  }

  try {
    if (typeof getter === 'function') {
      const existing = await getter(itemId);
      if (!existing?.error && existing?.data?.id) {
        return { ack: true };
      }
    }

    const row = {
      id: itemId,
      order_id: orderId,
      product_id: productId,
      combo_id: comboId,
      quantity,
      price,
      subtotal: Number.isFinite(price) ? quantity * price : 0
    };

    const result = await inserter(row, 'id');
    if (result?.error) {
      if (isDuplicateRecordError(result.error)) {
        return { ack: true };
      }

      const message = String(result.error?.message || result.error || 'Error en order.item.insert');
      return {
        ack: false,
        retryable: isConnectivityError(message),
        error: message
      };
    }

    return { ack: true };
  } catch (error) {
    if (isDuplicateRecordError(error)) {
      return { ack: true };
    }

    const message = String(error?.message || error || 'Error en order.item.insert');
    return {
      ack: false,
      retryable: isConnectivityError(message),
      error: message
    };
  }
}

export async function handleOrderItemBulkQuantityUpdateMutation(event, {
  updateOrderItemByIdFn = null
} = {}) {
  const payload = event?.payload && typeof event.payload === 'object' ? event.payload : {};
  const updates = Array.isArray(payload?.updates) ? payload.updates : [];

  if (updates.length === 0) {
    return {
      ack: false,
      retryable: false,
      error: 'order.item.bulk_quantity_update inválido: faltan updates'
    };
  }

  const normalizedUpdates = updates
    .map((entry) => ({
      item_id: String(entry?.item_id || '').trim(),
      quantity: Number(entry?.quantity)
    }))
    .filter((entry) => entry.item_id && Number.isFinite(entry.quantity));

  if (normalizedUpdates.length === 0) {
    return {
      ack: false,
      retryable: false,
      error: 'order.item.bulk_quantity_update inválido: updates sin item_id/quantity válidos'
    };
  }

  let updater = updateOrderItemByIdFn;
  if (typeof updater !== 'function') {
    const adapter = await resolveSupabaseAdapter();
    updater = adapter?.updateOrderItemById;
  }

  if (typeof updater !== 'function') {
    return {
      ack: false,
      retryable: true,
      error: 'No hay adapter disponible para order.item.bulk_quantity_update'
    };
  }

  try {
    for (const entry of normalizedUpdates) {
      const result = await updater(entry.item_id, { quantity: entry.quantity });
      if (result?.error) {
        const message = String(result.error?.message || result.error || 'Error en order.item.bulk_quantity_update');
        return {
          ack: false,
          retryable: isConnectivityError(message),
          error: message
        };
      }
    }

    return { ack: true };
  } catch (error) {
    const message = String(error?.message || error || 'Error en order.item.bulk_quantity_update');
    return {
      ack: false,
      retryable: isConnectivityError(message),
      error: message
    };
  }
}

export async function handleInvoiceSentMutation(event, {
  updateInvoiceByIdFn = null
} = {}) {
  const payload = event?.payload && typeof event.payload === 'object' ? event.payload : {};
  const invoiceId = String(payload?.invoice_id || '').trim();
  const sentAt = String(payload?.sent_at || '').trim() || new Date().toISOString();

  if (!invoiceId) {
    return {
      ack: false,
      retryable: false,
      error: 'invoice.sent inválido: falta invoice_id'
    };
  }

  let updater = updateInvoiceByIdFn;
  if (typeof updater !== 'function') {
    const adapter = await resolveSupabaseAdapter();
    updater = adapter?.updateInvoiceById;
  }

  if (typeof updater !== 'function') {
    return {
      ack: false,
      retryable: true,
      error: 'No hay adapter disponible para invoice.sent'
    };
  }

  try {
    const result = await updater(invoiceId, {
      status: 'sent',
      sent_at: sentAt
    });

    if (result?.error) {
      const message = String(result.error?.message || result.error || 'Error en invoice.sent');
      return {
        ack: false,
        retryable: isConnectivityError(message),
        error: message
      };
    }

    return { ack: true };
  } catch (error) {
    const message = String(error?.message || error || 'Error en invoice.sent');
    return {
      ack: false,
      retryable: isConnectivityError(message),
      error: message
    };
  }
}

export async function handleInvoiceUpdateMutation(event, {
  updateInvoiceByIdFn = null
} = {}) {
  const payload = event?.payload && typeof event.payload === 'object' ? event.payload : {};
  const invoiceId = String(payload?.invoice_id || '').trim();
  const update = payload?.update && typeof payload.update === 'object' ? payload.update : null;

  if (!invoiceId || !update) {
    return {
      ack: false,
      retryable: false,
      error: 'invoice.update inválido: faltan invoice_id o update'
    };
  }

  let updater = updateInvoiceByIdFn;
  if (typeof updater !== 'function') {
    const adapter = await resolveSupabaseAdapter();
    updater = adapter?.updateInvoiceById;
  }

  if (typeof updater !== 'function') {
    return {
      ack: false,
      retryable: true,
      error: 'No hay adapter disponible para invoice.update'
    };
  }

  try {
    const result = await updater(invoiceId, update);
    if (result?.error) {
      const message = String(result.error?.message || result.error || 'Error en invoice.update');
      return {
        ack: false,
        retryable: isConnectivityError(message),
        error: message
      };
    }

    return { ack: true };
  } catch (error) {
    const message = String(error?.message || error || 'Error en invoice.update');
    return {
      ack: false,
      retryable: isConnectivityError(message),
      error: message
    };
  }
}

export async function handleInvoiceCancelledMutation(event, {
  updateInvoiceByIdFn = null,
  restoreStockBatchFn = null
} = {}) {
  const payload = event?.payload && typeof event.payload === 'object' ? event.payload : {};
  const invoiceId = String(payload?.invoice_id || '').trim();
  const cancelledAt = String(payload?.cancelled_at || '').trim() || new Date().toISOString();
  const restoreStockWarning = payload?.restore_stock_warning === true;
  const productUpdates = Array.isArray(payload?.product_updates)
    ? payload.product_updates
      .map((item) => ({
        product_id: item?.product_id,
        quantity: Number(item?.quantity || 0)
      }))
      .filter((item) => item.product_id && item.quantity > 0)
    : [];

  if (!invoiceId) {
    return {
      ack: false,
      retryable: false,
      error: 'invoice.cancelled inválido: falta invoice_id'
    };
  }

  let updater = updateInvoiceByIdFn;
  let restoreStock = restoreStockBatchFn;
  if (typeof updater !== 'function') {
    const adapter = await resolveSupabaseAdapter();
    updater = adapter?.updateInvoiceById;
    if (typeof restoreStock !== 'function') restoreStock = adapter?.restoreStockBatch;
  }

  if (typeof updater !== 'function') {
    return {
      ack: false,
      retryable: true,
      error: 'No hay adapter disponible para invoice.cancelled'
    };
  }

  try {
    const result = await updater(invoiceId, {
      status: 'cancelled',
      cancelled_at: cancelledAt
    });

    if (result?.error) {
      const message = String(result.error?.message || result.error || 'Error en invoice.cancelled');
      return {
        ack: false,
        retryable: isConnectivityError(message),
        error: message
      };
    }

    if (restoreStockWarning && productUpdates.length > 0) {
      if (typeof restoreStock !== 'function') {
        return {
          ack: false,
          retryable: true,
          error: 'No hay adapter disponible para restaurar stock en invoice.cancelled'
        };
      }

      const restoreResult = await restoreStock(productUpdates);
      if (restoreResult?.error) {
        const message = String(restoreResult.error?.message || restoreResult.error || 'Error en restore_stock_batch');
        return {
          ack: false,
          retryable: isConnectivityError(message),
          error: message
        };
      }
    }

    return { ack: true };
  } catch (error) {
    const message = String(error?.message || error || 'Error en invoice.cancelled');
    return {
      ack: false,
      retryable: isConnectivityError(message),
      error: message
    };
  }
}

export async function handleInvoiceDeleteMutation(event, {
  getInvoiceSyncStateByIdFn = null,
  deleteInvoiceItemsByInvoiceIdFn = null,
  deleteInvoiceByIdFn = null
} = {}) {
  const payload = event?.payload && typeof event.payload === 'object' ? event.payload : {};
  const invoiceId = String(payload?.invoice_id || '').trim();
  const businessId = String(
    payload?.business_id
      || event?.business_id
      || ''
  ).trim();

  if (!invoiceId) {
    return {
      ack: false,
      retryable: false,
      error: 'invoice.delete inválido: falta invoice_id'
    };
  }

  let getter = getInvoiceSyncStateByIdFn;
  let deleteItems = deleteInvoiceItemsByInvoiceIdFn;
  let deleter = deleteInvoiceByIdFn;
  if (
    typeof getter !== 'function'
    || typeof deleteItems !== 'function'
    || typeof deleter !== 'function'
  ) {
    const adapter = await resolveSupabaseAdapter();
    if (typeof getter !== 'function') getter = adapter?.getInvoiceSyncStateById;
    if (typeof deleteItems !== 'function') deleteItems = adapter?.deleteInvoiceItemsByInvoiceId;
    if (typeof deleter !== 'function') deleter = adapter?.deleteInvoiceById;
  }

  if (typeof deleteItems !== 'function' || typeof deleter !== 'function') {
    return {
      ack: false,
      retryable: true,
      error: 'No hay adapter disponible para invoice.delete'
    };
  }

  try {
    if (typeof getter === 'function' && businessId) {
      const existing = await getter({ invoiceId, businessId });
      if (!existing?.error && !existing?.data?.id) {
        return { ack: true };
      }
    }

    const itemsResult = await deleteItems(invoiceId);
    if (itemsResult?.error) {
      const message = String(itemsResult.error?.message || itemsResult.error || 'Error en invoice_items.delete');
      return {
        ack: false,
        retryable: isConnectivityError(message),
        error: message
      };
    }

    const invoiceResult = await deleter(invoiceId);
    if (invoiceResult?.error) {
      const message = String(invoiceResult.error?.message || invoiceResult.error || 'Error en invoice.delete');
      return {
        ack: false,
        retryable: isConnectivityError(message),
        error: message
      };
    }

    return { ack: true };
  } catch (error) {
    const message = String(error?.message || error || 'Error en invoice.delete');
    return {
      ack: false,
      retryable: isConnectivityError(message),
      error: message
    };
  }
}

export async function handleInvoiceCreateMutation(event, {
  getInvoiceSyncStateByIdFn = null,
  insertInvoiceFn = null,
  insertInvoiceItemsFn = null,
  updateStockBatchFn = null
} = {}) {
  const payload = event?.payload && typeof event.payload === 'object' ? event.payload : {};
  const invoiceId = String(payload?.invoice_id || payload?.invoice?.id || '').trim();
  const invoice = payload?.invoice && typeof payload.invoice === 'object' ? payload.invoice : null;
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const businessId = String(
    payload?.business_id
      || invoice?.business_id
      || event?.business_id
      || ''
  ).trim();

  if (!invoiceId || !invoice || !businessId) {
    return {
      ack: false,
      retryable: false,
      error: 'invoice.create inválido: faltan invoice_id, invoice o business_id'
    };
  }

  let getter = getInvoiceSyncStateByIdFn;
  let insertInvoice = insertInvoiceFn;
  let insertItems = insertInvoiceItemsFn;
  let updateStock = updateStockBatchFn;

  if (
    typeof getter !== 'function'
    || typeof insertInvoice !== 'function'
    || typeof insertItems !== 'function'
    || typeof updateStock !== 'function'
  ) {
    const adapter = await resolveSupabaseAdapter();
    if (typeof getter !== 'function') getter = adapter?.getInvoiceSyncStateById;
    if (typeof insertInvoice !== 'function') insertInvoice = adapter?.insertInvoice;
    if (typeof insertItems !== 'function') insertItems = adapter?.insertInvoiceItems;
    if (typeof updateStock !== 'function') updateStock = adapter?.updateStockBatch;
  }

  if (typeof insertInvoice !== 'function' || typeof insertItems !== 'function' || typeof updateStock !== 'function') {
    return {
      ack: false,
      retryable: true,
      error: 'No hay adapter disponible para invoice.create'
    };
  }

  try {
    if (typeof getter === 'function') {
      const existing = await getter({ invoiceId, businessId });
      if (!existing?.error && existing?.data?.id) {
        return { ack: true };
      }
    }

    const invoiceRow = {
      ...invoice,
      id: invoiceId,
      business_id: businessId
    };

    const invoiceResult = await insertInvoice(invoiceRow);
    if (invoiceResult?.error) {
      if (isDuplicateRecordError(invoiceResult.error)) {
        return { ack: true };
      }

      const message = String(invoiceResult.error?.message || invoiceResult.error || 'Error en invoice.create');
      return {
        ack: false,
        retryable: isConnectivityError(message),
        error: message
      };
    }

    const normalizedItems = items
      .map((item) => ({
        ...item,
        invoice_id: invoiceId
      }))
      .filter((item) => item?.invoice_id);

    if (normalizedItems.length > 0) {
      const itemsResult = await insertItems(normalizedItems);
      if (itemsResult?.error) {
        const message = String(itemsResult.error?.message || itemsResult.error || 'Error en invoice_items');
        return {
          ack: false,
          retryable: isConnectivityError(message),
          error: message
        };
      }
    }

    const stockUpdates = buildInvoiceStockUpdates(normalizedItems);
    if (stockUpdates.length > 0) {
      const stockResult = await updateStock(stockUpdates);
      if (stockResult?.error) {
        const message = String(stockResult.error?.message || stockResult.error || 'Error en stock batch');
        return {
          ack: false,
          retryable: isConnectivityError(message),
          error: message
        };
      }
    }

    return { ack: true };
  } catch (error) {
    if (isDuplicateRecordError(error)) {
      return { ack: true };
    }

    const message = String(error?.message || error || 'Error en invoice.create');
    return {
      ack: false,
      retryable: isConnectivityError(message),
      error: message
    };
  }
}

export async function dispatchOutboxMutation(event, deps = {}) {
  const mutationType = String(event?.mutation_type || '').trim().toLowerCase();

  if (mutationType === 'product.create') {
    return handleProductCreateMutation(event, deps);
  }

  if (mutationType === 'product.update') {
    return handleProductUpdateMutation(event, deps);
  }

  if (mutationType === 'product.status.update') {
    return handleProductStatusUpdateMutation(event, deps);
  }

  if (mutationType === 'product.delete') {
    return handleProductDeleteMutation(event, deps);
  }

  if (mutationType === 'table.create') {
    return handleTableCreateMutation(event, deps);
  }

  if (mutationType === 'order.create') {
    return handleOrderCreateMutation(event, deps);
  }

  if (mutationType === 'order.close.single') {
    return handleOrderCloseSingleMutation(event, deps);
  }

  if (mutationType === 'order.close.split') {
    return handleOrderCloseSplitMutation(event, deps);
  }

  if (mutationType === 'order.delete_and_release_table') {
    return handleOrderDeleteAndReleaseTableMutation(event, deps);
  }

  if (mutationType === 'order.total.update') {
    return handleOrderTotalUpdateMutation(event, deps);
  }

  if (mutationType === 'order.item.update_quantity') {
    return handleOrderItemUpdateQuantityMutation(event, deps);
  }

  if (mutationType === 'order.item.delete') {
    return handleOrderItemDeleteMutation(event, deps);
  }

  if (mutationType === 'order.item.insert') {
    return handleOrderItemInsertMutation(event, deps);
  }

  if (mutationType === 'order.item.bulk_quantity_update') {
    return handleOrderItemBulkQuantityUpdateMutation(event, deps);
  }

  if (mutationType === 'table.delete_cascade_orders') {
    return handleTableDeleteCascadeOrdersMutation(event, deps);
  }

  if (mutationType === 'table.consistency.detected') {
    return handleTableConsistencyDetectedMutation(event, deps);
  }

  if (mutationType === 'table.consistency.fix_failed') {
    return handleTableConsistencyFixFailedMutation(event, deps);
  }

  if (mutationType === 'invoice.sent') {
    return handleInvoiceSentMutation(event, deps);
  }

  if (mutationType === 'invoice.update') {
    return handleInvoiceUpdateMutation(event, deps);
  }

  if (mutationType === 'invoice.cancel') {
    return handleInvoiceCancelledMutation(event, deps);
  }

  if (mutationType === 'invoice.cancelled') {
    return handleInvoiceCancelledMutation(event, deps);
  }

  if (mutationType === 'invoice.delete') {
    return handleInvoiceDeleteMutation(event, deps);
  }

  if (mutationType === 'invoice.create') {
    return handleInvoiceCreateMutation(event, deps);
  }

  // Scaffold: por ahora el resto se confirma localmente.
  return { ack: true };
}

export default {
  dispatchOutboxMutation,
  handleOrderCloseSingleMutation,
  handleOrderCloseSplitMutation,
  handleOrderDeleteAndReleaseTableMutation,
  handleOrderItemBulkQuantityUpdateMutation,
  handleOrderCreateMutation,
  handleOrderItemDeleteMutation,
  handleOrderItemInsertMutation,
  handleOrderItemUpdateQuantityMutation,
  handleOrderTotalUpdateMutation,
  handleProductCreateMutation,
  handleProductDeleteMutation,
  handleProductStatusUpdateMutation,
  handleProductUpdateMutation,
  handleTableConsistencyDetectedMutation,
  handleTableConsistencyFixFailedMutation,
  handleTableDeleteCascadeOrdersMutation,
  handleTableCreateMutation,
  handleInvoiceCancelledMutation,
  handleInvoiceCreateMutation,
  handleInvoiceDeleteMutation,
  handleInvoiceSentMutation,
  handleInvoiceUpdateMutation
};
