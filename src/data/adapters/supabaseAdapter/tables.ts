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
            notes,
            opened_at,
            updated_at,
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

  // Huella barata del estado de mesas (ids + último updated_at): sirve para que
  // el poll de fallback solo haga el reload completo cuando algo realmente
  // cambió (los triggers bump_table_sync_version actualizan updated_at ante
  // cambios en orders/order_items).
  async getTablesSyncFingerprint(businessId) {
    const { data, error } = await supabase
      .from('tables')
      .select('id, updated_at')
      .eq('business_id', businessId);
    if (error) throw error;
    const rows = Array.isArray(data) ? data : [];
    const ids = rows
      .map((row) => String(row?.id || ''))
      .sort()
      .join(',');
    const maxTs = rows.reduce((acc, row) => {
      const ts = Date.parse(String(row?.updated_at || ''));
      return Number.isFinite(ts) && ts > acc ? ts : acc;
    }, 0);
    return `${ids}|${maxTs}`;
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

  // RPCs dedicados para call_requested_at: el rol cocina es solo lectura
  // por RLS (can_operate_business=false), pero debe poder llamar al mesero.
  async setTableCallRequestedRpc({ businessId, tableId, calledAt }) {
    return supabase.rpc('set_table_call_requested', {
      p_table_id: tableId,
      p_business_id: businessId,
      p_called_at: calledAt ? calledAt.toISOString() : new Date().toISOString()
    });
  },

  async clearTableCallRequestedRpc({ businessId, tableId }) {
    return supabase.rpc('clear_table_call_requested', {
      p_table_id: tableId,
      p_business_id: businessId
    });
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
