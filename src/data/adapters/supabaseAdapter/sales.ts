import { supabase } from '../../../supabase/Client';

export const salesAdapter = {
  async getSaleDetails(saleId) {
    return supabase
      .from('sale_details')
      .select('quantity, unit_price, subtotal, product_id, combo_id, products(name, code), combos(nombre)')
      .eq('sale_id', saleId);
  },

  async getSalesByBusinessDateRange({ businessId, start, end, selectSql = 'total, payment_method' }) {
    return supabase
      .from('sales')
      .select(selectSql)
      .eq('business_id', businessId)
      .gte('created_at', start)
      .lte('created_at', end);
  },

  async getRecentSalesByBusiness({
    businessId,
    selectSql,
    limit = 50
  }) {
    return supabase
      .from('sales')
      .select(selectSql)
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(limit);
  },

  async getRecentSalesByBusinessSince({
    businessId,
    startIso,
    selectSql = 'id, total, created_at',
    limit = 3
  }) {
    return supabase
      .from('sales')
      .select(selectSql)
      .eq('business_id', businessId)
      .gte('created_at', startIso)
      .order('created_at', { ascending: false })
      .limit(limit);
  },

  async getSalesEnrichedRpc(payload) {
    return supabase.rpc('get_sales_enriched', payload);
  },

  async createSaleCompleteRpc(payload) {
    return supabase.rpc('create_sale_complete', payload);
  },

  async createSaleCompleteIdempotentRpc(payload) {
    return supabase.rpc('create_sale_complete_idempotent', payload);
  },

  async createSplitSalesCompleteRpc(payload) {
    return supabase.rpc('create_split_sales_complete', payload);
  },

  async createSplitSalesCompleteIdempotentRpc(payload) {
    return supabase.rpc('create_split_sales_complete_idempotent', payload);
  },

  async getFilteredSalesLegacy({
    businessId,
    fromDateIso = null,
    toDateIso = null,
    paymentMethod = null,
    employeeId = null,
    customerId = null,
    minAmount = null,
    maxAmount = null,
    limit = 50,
    offset = 0,
    includeCount = true,
    countMode = 'planned',
    selectSql
  }) {
    let query = includeCount
      ? supabase.from('sales').select(selectSql, { count: countMode })
      : supabase.from('sales').select(selectSql);

    query = query.eq('business_id', businessId).order('created_at', { ascending: false });

    if (fromDateIso) query = query.gte('created_at', fromDateIso);
    if (toDateIso) query = query.lte('created_at', toDateIso);
    if (paymentMethod) query = query.eq('payment_method', paymentMethod);
    if (employeeId) query = query.eq('user_id', employeeId);
    if (customerId) query = query.eq('customer_id', customerId);
    if (minAmount) query = query.gte('total', minAmount);
    if (maxAmount) query = query.lte('total', maxAmount);

    query = query.range(offset, offset + limit - 1);
    return query;
  },

  async getSaleDetailsWithProductCostByBusinessDateRange({ businessId, start, end }) {
    return supabase
      .from('sale_details')
      .select(`
        quantity,
        unit_price,
        products!inner(name, purchase_price),
        sales!inner(business_id, created_at)
      `)
      .eq('sales.business_id', businessId)
      .gte('sales.created_at', start)
      .lte('sales.created_at', end);
  },

  async getComboSaleDetailsByBusinessDateRange({ businessId, start, end }) {
    return supabase
      .from('sale_details')
      .select(`
        quantity,
        combo_id,
        combos (
          id,
          combo_items (
            producto_id,
            cantidad,
            products (
              id,
              purchase_price
            )
          )
        ),
        sales!inner(business_id, created_at)
      `)
      .eq('sales.business_id', businessId)
      .not('combo_id', 'is', null)
      .gte('sales.created_at', start)
      .lte('sales.created_at', end);
  },

  async getSaleCashMetadata(saleId) {
    return supabase
      .from('sales')
      .select('amount_received, change_amount, change_breakdown')
      .eq('id', saleId)
      .maybeSingle();
  },

  async updateSaleCashMetadataByBusinessAndId({ businessId, saleId, payload }) {
    return supabase
      .from('sales')
      .update(payload)
      .eq('id', saleId)
      .eq('business_id', businessId);
  },

  async getSaleForPrint(saleId) {
    return supabase
      .from('sales')
      .select('id, total, payment_method, created_at, seller_name')
      .eq('id', saleId)
      .maybeSingle();
  },

  async insertSale(row) {
    return supabase
      .from('sales')
      .insert([row])
      .select()
      .single();
  },

  async insertSaleDetails(rows) {
    return supabase
      .from('sale_details')
      .insert(rows);
  },

  async getSaleDetailsBySaleIdWithSelect(saleId, selectSql) {
    return supabase
      .from('sale_details')
      .select(selectSql)
      .eq('sale_id', saleId);
  },

  async deleteSaleDetails(saleId) {
    return supabase
      .from('sale_details')
      .delete()
      .eq('sale_id', saleId);
  },

  async deleteSaleById(saleId) {
    return supabase
      .from('sales')
      .delete()
      .eq('id', saleId);
  },

  async getSaleForPrintByBusinessAndId({ businessId, saleId }) {
    return supabase
      .from('sales')
      .select('id, total, payment_method, created_at, seller_name')
      .eq('id', saleId)
      .eq('business_id', businessId)
      .maybeSingle();
  },

  async getRecentSalesByBusinessAndUserSince({
    businessId,
    userId,
    start,
    limit = 20,
    selectSql = 'id'
  }) {
    return supabase
      .from('sales')
      .select(selectSql)
      .eq('business_id', businessId)
      .eq('user_id', userId)
      .gte('created_at', start)
      .order('created_at', { ascending: false })
      .limit(limit);
  },

  async getSaleDetailsForPrintBySaleId(saleId) {
    return supabase
      .from('sale_details')
      .select('quantity, unit_price, subtotal, product_id, combo_id, products(name, code), combos(nombre)')
      .eq('sale_id', saleId);
  },
};
