import { supabase } from '../../../supabase/Client';

export const syncAdapter = {
  async getSaleSyncStateById({ saleId, businessId }) {
    return supabase
      .from('sales')
      .select('id, business_id, total, payment_method')
      .eq('id', saleId)
      .eq('business_id', businessId)
      .maybeSingle();
  }
};
