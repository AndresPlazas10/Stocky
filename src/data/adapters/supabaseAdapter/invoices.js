import { supabase } from '../../../supabase/Client';

export const invoicesAdapter = {
  async countInvoicesByBusinessDateRange({ businessId, start, end }) {
    return supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .gte('created_at', start)
      .lte('created_at', end);
  },

  async getInvoicesWithItemsByBusiness({
    businessId,
    invoiceColumns,
    invoiceItemsColumns
  }) {
    return supabase
      .from('invoices')
      .select(`
        ${invoiceColumns},
        invoice_items (
          ${invoiceItemsColumns}
        )
      `)
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });
  },

  async generateInvoiceNumber(businessId) {
    return supabase.rpc('generate_invoice_number', { p_business_id: businessId });
  },

  async insertInvoice(row) {
    return supabase
      .from('invoices')
      .insert(row)
      .select()
      .maybeSingle();
  },

  async updateInvoiceById(invoiceId, payload) {
    return supabase
      .from('invoices')
      .update(payload)
      .eq('id', invoiceId);
  },

  async deleteInvoiceById(invoiceId) {
    return supabase
      .from('invoices')
      .delete()
      .eq('id', invoiceId);
  },

  async insertInvoiceItems(rows) {
    return supabase
      .from('invoice_items')
      .insert(rows);
  },

  async deleteInvoiceItemsByInvoiceId(invoiceId) {
    return supabase
      .from('invoice_items')
      .delete()
      .eq('invoice_id', invoiceId);
  },

  async getInvoiceItemsByInvoiceId(invoiceId) {
    return supabase
      .from('invoice_items')
      .select('product_id, quantity, product_name')
      .eq('invoice_id', invoiceId);
  },

  async getInvoiceWithItemsById(invoiceId, invoiceItemsColumns) {
    return supabase
      .from('invoices')
      .select(`
        *,
        invoice_items (
          ${invoiceItemsColumns}
        )
      `)
      .eq('id', invoiceId)
      .maybeSingle();
  },

  async getDaneCities({ searchTerm = '', limit = 50 } = {}) {
    let query = supabase
      .from('dane_cities')
      .select('city_code, city_name, department_name')
      .order('city_name')
      .limit(limit);

    if (searchTerm) {
      query = query.ilike('city_name', `%${searchTerm}%`);
    }

    return query;
  },

  async insertInvoicingRequest(row) {
    return supabase
      .from('invoicing_requests')
      .insert(row);
  },
};
