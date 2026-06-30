import { supabase } from '../../../supabase/Client';
import { INVENTORY_PRODUCT_COLUMNS, INVENTORY_PRODUCT_SUPPLIER_SELECT } from './shared.js';

export const productsAdapter = {
  async getActiveProductsForSale(businessId) {
    return supabase
      .from('products')
      .select('id, code, name, sale_price, stock, category, manage_stock')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .order('name')
      .limit(200);
  },

  async getLowStockProductsByBusiness({
    businessId,
    threshold = 10,
    limit = 5
  }) {
    return supabase
      .from('products')
      .select('id, name, stock')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .lt('stock', threshold)
      .order('stock', { ascending: true })
      .limit(limit);
  },

  async getActiveProductsStockByBusiness(businessId) {
    return supabase
      .from('products')
      .select('stock, min_stock, manage_stock')
      .eq('business_id', businessId)
      .eq('is_active', true);
  },

  async getAvailableProductsForSaleByBusiness(businessId) {
    return supabase
      .from('products')
      .select('id, code, name, sale_price, stock, category, is_active, manage_stock')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .or('manage_stock.eq.false,stock.gt.0')
      .order('name');
  },

  async getProductsForPurchase(businessId) {
    return supabase
      .from('products')
      .select('id, name, purchase_price, supplier_id, stock, manage_stock, is_active')
      .eq('business_id', businessId)
      .eq('is_active', true);
  },

  async getProductPurchasePricesByBusiness(businessId) {
    return supabase
      .from('products')
      .select('id, purchase_price')
      .eq('business_id', businessId);
  },

  async getProductsByBusinessAndIds(businessId, productIds) {
    return supabase
      .from('products')
      .select('id, stock, manage_stock')
      .eq('business_id', businessId)
      .in('id', productIds);
  },

  async updateProductStockAndPurchasePrice({ businessId, productId, stock, purchasePrice }) {
    const payload = { stock };
    if (Number.isFinite(Number(purchasePrice))) {
      payload.purchase_price = Number(purchasePrice);
    }

    return supabase
      .from('products')
      .update(payload)
      .eq('id', productId)
      .eq('business_id', businessId);
  },

  async getProductsForOrdersByBusiness(businessId) {
    return supabase
      .from('products')
      .select('id, code, name, sale_price, stock, category, manage_stock')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .order('name')
      .limit(200);
  },

  async getProductsWithSupplierByBusiness(businessId) {
    return supabase
      .from('products')
      .select(`${INVENTORY_PRODUCT_COLUMNS}, ${INVENTORY_PRODUCT_SUPPLIER_SELECT}`)
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });
  },

  async getProductsWithSupplierByBusinessPaginated({
    businessId,
    limit = 120,
    offset = 0,
    includeCount = false
  }) {
    const to = Math.max(0, offset + limit - 1);
    return supabase
      .from('products')
      .select(`${INVENTORY_PRODUCT_COLUMNS}, ${INVENTORY_PRODUCT_SUPPLIER_SELECT}`, includeCount ? { count: 'exact' } : {})
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .range(offset, to);
  },

  async createProductWithGeneratedCodeRpc(payload) {
    return supabase.rpc('create_product_with_generated_code', payload);
  },

  async insertProduct(row) {
    return supabase
      .from('products')
      .insert([row])
      .select()
      .maybeSingle();
  },

  async updateProductById(productId, payload) {
    return supabase
      .from('products')
      .update(payload)
      .eq('id', productId)
      .select()
      .maybeSingle();
  },

  async deleteProductById(productId) {
    return supabase
      .from('products')
      .delete()
      .eq('id', productId);
  },

  async checkProductCanDelete(productId) {
    const { data, error } = await supabase.rpc('check_product_can_delete', {
      p_product_id: productId
    });
    if (error) throw error;
    return data;
  },

  async getProductsForInvoicesByBusiness(businessId, selectSql) {
    return supabase
      .from('products')
      .select(selectSql)
      .eq('business_id', businessId)
      .eq('is_active', true)
      .order('name');
  },

  async getProductsStockByIds(productIds) {
    return supabase
      .from('products')
      .select('id, stock, name')
      .in('id', productIds);
  },

  async updateStockBatch(productUpdates) {
    return supabase.rpc('update_stock_batch', {
      product_updates: productUpdates
    });
  },

  async restoreStockBatch(productUpdates) {
    return supabase.rpc('restore_stock_batch', {
      product_updates: productUpdates
    });
  },
};
