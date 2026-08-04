import { supabase } from '../../../supabase/Client';

export const tablesAdapter = {
  async reconcileTablesOrdersConsistencyRpc(payload) {
    return supabase.rpc('reconcile_tables_orders_consistency', payload);
  },

  async openCloseTableTransactionRpc({ tableId, action, userId }) {
    return supabase.rpc('open_close_table_transaction', {
      p_table_id: tableId,
      p_action: action,
      p_user_id: userId
    });
  },

  async getTablesWithCurrentOrderByBusiness(businessId) {
    return supabase
      .from('tables')
      .select(`
          *,
          orders!current_order_id (
            id,
            status,
            total,
            opened_at,
            order_items (
              id,
              product_id,
              combo_id,
              quantity,
              price,
              subtotal,
              products (id, name, category),
              combos (id, nombre, descripcion)
            )
          )
        `)
      .eq('business_id', businessId)
      .order('table_number', { ascending: true });
  },

  async insertTable(row) {
    return supabase
      .from('tables')
      .insert([row])
      .select()
      .maybeSingle();
  },

  async updateTableById(tableId, payload) {
    return supabase
      .from('tables')
      .update(payload)
      .eq('id', tableId);
  },

  async updateTableByBusinessAndId({ businessId, tableId, payload }) {
    return supabase
      .from('tables')
      .update(payload)
      .eq('id', tableId)
      .eq('business_id', businessId);
  },

  async deleteTableById(tableId) {
    return supabase
      .from('tables')
      .delete()
      .eq('id', tableId);
  },

  async deleteTableByBusinessAndId({ businessId, tableId }) {
    return supabase
      .from('tables')
      .delete()
      .eq('id', tableId)
      .eq('business_id', businessId);
  },
};
