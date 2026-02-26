/**
 * Servicio de órdenes (mesas): cierre de orden con ventas y descuento de stock.
 * Centraliza la lógica que antes estaba en Mesas.jsx para facilitar tests y futura unificación con salesService.
 */

import { supabaseAdapter } from '../data/adapters/supabaseAdapter.js';
import { isAdminRole } from '../utils/roles.js';
import { enqueueOutboxMutation } from '../sync/outboxShadow.js';
import LOCAL_SYNC_CONFIG from '../config/localSync.js';
import { runOutboxTick } from '../sync/syncBootstrap.js';

function buildIdempotencyKey({ action, businessId, orderId, tableId }) {
  const normalizedAction = String(action || '').trim().toLowerCase();
  const b = String(businessId || '').trim();
  const o = String(orderId || '').trim();
  const t = String(tableId || '').trim();
  return `stocky:${normalizedAction}:${b}:${o}:${t}`;
}

async function enqueueOrderCloseOutbox({
  businessId,
  mutationType,
  mutationId,
  payload
}) {
  await enqueueOutboxMutation({
    businessId,
    mutationType,
    mutationId,
    payload
  });
}

function canQueueLocalOrderSales() {
  const hasAnyOrderCloseWritePath = Boolean(
    LOCAL_SYNC_CONFIG.localWrites?.orders
    || LOCAL_SYNC_CONFIG.localWrites?.tables
    || LOCAL_SYNC_CONFIG.localWrites?.sales
  );

  return Boolean(
    LOCAL_SYNC_CONFIG.enabled
    && LOCAL_SYNC_CONFIG.shadowWritesEnabled
    && hasAnyOrderCloseWritePath
  );
}

function shouldForceOrderSalesLocalFirst() {
  return Boolean(
    canQueueLocalOrderSales()
    && (
      LOCAL_SYNC_CONFIG.localWrites?.allLocalFirst
      || LOCAL_SYNC_CONFIG.localWrites?.ordersLocalFirst
      || LOCAL_SYNC_CONFIG.localWrites?.tablesLocalFirst
      || LOCAL_SYNC_CONFIG.localWrites?.salesLocalFirst
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

function buildOfflineCloseUnavailableMessage() {
  return 'Sin internet: el cierre offline de mesas no está habilitado en esta configuración.';
}

async function triggerBackgroundOutboxSync() {
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    runOutboxTick().catch(() => {});
  }
}

function buildLocalSaleId(mutationId) {
  return `local:${mutationId}`;
}

function normalizeSplitSubAccountsForRpc(subAccounts = []) {
  if (!Array.isArray(subAccounts)) return [];

  return subAccounts.map((sub, index) => {
    const normalizedPaymentMethod = typeof sub?.paymentMethod === 'string'
      ? sub.paymentMethod
      : (typeof sub?.payment_method === 'string' ? sub.payment_method : 'cash');

    const normalizedItems = Array.isArray(sub?.items)
        ? sub.items
          .map((item) => {
            const productId = item?.product_id || item?.products?.id || null;
            const comboId = item?.combo_id || item?.combos?.id || null;
            const quantity = Number(item?.quantity);
            const unitPrice = Number(item?.unit_price ?? item?.price ?? item?.unitPrice);

            if ((!productId && !comboId) || (productId && comboId)) return null;
            if (!Number.isFinite(quantity) || quantity <= 0) return null;
            if (!Number.isFinite(unitPrice) || unitPrice < 0) return null;

            return {
              product_id: productId,
              combo_id: comboId,
              quantity,
              unit_price: unitPrice
            };
          })
          .filter(Boolean)
      : [];

    return {
      name: sub?.name || `Cuenta ${index + 1}`,
      paymentMethod: normalizedPaymentMethod,
      payment_method: normalizedPaymentMethod,
      amountReceived: sub?.amountReceived ?? sub?.amount_received ?? null,
      amount_received: sub?.amountReceived ?? sub?.amount_received ?? null,
      changeBreakdown: Array.isArray(sub?.changeBreakdown)
        ? sub.changeBreakdown
        : (Array.isArray(sub?.change_breakdown) ? sub.change_breakdown : []),
      change_breakdown: Array.isArray(sub?.changeBreakdown)
        ? sub.changeBreakdown
        : (Array.isArray(sub?.change_breakdown) ? sub.change_breakdown : []),
      items: normalizedItems
    };
  });
}

function normalizeOrderItemsForSale(orderItems = []) {
  const source = Array.isArray(orderItems) ? orderItems : [];
  return source.map((item = {}) => {
    const productId = normalizeReference(item?.product_id || item?.products?.id || null);
    const comboId = normalizeReference(item?.combo_id || item?.combos?.id || null);
    const quantity = Number(item?.quantity);
    const unitPrice = Number(item?.price ?? item?.unit_price);

    if ((!productId && !comboId) || (productId && comboId)) {
      throw new Error('❌ La orden tiene items inválidos: cada línea debe referenciar un producto o un combo.');
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error('❌ La orden tiene cantidades inválidas.');
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new Error('❌ La orden tiene precios inválidos.');
    }

    return {
      product_id: productId,
      combo_id: comboId,
      quantity,
      unit_price: unitPrice
    };
  });
}

async function enqueueSaleCreateForOrderClose({
  businessId,
  mutationId,
  paymentMethod = 'cash',
  items = [],
  orderId = null,
  tableId = null,
  amountReceived = null,
  changeBreakdown = [],
  sellerName = 'Administrador',
  userId = null
}) {
  const total = items.reduce(
    (sum, item) => sum + (Number(item.quantity || 0) * Number(item.unit_price || 0)),
    0
  );
  const queued = await enqueueOutboxMutation({
    businessId,
    mutationType: 'sale.create',
    mutationId,
    payload: {
      local_write: true,
      payment_method: paymentMethod || 'cash',
      items_count: items.length,
      items,
      total,
      order_id: orderId,
      table_id: tableId,
      amount_received: Number.isFinite(Number(amountReceived)) ? Number(amountReceived) : null,
      change_breakdown: Array.isArray(changeBreakdown) ? changeBreakdown : [],
      seller_name: sellerName || 'Administrador',
      user_id: userId || null,
      idempotency_key: mutationId,
      created_at: new Date().toISOString()
    }
  });

  if (!queued) {
    throw new Error('No se pudo guardar el cierre de mesa localmente.');
  }

  return {
    total,
    localSaleId: buildLocalSaleId(mutationId)
  };
}

async function enqueueLocalSingleClose({
  businessId,
  orderId,
  tableId,
  paymentMethod,
  amountReceived = null,
  changeBreakdown = [],
  itemsForRpc
}) {
  const mutationId = buildIdempotencyKey({
    action: 'close-order-single',
    businessId,
    orderId,
    tableId
  });

  const queuedSale = await enqueueSaleCreateForOrderClose({
    businessId,
    mutationId,
    paymentMethod,
    items: itemsForRpc,
    orderId,
    tableId,
    amountReceived,
    changeBreakdown,
    userId: null
  });

  await triggerBackgroundOutboxSync();

  return {
    saleTotal: queuedSale.total,
    saleId: queuedSale.localSaleId,
    localOnly: true,
    pendingSync: true
  };
}

async function enqueueLocalSplitClose({
  businessId,
  orderId,
  tableId,
  subAccountsWithItems = []
}) {
  const parentMutationId = buildIdempotencyKey({
    action: 'close-order-split',
    businessId,
    orderId,
    tableId
  });
  let totalSold = 0;
  const localSaleIds = [];

  for (let index = 0; index < subAccountsWithItems.length; index += 1) {
    const sub = subAccountsWithItems[index];
    const mutationId = `${parentMutationId}:sub:${index + 1}`;
    const isLast = index === subAccountsWithItems.length - 1;

    const queuedSale = await enqueueSaleCreateForOrderClose({
      businessId,
      mutationId,
      paymentMethod: sub.paymentMethod || 'cash',
      items: Array.isArray(sub.items) ? sub.items : [],
      orderId: isLast ? orderId : null,
      tableId: isLast ? tableId : null,
      amountReceived: sub.amountReceived ?? sub.amount_received ?? null,
      changeBreakdown: sub.changeBreakdown ?? sub.change_breakdown ?? [],
      userId: null
    });

    totalSold += Number(queuedSale.total || 0);
    localSaleIds.push(queuedSale.localSaleId);
  }

  await triggerBackgroundOutboxSync();

  return {
    totalSold,
    saleIds: localSaleIds,
    localOnly: true,
    pendingSync: true
  };
}

function isOrderContextError(errorLike) {
  const message = String(errorLike?.message || errorLike || '').toLowerCase();
  if (!message) return false;

  return (
    message.includes('la orden') && message.includes('no está abierta')
  ) || (
    message.includes('la mesa') && message.includes('no está asociada')
  ) || (
    message.includes('cambió durante el cierre')
  ) || (
    message.includes('orden') && message.includes('no encontrada')
  ) || (
    message.includes('mesa') && message.includes('no encontrada')
  );
}

function isFunctionUnavailableError(errorLike, functionName) {
  const message = String(errorLike?.message || errorLike || '').toLowerCase();
  if (!message) return false;

  const normalizedFn = String(functionName || '').toLowerCase();
  const referencesFunction = normalizedFn ? message.includes(normalizedFn) : true;

  return referencesFunction && (
    message.includes('does not exist')
  || message.includes('could not find the function')
  || message.includes('schema cache')
  || message.includes('not found')
  || message.includes('pgrst202')
  );
}

async function callCreateSaleCompleteWithFallback({
  preferBase = false,
  baseParams,
  idempotentParams
}) {
  let result = null;
  let rpcError = null;

  if (preferBase) {
    ({ data: result, error: rpcError } = await supabaseAdapter.createSaleCompleteRpc(baseParams));
    const missingBaseFn = isFunctionUnavailableError(rpcError, 'create_sale_complete');
    if (rpcError && missingBaseFn) {
      ({ data: result, error: rpcError } = await supabaseAdapter.createSaleCompleteIdempotentRpc(idempotentParams));
    }
    return { result, rpcError };
  }

  ({ data: result, error: rpcError } = await supabaseAdapter.createSaleCompleteIdempotentRpc(idempotentParams));
  const missingIdempotentFn = isFunctionUnavailableError(rpcError, 'create_sale_complete_idempotent');
  if (rpcError && missingIdempotentFn) {
    ({ data: result, error: rpcError } = await supabaseAdapter.createSaleCompleteRpc(baseParams));
  }

  return { result, rpcError };
}

function getFriendlySaleErrorMessage(errorLike, fallbackMessage) {
  const rawMessage = String(errorLike?.message || errorLike || '').trim();
  const normalized = rawMessage.toLowerCase();
  const code = String(errorLike?.code || '').trim();
  const status = String(errorLike?.status || errorLike?.statusCode || '').trim();
  const hint = String(errorLike?.hint || '').trim();
  const details = String(errorLike?.details || '').trim();

  if (normalized.includes('idx_sales_prevent_duplicates')) {
    return 'La venta ya estaba siendo procesada o ya fue registrada. Actualiza y verifica en Ventas.';
  }

  const baseMessage = rawMessage || fallbackMessage;
  const diagnosticParts = [
    code ? `code=${code}` : null,
    status ? `status=${status}` : null,
    hint ? `hint=${hint}` : null,
    details ? `details=${details}` : null
  ].filter(Boolean);

  if (diagnosticParts.length === 0) return baseMessage;
  return `${baseMessage} [diag: ${diagnosticParts.join(' | ')}]`;
}

function isSalesDuplicateIndexError(errorLike) {
  const message = String(errorLike?.message || errorLike || '').toLowerCase();
  if (!message) return false;
  return message.includes('idx_sales_prevent_duplicates');
}

function normalizeReference(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const lowered = raw.toLowerCase();
  if (lowered === 'null' || lowered === 'undefined') return null;
  return raw;
}

function normalizeCashBreakdownEntries(changeBreakdown) {
  if (!Array.isArray(changeBreakdown)) return [];

  return changeBreakdown
    .map((entry) => {
      const denomination = Math.round(Number(entry?.denomination));
      const count = Math.round(Number(entry?.count));

      if (!Number.isFinite(denomination) || denomination <= 0) return null;
      if (!Number.isFinite(count) || count <= 0) return null;

      return { denomination, count };
    })
    .filter(Boolean);
}

function computeChangeFromBreakdown(changeBreakdown = []) {
  return changeBreakdown.reduce((sum, entry) => {
    const denomination = Number(entry?.denomination || 0);
    const count = Number(entry?.count || 0);
    if (!Number.isFinite(denomination) || !Number.isFinite(count) || count <= 0) return sum;
    return sum + (denomination * count);
  }, 0);
}

function buildCashMetadata({ paymentMethod, saleTotal, amountReceived, changeBreakdown }) {
  if (paymentMethod !== 'cash') {
    return {
      amountReceived: null,
      changeAmount: null,
      changeBreakdown: []
    };
  }

  const normalizedSaleTotal = Number.isFinite(Number(saleTotal))
    ? Number(saleTotal)
    : 0;
  const normalizedAmountReceived = Number.isFinite(Number(amountReceived))
    ? Math.max(Number(amountReceived), 0)
    : null;
  const normalizedChangeBreakdown = normalizeCashBreakdownEntries(changeBreakdown);
  const breakdownChange = computeChangeFromBreakdown(normalizedChangeBreakdown);
  const changeFromDifference = normalizedAmountReceived !== null
    ? Math.max(normalizedAmountReceived - normalizedSaleTotal, 0)
    : null;

  return {
    amountReceived: normalizedAmountReceived,
    changeAmount: breakdownChange > 0 ? breakdownChange : changeFromDifference,
    changeBreakdown: normalizedChangeBreakdown
  };
}

async function persistSaleCashMetadata({
  businessId,
  saleId,
  paymentMethod,
  saleTotal,
  amountReceived,
  changeBreakdown
}) {
  if (!saleId || paymentMethod !== 'cash') return;

  const metadata = buildCashMetadata({
    paymentMethod,
    saleTotal,
    amountReceived,
    changeBreakdown
  });

  const { error } = await supabaseAdapter.updateSaleCashMetadataByBusinessAndId({
    businessId,
    saleId,
    payload: {
      amount_received: metadata.amountReceived,
      change_amount: metadata.changeAmount,
      change_breakdown: metadata.changeBreakdown
    }
  });

  if (error) {
    // Best-effort: no bloquear cierre de orden por metadatos de efectivo.
  }
}

async function finalizeOrderAndTable({ businessId, orderId, tableId }) {
  if (orderId) {
    const { error: orderCloseError } = await supabaseAdapter.updateOrderByBusinessAndId({
      businessId,
      orderId,
      payload: { status: 'closed', closed_at: new Date().toISOString() }
    });

    if (orderCloseError) {
      throw new Error(orderCloseError.message || '❌ No se pudo cerrar la orden.');
    }
  }

  if (tableId) {
    const { error: tableReleaseError } = await supabaseAdapter.updateTableByBusinessAndId({
      businessId,
      tableId,
      payload: { current_order_id: null, status: 'available' }
    });

    if (tableReleaseError) {
      throw new Error(tableReleaseError.message || '❌ No se pudo liberar la mesa.');
    }
  }
}

async function getSellerName(businessId) {
  const { data: { user } } = await supabaseAdapter.getCurrentUser();
  if (!user) throw new Error('❌ No se pudo obtener información del usuario');

  const [{ data: employee }, { data: business }] = await Promise.all([
    supabaseAdapter.getEmployeeByUserAndBusiness(user.id, businessId, 'full_name, role'),
    supabaseAdapter.getBusinessById(businessId, 'created_by')
  ]);

  const isOwner = user.id && business?.created_by && String(user.id).trim() === String(business.created_by).trim();
  const isAdmin = isAdminRole(employee?.role);

  const sellerName = isOwner || isAdmin
    ? 'Administrador'
    : (employee?.full_name || user.email || 'Empleado');

  return { user, sellerName };
}

/**
 * Cierra la orden dividida en varias ventas, descuenta stock y libera la mesa.
 * OPTIMIZADO: Usa RPC create_split_sales_complete en una transacción atómica.
 * @param {string} businessId
 * @param {{ subAccounts: Array<{ name: string, paymentMethod: string, items: Array<{ product_id: string, quantity: number, price: number }> }>, orderId: string, tableId: string }} params
 * @returns {Promise<{ totalSold: number, saleIds: string[] }>}
 */
export async function closeOrderAsSplit(businessId, { subAccounts, orderId, tableId }) {
  const normalizedSubAccounts = normalizeSplitSubAccountsForRpc(subAccounts);
  const subAccountsWithItems = normalizedSubAccounts.filter((sub) => Array.isArray(sub.items) && sub.items.length > 0);
  if (subAccountsWithItems.length === 0) {
    throw new Error('No hay subcuentas con productos válidos para procesar.');
  }
  const offlineMode = typeof navigator !== 'undefined' && navigator.onLine === false;

  if (shouldForceOrderSalesLocalFirst()) {
    return enqueueLocalSplitClose({
      businessId,
      orderId,
      tableId,
      subAccountsWithItems
    });
  }

  if (offlineMode && canQueueLocalOrderSales()) {
    return enqueueLocalSplitClose({
      businessId,
      orderId,
      tableId,
      subAccountsWithItems
    });
  }
  if (offlineMode && !canQueueLocalOrderSales()) {
    throw new Error(buildOfflineCloseUnavailableMessage());
  }

  let user = null;
  let sellerName = 'Administrador';
  try {
    ({ user, sellerName } = await getSellerName(businessId));
  } catch (error) {
    if (isConnectivityError(error)) {
      if (canQueueLocalOrderSales()) {
        return enqueueLocalSplitClose({
          businessId,
          orderId,
          tableId,
          subAccountsWithItems
        });
      }
      throw new Error(buildOfflineCloseUnavailableMessage());
    }
    throw error;
  }
  const operationStartedAt = new Date().toISOString();
  const idempotencyKey = buildIdempotencyKey({
    action: 'close-order-split',
    businessId,
    orderId,
    tableId
  });
  const hasComboItemsInSplit = subAccountsWithItems.some((sub) =>
    Array.isArray(sub.items) && sub.items.some((item) => Boolean(item?.combo_id))
  );

  // Camino principal: cierre atómico de todas las subcuentas en 1 transacción.
  let atomicResult = null;
  let atomicError = null;
  if (!hasComboItemsInSplit) {
    ({ data: atomicResult, error: atomicError } = await supabaseAdapter.createSplitSalesCompleteIdempotentRpc({
      p_business_id: businessId,
      p_user_id: user.id,
      p_seller_name: sellerName,
      p_sub_accounts: subAccountsWithItems,
      p_order_id: orderId,
      p_table_id: tableId,
      p_idempotency_key: idempotencyKey
    }));

    // Compatibilidad transitoria: reintentar función base cuando falla capa idempotente.
    const missingIdempotentSplitFn = isFunctionUnavailableError(
      atomicError,
      'create_split_sales_complete_idempotent'
    );
    const retryBaseSplitFn = atomicError && missingIdempotentSplitFn;
    if (retryBaseSplitFn) {
      ({ data: atomicResult, error: atomicError } = await supabaseAdapter.createSplitSalesCompleteRpc({
        p_business_id: businessId,
        p_user_id: user.id,
        p_seller_name: sellerName,
        p_sub_accounts: subAccountsWithItems,
        p_order_id: orderId,
        p_table_id: tableId
      }));
    }
  } else {
    atomicError = { message: 'split combos bypass atomic rpc' };
  }

  if (atomicError && canQueueLocalOrderSales() && isConnectivityError(atomicError)) {
    return enqueueLocalSplitClose({
      businessId,
      orderId,
      tableId,
      subAccountsWithItems
    });
  }

  if (!atomicError && atomicResult?.[0]?.status === 'success') {
    const atomicSalesCount = Number(atomicResult[0].sales_count || 0);
    const atomicTotalSold = Number(atomicResult[0].total_sold || 0);
    if (!Number.isFinite(atomicTotalSold) || atomicTotalSold <= 0 || atomicSalesCount <= 0) {
      throw new Error('Cierre dividido inválido: la operación no generó ventas.');
    }

    // Best-effort: recuperar ids de ventas recién creadas para autoimpresión.
    let atomicSaleIds = [];
    try {
      const { data: recentSales } = await supabaseAdapter.getRecentSalesByBusinessAndUserSince({
        businessId,
        userId: user.id,
        start: operationStartedAt,
        limit: atomicSalesCount,
        selectSql: 'id'
      });

      atomicSaleIds = (recentSales || []).map((sale) => sale.id).filter(Boolean);
    } catch {
      // no-op
    }

    await enqueueOrderCloseOutbox({
      businessId,
      mutationType: 'order.close.split',
      mutationId: `${idempotencyKey}:atomic`,
      payload: {
        order_id: orderId,
        table_id: tableId,
        sales_count: atomicSalesCount,
        total_sold: atomicTotalSold,
        sale_ids: atomicSaleIds
      }
    });

    return { totalSold: atomicTotalSold, saleIds: atomicSaleIds };
  }

  // Fallback transitorio: mantener compatibilidad mientras la migración nueva se despliega.
  const isMissingAtomicFn = isFunctionUnavailableError(
    atomicError,
    'create_split_sales_complete'
  );
  const shouldFallbackWithoutOrderContext = isOrderContextError(atomicError);
  const shouldFallbackDueToDuplicateIndex = isSalesDuplicateIndexError(atomicError);
  if (!isMissingAtomicFn && !shouldFallbackWithoutOrderContext && !shouldFallbackDueToDuplicateIndex) {
    throw new Error(getFriendlySaleErrorMessage(
      atomicError,
      '❌ No se pudo cerrar la orden dividida. Intenta de nuevo.'
    ));
  }

  let totalSold = 0;
  const saleIds = [];
  for (let i = 0; i < subAccountsWithItems.length; i++) {
    const sub = subAccountsWithItems[i];
    if (!sub.items || sub.items.length === 0) continue;

    const saleTotal = sub.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    totalSold += saleTotal;

    const itemsForRpc = sub.items.map(item => ({
      product_id: item.product_id || null,
      combo_id: item.combo_id || null,
      quantity: item.quantity,
      unit_price: item.unit_price
    }));

    const isLastSale = i === subAccountsWithItems.length - 1;
    const closeOrderInsideRpc = isLastSale && !shouldFallbackWithoutOrderContext;
    const subKey = `${idempotencyKey}:sub:${i + 1}`;
    const subIdempotentBaseParams = {
      p_business_id: businessId,
      p_user_id: user.id,
      p_seller_name: sellerName,
      p_payment_method: sub.paymentMethod || 'cash',
      p_items: itemsForRpc,
      p_order_id: closeOrderInsideRpc ? orderId : null,
      p_table_id: closeOrderInsideRpc ? tableId : null,
      p_idempotency_key: subKey
    };
    const subBaseParams = {
      p_business_id: businessId,
      p_user_id: user.id,
      p_seller_name: sellerName,
      p_payment_method: sub.paymentMethod || 'cash',
      p_items: itemsForRpc,
      p_order_id: closeOrderInsideRpc ? orderId : null,
      p_table_id: closeOrderInsideRpc ? tableId : null,
      p_amount_received: Number.isFinite(Number(sub.amountReceived ?? sub.amount_received))
        ? Number(sub.amountReceived ?? sub.amount_received)
        : null,
      p_change_breakdown: Array.isArray(sub.changeBreakdown)
        ? sub.changeBreakdown
        : (Array.isArray(sub.change_breakdown) ? sub.change_breakdown : [])
    };
    const preferBaseForSubSale = itemsForRpc.some((item) => Boolean(item?.combo_id));
    const { result, rpcError } = await callCreateSaleCompleteWithFallback({
      preferBase: preferBaseForSubSale,
      baseParams: subBaseParams,
      idempotentParams: subIdempotentBaseParams
    });

    if (rpcError || !result?.[0]) {
      throw new Error(getFriendlySaleErrorMessage(
        rpcError,
        `❌ No se pudo registrar la venta ${i + 1}. Intenta de nuevo.`
      ));
    }

    const createdSaleId = result[0].sale_id || null;
    if (createdSaleId) saleIds.push(createdSaleId);

    await persistSaleCashMetadata({
      businessId,
      saleId: createdSaleId,
      paymentMethod: sub.paymentMethod || 'cash',
      saleTotal,
      amountReceived: sub.amountReceived ?? sub.amount_received ?? null,
      changeBreakdown: sub.changeBreakdown ?? sub.change_breakdown ?? []
    });
  }

  if (shouldFallbackWithoutOrderContext) {
    await finalizeOrderAndTable({ businessId, orderId, tableId });
  }

  if (!Number.isFinite(totalSold) || totalSold <= 0) {
    throw new Error('No se pudieron generar ventas en el cierre dividido.');
  }

  await enqueueOrderCloseOutbox({
    businessId,
    mutationType: 'order.close.split',
    mutationId: `${idempotencyKey}:fallback`,
    payload: {
      order_id: orderId,
      table_id: tableId,
      sales_count: saleIds.length,
      total_sold: totalSold,
      sale_ids: saleIds
    }
  });

  return { totalSold, saleIds };
}

/**
 * Cierra la orden en una sola venta, descuenta stock y libera la mesa.
 * OPTIMIZADO: Usa RPC create_sale_complete en una sola transacción.
 * @param {string} businessId
 * @param {{ orderId: string, tableId: string, paymentMethod: string, amountReceived?: number|null, changeBreakdown?: Array<{denomination:number,count:number}>|null, orderItems?: Array<object>|null }} params
 * @returns {Promise<{ saleTotal: number, saleId: string | null }>}
 */
export async function closeOrderSingle(
  businessId,
  {
    orderId,
    tableId,
    paymentMethod,
    amountReceived = null,
    changeBreakdown = null,
    orderItems = null
  }
) {
  const offlineMode = typeof navigator !== 'undefined' && navigator.onLine === false;
  if (offlineMode && !canQueueLocalOrderSales()) {
    throw new Error(buildOfflineCloseUnavailableMessage());
  }

  const idempotencyKey = buildIdempotencyKey({
    action: 'close-order-single',
    businessId,
    orderId,
    tableId
  });
  const normalizedAmountReceived = Number.isFinite(Number(amountReceived))
    ? Number(amountReceived)
    : null;
  const normalizedChangeBreakdown = Array.isArray(changeBreakdown)
    ? changeBreakdown
    : null;

  let itemsForRpc = [];
  if (Array.isArray(orderItems) && orderItems.length > 0) {
    itemsForRpc = normalizeOrderItemsForSale(orderItems);
  } else {
    if (offlineMode) {
      throw new Error('Sin internet: no se pudieron recuperar los productos de la orden para cerrar la mesa.');
    }
    try {
      const { data: orderData, error: orderFetchError } = await supabaseAdapter.getOrderWithItemsById(
        orderId,
        'product_id, combo_id, quantity, price'
      );

      if (orderFetchError || !orderData) throw new Error('❌ No se pudo cargar la orden.');
      itemsForRpc = normalizeOrderItemsForSale(orderData.order_items || []);
    } catch (error) {
      if (isConnectivityError(error)) {
        throw new Error('Sin internet: no se pudieron recuperar los productos de la orden para cerrar la mesa.');
      }
      throw error;
    }
  }

  if (itemsForRpc.length === 0) {
    throw new Error('❌ No hay productos en la orden para cerrar.');
  }

  const saleTotal = itemsForRpc.reduce(
    (sum, item) => sum + (Number(item.quantity || 0) * Number(item.unit_price || 0)),
    0
  );

  if (shouldForceOrderSalesLocalFirst()) {
    return enqueueLocalSingleClose({
      businessId,
      orderId,
      tableId,
      paymentMethod,
      amountReceived: normalizedAmountReceived,
      changeBreakdown: normalizedChangeBreakdown ?? [],
      itemsForRpc
    });
  }

  if (offlineMode && canQueueLocalOrderSales()) {
    return enqueueLocalSingleClose({
      businessId,
      orderId,
      tableId,
      paymentMethod,
      amountReceived: normalizedAmountReceived,
      changeBreakdown: normalizedChangeBreakdown ?? [],
      itemsForRpc
    });
  }

  let user = null;
  let sellerName = 'Administrador';
  try {
    ({ user, sellerName } = await getSellerName(businessId));
  } catch (error) {
    if (isConnectivityError(error)) {
      if (canQueueLocalOrderSales()) {
        return enqueueLocalSingleClose({
          businessId,
          orderId,
          tableId,
          paymentMethod,
          amountReceived: normalizedAmountReceived,
          changeBreakdown: normalizedChangeBreakdown ?? [],
          itemsForRpc
        });
      }
      throw new Error(buildOfflineCloseUnavailableMessage());
    }
    throw error;
  }
  const idempotentBaseParams = {
    p_business_id: businessId,
    p_user_id: user.id,
    p_seller_name: sellerName,
    p_payment_method: paymentMethod || 'cash',
    p_items: itemsForRpc,
    p_order_id: orderId,
    p_table_id: tableId,
    p_idempotency_key: idempotencyKey
  };
  const baseParams = {
    p_business_id: businessId,
    p_user_id: user.id,
    p_seller_name: sellerName,
    p_payment_method: paymentMethod || 'cash',
    p_items: itemsForRpc,
    p_order_id: orderId,
    p_table_id: tableId,
    p_amount_received: normalizedAmountReceived,
    p_change_breakdown: normalizedChangeBreakdown ?? []
  };
  const preferBaseForSingleClose = itemsForRpc.some((item) => Boolean(item?.combo_id));

  const { result, rpcError } = await callCreateSaleCompleteWithFallback({
    preferBase: preferBaseForSingleClose,
    baseParams,
    idempotentParams: idempotentBaseParams
  });

  let resolvedSaleId = result?.[0]?.sale_id || null;
  if (rpcError || !result?.[0]) {
    if (canQueueLocalOrderSales() && isConnectivityError(rpcError)) {
      return enqueueLocalSingleClose({
        businessId,
        orderId,
        tableId,
        paymentMethod,
        amountReceived: normalizedAmountReceived,
        changeBreakdown: normalizedChangeBreakdown ?? [],
        itemsForRpc
      });
    }

    if (!isOrderContextError(rpcError)) {
      throw new Error(getFriendlySaleErrorMessage(
        rpcError,
        '❌ No se pudo registrar la venta. Intenta de nuevo.'
      ));
    }

    const fallbackKey = `${idempotencyKey}:no-order-context`;
    let fallbackResult = null;
    let fallbackError = null;

    const fallbackIdempotentBaseParams = {
      ...idempotentBaseParams,
      p_order_id: null,
      p_table_id: null,
      p_idempotency_key: fallbackKey
    };
    const fallbackBaseParams = { ...baseParams, p_order_id: null, p_table_id: null };
    ({ result: fallbackResult, rpcError: fallbackError } = await callCreateSaleCompleteWithFallback({
      preferBase: preferBaseForSingleClose,
      baseParams: fallbackBaseParams,
      idempotentParams: fallbackIdempotentBaseParams
    }));

    if (fallbackError || !fallbackResult?.[0]) {
      if (canQueueLocalOrderSales() && isConnectivityError(fallbackError)) {
        return enqueueLocalSingleClose({
          businessId,
          orderId,
          tableId,
          paymentMethod,
          amountReceived: normalizedAmountReceived,
          changeBreakdown: normalizedChangeBreakdown ?? [],
          itemsForRpc
        });
      }

      throw new Error(getFriendlySaleErrorMessage(
        fallbackError,
        '❌ No se pudo registrar la venta. Intenta de nuevo.'
      ));
    }

    resolvedSaleId = fallbackResult?.[0]?.sale_id || resolvedSaleId;
    await finalizeOrderAndTable({ businessId, orderId, tableId });
  }

  await persistSaleCashMetadata({
    businessId,
    saleId: resolvedSaleId,
    paymentMethod: paymentMethod || 'cash',
    saleTotal,
    amountReceived: normalizedAmountReceived,
    changeBreakdown: normalizedChangeBreakdown
  });

  await enqueueOrderCloseOutbox({
    businessId,
    mutationType: 'order.close.single',
    mutationId: idempotencyKey,
    payload: {
      order_id: orderId,
      table_id: tableId,
      sale_id: resolvedSaleId,
      total_sold: saleTotal,
      payment_method: paymentMethod || 'cash',
      amount_received: normalizedAmountReceived
    }
  });

  return { saleTotal, saleId: resolvedSaleId };
}
