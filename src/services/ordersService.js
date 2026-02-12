/**
 * Servicio de órdenes (mesas): cierre de orden con ventas y descuento de stock.
 * Centraliza la lógica que antes estaba en Mesas.jsx para facilitar tests y futura unificación con salesService.
 */

import { supabase } from '../supabase/Client.jsx';

async function getSellerName(businessId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('❌ No se pudo obtener información del usuario');

  const { data: employee } = await supabase
    .from('employees')
    .select('full_name, role')
    .eq('user_id', user.id)
    .eq('business_id', businessId)
    .maybeSingle();

  const sellerName = employee && (employee.role === 'owner' || employee.role === 'admin')
    ? 'Administrador'
    : (employee?.full_name || 'Empleado');

  return { user, sellerName };
}

/**
 * Cierra la orden dividida en varias ventas, descuenta stock y libera la mesa.
 * OPTIMIZADO: Usa RPC create_sale_complete para cada venta en transacciones separadas.
 * @param {string} businessId
 * @param {{ subAccounts: Array<{ name: string, paymentMethod: string, items: Array<{ product_id: string, quantity: number, price: number }> }>, orderId: string, tableId: string }} params
 * @returns {Promise<{ totalSold: number }>}
 */
export async function closeOrderAsSplit(businessId, { subAccounts, orderId, tableId }) {
  const { user, sellerName } = await getSellerName(businessId);

  let totalSold = 0;

  // Procesar cada subcuenta como una venta separada (usando RPC)
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

    // Usar RPC para crear cada venta
    // NOTA: Solo liberamos mesa en la ÚLTIMA venta
    const isLastSale = i === subAccounts.length - 1;

    const { data: result, error: rpcError } = await supabase.rpc('create_sale_complete', {
      p_business_id: businessId,
      p_user_id: user.id,
      p_seller_name: sellerName,
      p_payment_method: sub.paymentMethod || 'cash',
      p_items: itemsForRpc,
      p_order_id: isLastSale ? orderId : null,
      p_table_id: isLastSale ? tableId : null
    });

    if (rpcError || !result?.[0]) {
      throw new Error(rpcError?.message || `❌ No se pudo registrar la venta ${i + 1}. Intenta de nuevo.`);
    }
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

  const { data: orderData, error: orderFetchError } = await supabase
    .from('orders')
    .select(`
      *,
      order_items (
        *,
        products (id, name)
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

  // Llamar RPC optimizada CON cierre de orden y liberación de mesa
  const { data: result, error: rpcError } = await supabase.rpc('create_sale_complete', {
    p_business_id: businessId,
    p_user_id: user.id,
    p_seller_name: sellerName,
    p_payment_method: paymentMethod || 'cash',
    p_items: itemsForRpc,
    p_order_id: orderId,
    p_table_id: tableId
  });

  if (rpcError || !result?.[0]) {
    throw new Error(rpcError?.message || '❌ No se pudo registrar la venta. Intenta de nuevo.');
  }

  return { saleTotal };
}
