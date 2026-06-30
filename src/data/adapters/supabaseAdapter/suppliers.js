import { supabase } from '../../../supabase/Client';

export const suppliersAdapter = {
  async getSuppliersByBusiness(businessId) {
    return supabase
      .from('suppliers')
      .select('id, business_name, contact_name')
      .eq('business_id', businessId);
  },

  async getSuppliersByBusinessWithSelect(businessId, selectSql) {
    return supabase
      .from('suppliers')
      .select(selectSql)
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });
  },

  async getSupplierById(supplierId) {
    return supabase
      .from('suppliers')
      .select('business_name, contact_name')
      .eq('id', supplierId)
      .single();
  },

  async insertSupplier(row) {
    return supabase
      .from('suppliers')
      .insert([row])
      .select()
      .maybeSingle();
  },

  async updateSupplierById(supplierId, payload) {
    return supabase
      .from('suppliers')
      .update(payload)
      .eq('id', supplierId)
      .select()
      .maybeSingle();
  },

  async deleteSupplierById(supplierId) {
    return supabase
      .from('suppliers')
      .delete()
      .eq('id', supplierId);
  },

  async getSuppliersByBusinessOrdered(businessId) {
    return supabase
      .from('suppliers')
      .select('id, business_name, contact_name')
      .eq('business_id', businessId)
      .order('business_name', { ascending: true });
  },

  async countSuppliersByBusiness(businessId) {
    return supabase
      .from('suppliers')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId);
  },
};
