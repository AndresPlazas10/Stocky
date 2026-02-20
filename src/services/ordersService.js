/**
 * Servicio de órdenes (mesas): cierre de orden con ventas y descuento de stock.
 * Centraliza la lógica que antes estaba en Mesas.jsx para facilitar tests y futura unificación con salesService.
 */

import { supabase } from '../supabase/Client.jsx';
import { isAdminRole } from '../utils/roles.js';

function buildIdempotencyKey({ action, businessId, orderId, tableId }) {
  const normalizedAction = String(action || '').trim().toLowerCase();
  const b = String(businessId || '').trim();
  const o = String(orderId || '').trim();
  const t = String(tableId || '').trim();
  return `stocky:${normalizedAction}:${b}:${o}:${t}`;
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
    ({ data: result, error: rpcError } = await supabase.rpc('create_sale_complete', baseParams));
    const missingBaseFn = isFunctionUnavailableError(rpcError, 'create_sale_complete');
    if (rpcError && missingBaseFn) {
      ({ data: result, error: rpcError } = await supabase.rpc('create_sale_complete_idempotent', idempotentParams));
    }
    return { result, rpcError };
  }

  ({ data: result, error: rpcError } = await supabase.rpc('create_sale_complete_idempotent', idempotentParams));
  const missingIdempotentFn = isFunctionUnavailableError(rpcError, 'create_sale_complete_idempotent');
  if (rpcError && missingIdempotentFn) {
    ({ data: result, error: rpcError } = await supabase.rpc('create_sale_complete', baseParams));
  }

  return { result, rpcError };
}

function getFriendlySaleErrorMessage(errorLike, fallbackMessage) {
  const rawMessage = String(errorLike?.message || errorLike || '').trim();
  const normalized = rawMessage.toLowerCase();

  if (normalized.includes('idx_sales_prevent_duplicates')) {
    return 'La venta ya estaba siendo procesada o ya fue registrada. Actualiza y verifica en Ventas.';
  }

  return rawMessage || fallbackMessage;
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

  const { error } = await supabase
    .from('sales')
    .update({
      amount_received: metadata.amountReceived,
      change_amount: metadata.changeAmount,
      change_breakdown: metadata.changeBreakdown
    })
    .eq('id', saleId)
    .eq('business_id', businessId);

  if (error) {
    // Best-effort: no bloquear cierre de orden por metadatos de efectivo.
  }
}

async function finalizeOrderAndTable({ businessId, orderId, tableId }) {
  if (orderId) {
    const { error: orderCloseError } = await supabase
      .from('orders')
      .update({ status: 'closed', closed_at: new Date().toISOString() })
      .eq('id', orderId)
      .eq('business_id', businessId);

    if (orderCloseError) {
      throw new Error(orderCloseError.message || '❌ No se pudo cerrar la orden.');
    }
  }

  if (tableId) {
    const { error: tableReleaseError } = await supabase
      .from('tables')
      .update({ current_order_id: null, status: 'available' })
      .eq('id', tableId)
      .eq('business_id', businessId);

    if (tableReleaseError) {
      throw new Error(tableReleaseError.message || '❌ No se pudo liberar la mesa.');
    }
  }
}

async function getSellerName(businessId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('❌ No se pudo obtener información del usuario');

  const [{ data: employee }, { data: business }] = await Promise.all([
    supabase
      .from('employees')
      .select('full_name, role')
      .eq('user_id', user.id)
      .eq('business_id', businessId)
      .maybeSingle(),
    supabase
      .from('businesses')
      .select('created_by')
      .eq('id', businessId)
      .maybeSingle()
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
  const { user, sellerName } = await getSellerName(businessId);
  const operationStartedAt = new Date().toISOString();
  const normalizedSubAccounts = normalizeSplitSubAccountsForRpc(subAccounts);
  const subAccountsWithItems = normalizedSubAccounts.filter((sub) => Array.isArray(sub.items) && sub.items.length > 0);
  if (subAccountsWithItems.length === 0) {
    throw new Error('No hay subcuentas con productos válidos para procesar.');
  }
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
    ({ data: atomicResult, error: atomicError } = await supabase.rpc('create_split_sales_complete_idempotent', {
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
      ({ data: atomicResult, error: atomicError } = await supabase.rpc('create_split_sales_complete', {
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

  if (!atomicError && atomicResult?.[0]?.status === 'success') {
    const atomicSalesCount = Number(atomicResult[0].sales_count || 0);
    const atomicTotalSold = Number(atomicResult[0].total_sold || 0);
    if (!Number.isFinite(atomicTotalSold) || atomicTotalSold <= 0 || atomicSalesCount <= 0) {
      throw new Error('Cierre dividido inválido: la operación no generó ventas.');
    }

    // Best-effort: recuperar ids de ventas recién creadas para autoimpresión.
    let atomicSaleIds = [];
    try {
      const { data: recentSales } = await supabase
        .from('sales')
        .select('id')
        .eq('business_id', businessId)
        .eq('user_id', user.id)
        .gte('created_at', operationStartedAt)
        .order('created_at', { ascending: false })
        .limit(atomicSalesCount);

      atomicSaleIds = (recentSales || []).map((sale) => sale.id).filter(Boolean);
    } catch {
      // no-op
    }

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

  return { totalSold, saleIds };
}

/**
 * Cierra la orden en una sola venta, descuenta stock y libera la mesa.
 * OPTIMIZADO: Usa RPC create_sale_complete en una sola transacción.
 * @param {string} businessId
 * @param {{ orderId: string, tableId: string, paymentMethod: string, amountReceived?: number|null, changeBreakdown?: Array<{denomination:number,count:number}>|null }} params
 * @returns {Promise<{ saleTotal: number, saleId: string | null }>}
 */
export async function closeOrderSingle(businessId, { orderId, tableId, paymentMethod, amountReceived = null, changeBreakdown = null }) {
  const { user, sellerName } = await getSellerName(businessId);
  const idempotencyKey = buildIdempotencyKey({
    action: 'close-order-single',
    businessId,
    orderId,
    tableId
  });

  const { data: orderData, error: orderFetchError } = await supabase
    .from('orders')
    .select(`
      *,
      order_items (
        product_id,
        combo_id,
        quantity,
        price
      )
    `)
    .eq('id', orderId)
    .maybeSingle();

  if (orderFetchError || !orderData) throw new Error('❌ No se pudo cargar la orden.');
  if (!orderData.order_items?.length) throw new Error('❌ No hay productos en la orden para cerrar.');

  const saleTotal = orderData.order_items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
  
  // Preparar items para RPC
  const itemsForRpc = orderData.order_items.map((item) => {
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
  const normalizedAmountReceived = Number.isFinite(Number(amountReceived))
    ? Number(amountReceived)
    : null;
  const normalizedChangeBreakdown = Array.isArray(changeBreakdown)
    ? changeBreakdown
    : null;
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

  return { saleTotal, saleId: resolvedSaleId };
}
