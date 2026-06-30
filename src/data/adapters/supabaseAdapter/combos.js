import { supabase } from '../../../supabase/Client';

export const combosAdapter = {
  async getCombosByBusinessWithItems({ businessId, onlyActive = false }) {
    let query = supabase
      .from('combos')
      .select(`
        id,
        business_id,
        nombre,
        precio_venta,
        descripcion,
        estado,
        created_at,
        combo_items (
          id,
          producto_id,
          cantidad,
          products (
            id,
            name,
            code,
            purchase_price,
            stock,
            is_active,
            category
          )
        )
      `)
      .eq('business_id', businessId)
      .order('nombre', { ascending: true });

    if (onlyActive) {
      query = query.eq('estado', 'active');
    }

    return query;
  },

  async insertCombo(row) {
    return supabase
      .from('combos')
      .insert([row])
      .select('id')
      .maybeSingle();
  },

  async insertComboItems(rows) {
    return supabase
      .from('combo_items')
      .insert(rows);
  },

  async updateComboByBusinessAndId({ comboId, businessId, payload }) {
    return supabase
      .from('combos')
      .update(payload)
      .eq('id', comboId)
      .eq('business_id', businessId);
  },

  async deleteComboItemsByComboId(comboId) {
    return supabase
      .from('combo_items')
      .delete()
      .eq('combo_id', comboId);
  },

  async deleteComboByBusinessAndId({ comboId, businessId, selectSql = 'id' }) {
    return supabase
      .from('combos')
      .delete()
      .eq('id', comboId)
      .eq('business_id', businessId)
      .select(selectSql)
      .maybeSingle();
  },
};
