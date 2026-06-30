import { supabase } from '../../../supabase/Client';

export const purchasesAdapter = {
  async getRecentPurchasesByBusinessSince({
    businessId,
    startIso,
    selectSql = `
      id,
      total,
      created_at,
      supplier:suppliers(business_name, contact_name)
    `,
    limit = 3
  }) {
    return supabase
      .from('purchases')
      .select(selectSql)
      .eq('business_id', businessId)
      .gte('created_at', startIso)
      .order('created_at', { ascending: false })
      .limit(limit);
  },

  async getPurchasesByBusinessDateRange({ businessId, start, end, selectSql = 'total' }) {
    return supabase
      .from('purchases')
      .select(selectSql)
      .eq('business_id', businessId)
      .gte('created_at', start)
      .lte('created_at', end);
  },

  async getPurchasesEnrichedRpc(payload) {
    return supabase.rpc('get_purchases_enriched', payload);
  },

  async getFilteredPurchasesLegacy({
    businessId,
    fromDateIso = null,
    toDateIso = null,
    supplierId = null,
    userId = null,
    minAmount = null,
    maxAmount = null,
    limit = 50,
    offset = 0,
    includeCount = true,
    countMode = 'planned',
    selectSql = `
      id,
      business_id,
      user_id,
      supplier_id,
      payment_method,
      notes,
      total,
      created_at
    `
  }) {
    let query = includeCount
      ? supabase.from('purchases').select(selectSql, { count: countMode })
      : supabase.from('purchases').select(selectSql);

    query = query.eq('business_id', businessId).order('created_at', { ascending: false });

    if (fromDateIso) query = query.gte('created_at', fromDateIso);
    if (toDateIso) query = query.lte('created_at', toDateIso);
    if (supplierId) query = query.eq('supplier_id', supplierId);
    if (userId) query = query.eq('user_id', userId);
    if (minAmount) query = query.gte('total', minAmount);
    if (maxAmount) query = query.lte('total', maxAmount);

    query = query.range(offset, offset + limit - 1);
    return query;
  },

  async createPurchaseCompleteRpc(payload) {
    return supabase.rpc('create_purchase_complete', payload);
  },

  async insertPurchase(row) {
    return supabase
      .from('purchases')
      .insert([row])
      .select()
      .maybeSingle();
  },

  async insertPurchaseDetails(rows) {
    return supabase
      .from('purchase_details')
      .insert(rows);
  },

  async getPurchaseDetailsByPurchaseId(purchaseId) {
    return supabase
      .from('purchase_details')
      .select('product_id, quantity')
      .eq('purchase_id', purchaseId);
  },

  async getPurchaseDetailsWithProductByPurchaseId(purchaseId) {
    return supabase
      .from('purchase_details')
      .select(`
          *,
          product:products(name, code, purchase_price)
        `)
      .eq('purchase_id', purchaseId);
  },

  async deletePurchaseDetailsByPurchaseId(purchaseId) {
    return supabase
      .from('purchase_details')
      .delete()
      .eq('purchase_id', purchaseId);
  },

  async deletePurchaseById(purchaseId) {
    return supabase
      .from('purchases')
      .delete()
      .eq('id', purchaseId);
  },
};
