/**
 * Servicio de órdenes (mesas): cierre de orden con ventas y descuento de stock.
 * Centraliza la lógica que antes estaba en Mesas.jsx para facilitar tests y futura unificación con salesService.
 */

import { supabase } from '../supabase/Client.jsx';

async function getSellerName(businessId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No se pudo obtener información del usuario');

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
 * @param {string} businessId
 * @param {{ subAccounts: Array<{ name: string, paymentMethod: string, items: Array<{ product_id: string, quantity: number, price: number }> }>, orderId: string, tableId: string }} params
 * @returns {Promise<{ totalSold: number }>}
 */
export async function closeOrderAsSplit(businessId, { subAccounts, orderId, tableId }) {
  const { user, sellerName } = await getSellerName(businessId);

  let totalSold = 0;
  const createdSaleIds = [];

  for (const sub of subAccounts) {
    if (!sub.items || sub.items.length === 0) continue;

    const saleTotal = sub.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    totalSold += saleTotal;

    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert([{
        business_id: businessId,
        user_id: user.id,
        total: saleTotal,
        payment_method: sub.paymentMethod || 'cash',
        seller_name: sellerName
      }])
      .select()
      .maybeSingle();

    if (saleError) throw new Error('No se pudo registrar la venta. Intenta de nuevo.');
    if (!sale?.id) throw new Error('No se pudo registrar la venta. Intenta de nuevo.');
    createdSaleIds.push(sale.id);

    const saleDetails = sub.items.map(item => ({
      sale_id: sale.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.price
    }));

    const { error: detailsError } = await supabase
      .from('sale_details')
      .insert(saleDetails);

    if (detailsError) {
      for (const sid of createdSaleIds) await supabase.from('sales').delete().eq('id', sid);
      throw new Error('No se pudo registrar los detalles de la venta. Intenta de nuevo.');
    }
  }

  const productUpdatesMap = new Map();
  for (const sub of subAccounts) {
    if (!sub.items?.length) continue;
    for (const item of sub.items) {
      const qty = Number(item.quantity) || 0;
      if (!item.product_id || qty <= 0) continue;
      productUpdatesMap.set(
        item.product_id,
        (productUpdatesMap.get(item.product_id) || 0) + qty
      );
    }
  }
  const productUpdates = [...productUpdatesMap.entries()].map(([product_id, quantity]) => ({
    product_id,
    quantity
  }));
  if (productUpdates.length > 0) {
    const { error: stockError } = await supabase.rpc('update_stock_batch', {
      product_updates: productUpdates
    });
    if (stockError) {
      for (const sid of createdSaleIds) await supabase.from('sales').delete().eq('id', sid);
      throw new Error('No se pudo actualizar el inventario. No se registró la venta.');
    }
  }

  const { error: orderError } = await supabase
    .from('orders')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', orderId);

  if (orderError) throw new Error('No se pudo cerrar la orden.');

  await supabase
    .from('tables')
    .update({ current_order_id: null, status: 'available' })
    .eq('id', tableId);

  return { totalSold };
}

/**
 * Cierra la orden en una sola venta, descuenta stock y libera la mesa.
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

  if (orderFetchError || !orderData) throw new Error('No se pudo cargar la orden.');
  if (!orderData.order_items?.length) throw new Error('No hay productos en la orden para cerrar.');

  const saleTotal = orderData.order_items.reduce((sum, item) => sum + (item.quantity * item.price), 0);

  const { data: sale, error: saleError } = await supabase
    .from('sales')
    .insert([{
      business_id: businessId,
      user_id: user.id,
      total: saleTotal,
      payment_method: paymentMethod || 'cash',
      seller_name: sellerName
    }])
    .select()
    .maybeSingle();

  if (saleError) throw new Error('No se pudo registrar la venta. Intenta de nuevo.');
  if (!sale?.id) throw new Error('No se pudo registrar la venta. Intenta de nuevo.');

  const saleDetails = orderData.order_items.map(item => ({
    sale_id: sale.id,
    product_id: item.product_id,
    quantity: item.quantity,
    unit_price: item.price
  }));

  const { error: detailsError } = await supabase
    .from('sale_details')
    .insert(saleDetails);

  if (detailsError) {
    await supabase.from('sales').delete().eq('id', sale.id);
    throw new Error('No se pudo registrar los detalles de la venta. Intenta de nuevo.');
  }

  const productUpdates = orderData.order_items.map(item => ({
    product_id: item.product_id,
    quantity: Number(item.quantity) || 0
  })).filter(p => p.quantity > 0);
  if (productUpdates.length > 0) {
    const { error: stockError } = await supabase.rpc('update_stock_batch', {
      product_updates: productUpdates
    });
    if (stockError) {
      await supabase.from('sales').delete().eq('id', sale.id);
      throw new Error('No se pudo actualizar el inventario. No se registró la venta.');
    }
  }

  const { error: orderUpdateError } = await supabase
    .from('orders')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', orderId);

  if (orderUpdateError) throw new Error('No se pudo cerrar la orden.');

  await supabase
    .from('tables')
    .update({ current_order_id: null, status: 'available' })
    .eq('id', tableId);

  return { saleTotal };
}
