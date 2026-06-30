import { supabase } from '../../../supabase/Client';

export const businessAdapter = {
  async getBusinessById(businessId, selectSql = '*') {
    return supabase
      .from('businesses')
      .select(selectSql)
      .eq('id', businessId)
      .maybeSingle();
  },

  async getBusinessByEmail(email, selectSql = '*') {
    return supabase
      .from('businesses')
      .select(selectSql)
      .eq('email', email)
      .maybeSingle();
  },

  async getBusinessByUsername(username, selectSql = 'id') {
    return supabase
      .from('businesses')
      .select(selectSql)
      .eq('username', username)
      .maybeSingle();
  },

  async getBusinessByOwnerId(userId, selectSql = '*') {
    return supabase
      .from('businesses')
      .select(selectSql)
      .eq('created_by', userId)
      .maybeSingle();
  },

  async checkBusinessAccessRpc({ businessId, userId }) {
    return supabase.rpc('check_business_access', {
      p_business_id: businessId,
      p_user_id: userId
    });
  },

  async getBusinessesByOwnerId(userId, selectSql = '*') {
    return supabase
      .from('businesses')
      .select(selectSql)
      .eq('created_by', userId)
      .order('created_at', { ascending: false });
  },

  async updateBusinessLogoById(businessId, logoUrl) {
    return supabase
      .from('businesses')
      .update({ logo_url: logoUrl })
      .eq('id', businessId);
  },

  async updateBusinessById(businessId, payload) {
    return supabase
      .from('businesses')
      .update(payload)
      .eq('id', businessId)
      .select()
      .maybeSingle();
  },

  async insertBusiness(row) {
    return supabase
      .from('businesses')
      .insert([row])
      .select()
      .maybeSingle();
  },

  async createBusinessForCurrentUserRpc({
    p_name,
    p_nit = null,
    p_address = null,
    p_phone = null,
    p_email = null,
    p_username = null
  }) {
    return supabase.rpc('create_business_for_current_user', {
      p_name,
      p_nit,
      p_address,
      p_phone,
      p_email,
      p_username
    });
  },

  async deleteBusinessById(businessId) {
    return supabase
      .from('businesses')
      .delete()
      .eq('id', businessId);
  },

  async getBusinessName(businessId) {
    return supabase
      .from('businesses')
      .select('name')
      .eq('id', businessId)
      .single();
  },

  async getBusinessOwnerById(businessId) {
    return supabase
      .from('businesses')
      .select('created_by')
      .eq('id', businessId)
      .maybeSingle();
  },
};
