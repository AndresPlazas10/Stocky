import { supabase } from '../supabase/Client';

/**
 * Obtiene compras aplicando filtros en la base de datos.
 * @param {string} businessId
 * @param {object} filters - { fromDate, toDate, supplierId, userId, minAmount, maxAmount, invoiceNumber, status }
 * @param {object} pagination - { limit = 50, offset = 0 }
 */
export async function getFilteredPurchases(businessId, filters = {}, pagination = {}) {
  try {
    if (!businessId) return { data: [], count: 0 };

    const limit = Number(pagination.limit || 50);
    const offset = Number(pagination.offset || 0);

    // Construir query optimizada
    let query = supabase
      .from('purchases')
      .select('*', { count: 'exact' })
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    // Aplicar filtros de fecha primero (mejor uso de índices)
    if (filters.fromDate) query = query.gte('created_at', filters.fromDate);
    if (filters.toDate) {
      // Añadir tiempo al final del día para incluir todo el día
      const endDate = new Date(filters.toDate);
      endDate.setHours(23, 59, 59, 999);
      query = query.lte('created_at', endDate.toISOString());
    }
    
    // Otros filtros
    if (filters.supplierId) query = query.eq('supplier_id', filters.supplierId);
    if (filters.userId) query = query.eq('user_id', filters.userId);
    if (filters.invoiceNumber) query = query.eq('invoice_number', filters.invoiceNumber);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.minAmount) query = query.gte('total', filters.minAmount);
    if (filters.maxAmount) query = query.lte('total', filters.maxAmount);

    // Aplicar paginación
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    return { data: data || [], count: count || 0 };
  } catch (error) {
    
    return { data: [], count: 0 };
  }
}

export default { getFilteredPurchases };
