import { supabase } from '../../../supabase/Client';

export const syncAdapter = {
  async getSaleSyncStateById({ saleId, businessId }) {
    return supabase
      .from('sales')
      .select('id, business_id, total, payment_method')
      .eq('id', saleId)
      .eq('business_id', businessId)
      .maybeSingle();
  },

  async getSalesSyncStateByIds({ saleIds = [], businessId }) {
    return supabase
      .from('sales')
      .select('id, business_id')
      .eq('business_id', businessId)
      .in('id', saleIds);
  },

  async getPurchaseSyncStateById({ purchaseId, businessId }) {
    return supabase
      .from('purchases')
      .select('id, business_id, total, payment_method')
      .eq('id', purchaseId)
      .eq('business_id', businessId)
      .maybeSingle();
  },

  async getSupplierSyncStateById({ supplierId, businessId }) {
    return supabase
      .from('suppliers')
      .select('id, business_id, business_name')
      .eq('id', supplierId)
      .eq('business_id', businessId)
      .maybeSingle();
  },

  async getOrderSyncStateById({ orderId, businessId }) {
    return supabase
      .from('orders')
      .select('id, business_id, table_id, status, total')
      .eq('id', orderId)
      .eq('business_id', businessId)
      .maybeSingle();
  },

  async getTableSyncStateById({ tableId, businessId }) {
    return supabase
      .from('tables')
      .select('id, business_id, table_number, status, current_order_id')
      .eq('id', tableId)
      .eq('business_id', businessId)
      .maybeSingle();
  },

  async getOrderItemSyncStateById(itemId) {
    return supabase
      .from('order_items')
      .select('id, order_id, quantity')
      .eq('id', itemId)
      .maybeSingle();
  },

  async getOrderItemsSyncStateByIds(itemIds = []) {
    return supabase
      .from('order_items')
      .select('id, order_id, quantity')
      .in('id', itemIds);
  },

  async getProductSyncStateById({ productId, businessId }) {
    return supabase
      .from('products')
      .select('id, business_id, is_active')
      .eq('id', productId)
      .eq('business_id', businessId)
      .maybeSingle();
  },

  async getInvoiceSyncStateById({ invoiceId, businessId }) {
    return supabase
      .from('invoices')
      .select('id, business_id, status')
      .eq('id', invoiceId)
      .eq('business_id', businessId)
      .maybeSingle();
  },

  async getLatestShapeCursor({
    table,
    businessId,
    cursorColumn = 'updated_at'
  }) {
    const normalizedTable = String(table || '').trim();
    const normalizedBusinessId = String(businessId || '').trim();
    const normalizedCursorColumn = String(cursorColumn || 'updated_at').trim() || 'updated_at';

    if (!normalizedTable || !normalizedBusinessId) {
      return {
        data: null,
        error: new Error('missing_table_or_business_id')
      };
    }

    return supabase
      .from(normalizedTable)
      .select(`id, ${normalizedCursorColumn}`)
      .eq('business_id', normalizedBusinessId)
      .not(normalizedCursorColumn, 'is', null)
      .order(normalizedCursorColumn, { ascending: false })
      .limit(1)
      .maybeSingle();
  },

  async getShapeRowsSinceCursor({
    table,
    businessId,
    cursorColumn = 'updated_at',
    cursorValue = null,
    limit = 200,
    selectSql = '*'
  }) {
    const normalizedTable = String(table || '').trim();
    const normalizedBusinessId = String(businessId || '').trim();
    const normalizedCursorColumn = String(cursorColumn || 'updated_at').trim() || 'updated_at';
    const normalizedLimit = Number.isFinite(Number(limit)) ? Math.max(1, Number(limit)) : 200;

    if (!normalizedTable || !normalizedBusinessId) {
      return {
        data: [],
        error: new Error('missing_table_or_business_id')
      };
    }

    let query = supabase
      .from(normalizedTable)
      .select(selectSql)
      .eq('business_id', normalizedBusinessId)
      .order(normalizedCursorColumn, { ascending: true })
      .limit(normalizedLimit);

    if (cursorValue) {
      query = query.gt(normalizedCursorColumn, cursorValue);
    }

    return query;
  },
};
