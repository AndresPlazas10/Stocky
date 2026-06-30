import { supabase } from '../../../supabase/Client';
import { isMissingColumnError } from './shared.js';

export const ordersAdapter = {
  async getOpenOrdersByBusiness(businessId, selectSql = 'id, business_id, table_id, status, opened_at, updated_at') {
    return supabase
      .from('orders')
      .select(selectSql)
      .eq('business_id', businessId)
      .eq('status', 'open')
      .order('opened_at', { ascending: true });
  },

  async insertOrder(row) {
    const result = await supabase
      .from('orders')
      .insert([row])
      .select()
      .maybeSingle();

    if (!result?.error) return result;

    if (!Object.prototype.hasOwnProperty.call(row || {}, 'total')) {
      return result;
    }

    if (!isMissingColumnError(result.error, { tableName: 'orders', columnName: 'total' })) {
      return result;
    }

    const { total: _ignoredTotal, ...legacyRow } = row || {};
    return supabase
      .from('orders')
      .insert([legacyRow])
      .select()
      .maybeSingle();
  },

  async deleteOrderById(orderId) {
    return supabase
      .from('orders')
      .delete()
      .eq('id', orderId);
  },

  async deleteOrdersByTableId(tableId) {
    return supabase
      .from('orders')
      .delete()
      .eq('table_id', tableId);
  },

  async deleteOrdersByBusinessAndTableId({ businessId, tableId }) {
    return supabase
      .from('orders')
      .delete()
      .eq('table_id', tableId)
      .eq('business_id', businessId);
  },

  async deleteOrderItemsByOrderIds(orderIds = []) {
    const normalized = Array.isArray(orderIds)
      ? orderIds.map((id) => String(id || '').trim()).filter(Boolean)
      : [];

    if (normalized.length === 0) {
      return { data: [], error: null };
    }

    return supabase
      .from('order_items')
      .delete()
      .in('order_id', normalized);
  },

  async updateOrderById(orderId, payload) {
    return supabase
      .from('orders')
      .update(payload)
      .eq('id', orderId);
  },

  async updateOrderByBusinessAndId({ businessId, orderId, payload }) {
    return supabase
      .from('orders')
      .update(payload)
      .eq('id', orderId)
      .eq('business_id', businessId);
  },

  async getOrderItemsByOrderId(orderId, selectSql) {
    return supabase
      .from('order_items')
      .select(selectSql)
      .eq('order_id', orderId)
      .order('id', { ascending: true });
  },

  async getOrderWithItemsById(orderId, selectSql) {
    return supabase
      .from('orders')
      .select(`
          *,
          order_items!order_items_order_id_fkey (
            ${selectSql}
          )
        `)
      .eq('id', orderId)
      .order('id', { foreignTable: 'order_items', ascending: true })
      .maybeSingle();
  },

  async getOrderForRealtimeById(orderId, selectSql) {
    return supabase
      .from('orders')
      .select(`
          *,
          order_items!order_items_order_id_fkey (
            ${selectSql}
          )
        `)
      .eq('id', orderId)
      .order('id', { foreignTable: 'order_items', ascending: true })
      .single();
  },

  async deleteOrderItemById(itemId) {
    return supabase
      .from('order_items')
      .delete()
      .eq('id', itemId);
  },

  async updateOrderItemById(itemId, payload) {
    return supabase
      .from('order_items')
      .update(payload)
      .eq('id', itemId);
  },

  async getOrderItemById(itemId, selectSql) {
    return supabase
      .from('order_items')
      .select(selectSql)
      .eq('id', itemId)
      .maybeSingle();
  },

  async getOrderItemByOrderAndReference({
    orderId,
    productId = null,
    comboId = null,
    selectSql = 'id, order_id, product_id, combo_id, quantity, price'
  }) {
    let query = supabase
      .from('order_items')
      .select(selectSql)
      .eq('order_id', orderId);

    if (productId) {
      query = query.eq('product_id', productId).is('combo_id', null);
    } else if (comboId) {
      query = query.eq('combo_id', comboId).is('product_id', null);
    } else {
      return { data: null, error: null };
    }

    return query
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();
  },

  async insertOrderItem(row, selectSql = 'id') {
    return supabase
      .from('order_items')
      .insert([row])
      .select(selectSql)
      .maybeSingle();
  },

  async getOrdersByTableId({ tableId, businessId }) {
    return supabase
      .from('orders')
      .select('id, status')
      .eq('table_id', tableId)
      .eq('business_id', businessId);
  },

  async getOrderItemsByBusinessSinceCursor({
    businessId,
    cursorColumn = 'created_at',
    cursorValue = null,
    limit = 200
  }) {
    const normalizedBusinessId = String(businessId || '').trim();
    const normalizedCursorColumn = String(cursorColumn || 'created_at').trim() || 'created_at';
    const normalizedLimit = Number.isFinite(Number(limit)) ? Math.max(1, Number(limit)) : 200;

    if (!normalizedBusinessId) {
      return {
        data: [],
        error: new Error('missing_business_id')
      };
    }

    let query = supabase
      .from('order_items')
      .select(`
        id,
        order_id,
        product_id,
        combo_id,
        quantity,
        price,
        subtotal,
        created_at,
        updated_at,
        orders!inner(business_id)
      `)
      .eq('orders.business_id', normalizedBusinessId)
      .order(normalizedCursorColumn, { ascending: true })
      .limit(normalizedLimit);

    if (cursorValue) {
      query = query.gt(normalizedCursorColumn, cursorValue);
    }

    return query;
  },
};
