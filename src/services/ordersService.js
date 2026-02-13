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

function isIdempotencyLayerError(errorLike) {
  const message = String(errorLike?.message || errorLike || '').toLowerCase();
  if (!message) return false;

  return (
    message.includes('idempotency')
  ) || (
    message.includes('idempotency_requests')
  ) || (
    message.includes('permission denied')
  ) || (
    message.includes('row-level security')
  ) || (
    message.includes('violates row-level security')
  ) || (
    message.includes('conflicto de idempotencia')
  ) || (
    message.includes('processing for this idempotent key')
  );
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
 * @returns {Promise<{ totalSold: number }>}
 */
export async function closeOrderAsSplit(businessId, { subAccounts, orderId, tableId }) {
  const { user, sellerName } = await getSellerName(businessId);
  const idempotencyKey = buildIdempotencyKey({
    action: 'close-order-split',
    businessId,
    orderId,
    tableId
  });

  // Camino principal: cierre atómico de todas las subcuentas en 1 transacción.
  let atomicResult = null;
  let atomicError = null;
  ({ data: atomicResult, error: atomicError } = await supabase.rpc('create_split_sales_complete_idempotent', {
    p_business_id: businessId,
    p_user_id: user.id,
    p_seller_name: sellerName,
    p_sub_accounts: subAccounts,
    p_order_id: orderId,
    p_table_id: tableId,
    p_idempotency_key: idempotencyKey
  }));

  // Compatibilidad transitoria: reintentar función base cuando falla capa idempotente.
  const missingIdempotentSplitFn = isFunctionUnavailableError(
    atomicError,
    'create_split_sales_complete_idempotent'
  );
  const retryBaseSplitFn = atomicError && (missingIdempotentSplitFn || isIdempotencyLayerError(atomicError));
  if (retryBaseSplitFn) {
    ({ data: atomicResult, error: atomicError } = await supabase.rpc('create_split_sales_complete', {
      p_business_id: businessId,
      p_user_id: user.id,
      p_seller_name: sellerName,
      p_sub_accounts: subAccounts,
      p_order_id: orderId,
      p_table_id: tableId
    }));
  }

  if (!atomicError && atomicResult?.[0]?.status === 'success') {
    return { totalSold: Number(atomicResult[0].total_sold || 0) };
  }

  // Fallback transitorio: mantener compatibilidad mientras la migración nueva se despliega.
  const isMissingAtomicFn = isFunctionUnavailableError(
    atomicError,
    'create_split_sales_complete'
  );
  const shouldFallbackWithoutOrderContext = isOrderContextError(atomicError);
  if (!isMissingAtomicFn && !shouldFallbackWithoutOrderContext) {
    throw new Error(atomicError?.message || '❌ No se pudo cerrar la orden dividida. Intenta de nuevo.');
  }

  let totalSold = 0;
  for (let i = 0; i < subAccounts.length; i++) {
    const sub = subAccounts[i];
    if (!sub.items || sub.items.length === 0) continue;

    const saleTotal = sub.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    totalSold += saleTotal;

    const itemsForRpc = sub.items.map(item => ({
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.price
    }));

    const isLastSale = i === subAccounts.length - 1;
    const closeOrderInsideRpc = isLastSale && !shouldFallbackWithoutOrderContext;
    const subKey = `${idempotencyKey}:sub:${i + 1}`;
    let result = null;
    let rpcError = null;
    ({ data: result, error: rpcError } = await supabase.rpc('create_sale_complete_idempotent', {
      p_business_id: businessId,
      p_user_id: user.id,
      p_seller_name: sellerName,
      p_payment_method: sub.paymentMethod || 'cash',
      p_items: itemsForRpc,
      p_order_id: closeOrderInsideRpc ? orderId : null,
      p_table_id: closeOrderInsideRpc ? tableId : null,
      p_idempotency_key: subKey
    }));

    const missingIdempotentSaleFn = isFunctionUnavailableError(
      rpcError,
      'create_sale_complete_idempotent'
    );
    const retryBaseSaleFn = rpcError && (missingIdempotentSaleFn || isIdempotencyLayerError(rpcError));
    if (retryBaseSaleFn) {
      ({ data: result, error: rpcError } = await supabase.rpc('create_sale_complete', {
        p_business_id: businessId,
        p_user_id: user.id,
        p_seller_name: sellerName,
        p_payment_method: sub.paymentMethod || 'cash',
        p_items: itemsForRpc,
        p_order_id: closeOrderInsideRpc ? orderId : null,
        p_table_id: closeOrderInsideRpc ? tableId : null
      }));
    }

    if (rpcError || !result?.[0]) {
      throw new Error(rpcError?.message || `❌ No se pudo registrar la venta ${i + 1}. Intenta de nuevo.`);
    }
  }

  if (shouldFallbackWithoutOrderContext) {
    await finalizeOrderAndTable({ businessId, orderId, tableId });
  }

  return { totalSold };
}

/**
 * Cierra la orden en una sola venta, descuenta stock y libera la mesa.
 * OPTIMIZADO: Usa RPC create_sale_complete en una sola transacción.
 * @param {string} businessId
 * @param {{ orderId: string, tableId: string, paymentMethod: string }} params
 * @returns {Promise<{ saleTotal: number }>}
 */
export async function closeOrderSingle(businessId, { orderId, tableId, paymentMethod }) {
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
  const itemsForRpc = orderData.order_items.map(item => ({
    product_id: item.product_id,
    quantity: item.quantity,
    unit_price: item.price
  }));

  // Llamar wrapper idempotente (con fallback a función base).
  let result = null;
  let rpcError = null;
  ({ data: result, error: rpcError } = await supabase.rpc('create_sale_complete_idempotent', {
    p_business_id: businessId,
    p_user_id: user.id,
    p_seller_name: sellerName,
    p_payment_method: paymentMethod || 'cash',
    p_items: itemsForRpc,
    p_order_id: orderId,
    p_table_id: tableId,
    p_idempotency_key: idempotencyKey
  }));

  const missingIdempotentSaleFn = isFunctionUnavailableError(
    rpcError,
    'create_sale_complete_idempotent'
  );
  const retryBaseSaleFn = rpcError && (missingIdempotentSaleFn || isIdempotencyLayerError(rpcError));
  if (retryBaseSaleFn) {
    ({ data: result, error: rpcError } = await supabase.rpc('create_sale_complete', {
      p_business_id: businessId,
      p_user_id: user.id,
      p_seller_name: sellerName,
      p_payment_method: paymentMethod || 'cash',
      p_items: itemsForRpc,
      p_order_id: orderId,
      p_table_id: tableId
    }));
  }

  if (rpcError || !result?.[0]) {
    if (!isOrderContextError(rpcError)) {
      throw new Error(rpcError?.message || '❌ No se pudo registrar la venta. Intenta de nuevo.');
    }

    const fallbackKey = `${idempotencyKey}:no-order-context`;
    let fallbackResult = null;
    let fallbackError = null;

    ({ data: fallbackResult, error: fallbackError } = await supabase.rpc('create_sale_complete_idempotent', {
      p_business_id: businessId,
      p_user_id: user.id,
      p_seller_name: sellerName,
      p_payment_method: paymentMethod || 'cash',
      p_items: itemsForRpc,
      p_order_id: null,
      p_table_id: null,
      p_idempotency_key: fallbackKey
    }));

    const missingFallbackIdempotentFn = isFunctionUnavailableError(
      fallbackError,
      'create_sale_complete_idempotent'
    );
    const retryBaseFallbackFn = fallbackError && (missingFallbackIdempotentFn || isIdempotencyLayerError(fallbackError));
    if (retryBaseFallbackFn) {
      ({ data: fallbackResult, error: fallbackError } = await supabase.rpc('create_sale_complete', {
        p_business_id: businessId,
        p_user_id: user.id,
        p_seller_name: sellerName,
        p_payment_method: paymentMethod || 'cash',
        p_items: itemsForRpc,
        p_order_id: null,
        p_table_id: null
      }));
    }

    if (fallbackError || !fallbackResult?.[0]) {
      throw new Error(fallbackError?.message || '❌ No se pudo registrar la venta. Intenta de nuevo.');
    }

    await finalizeOrderAndTable({ businessId, orderId, tableId });
  }

  return { saleTotal };
}
