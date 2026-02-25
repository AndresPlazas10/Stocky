import { supabase } from '../../supabase/Client';

const AUTH_STORAGE_KEY = 'supabase.auth.token';

function isInvalidRefreshTokenError(error) {
  const message = String(error?.message || '').toLowerCase();
  return (
    message.includes('invalid refresh token')
    || message.includes('refresh token not found')
  );
}

async function recoverInvalidRefreshTokenSession(fallbackData) {
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch {
    // best-effort: limpiar sesión local sin bloquear el flujo
  }

  try {
    if (typeof window !== 'undefined') {
      window.localStorage?.removeItem(AUTH_STORAGE_KEY);
      window.sessionStorage?.removeItem(AUTH_STORAGE_KEY);
    }
  } catch {
    // best-effort
  }

  return { data: fallbackData, error: null };
}

function isMissingColumnError(errorLike, { tableName = '', columnName = '' } = {}) {
  const message = String(errorLike?.message || errorLike || '').toLowerCase();
  if (!message) return false;

  const normalizedTable = String(tableName || '').trim().toLowerCase();
  const normalizedColumn = String(columnName || '').trim().toLowerCase();

  if (normalizedColumn && !message.includes(normalizedColumn)) return false;

  const mentionsMissingColumn = (
    message.includes('does not exist')
    || message.includes('schema cache')
    || message.includes('could not find the')
    || message.includes('pgrst')
  );

  if (!mentionsMissingColumn) return false;

  if (!normalizedTable) return true;
  return message.includes(normalizedTable) || message.includes(`relation "${normalizedTable}"`);
}

export const supabaseAdapter = {
  async getCurrentUser() {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      const sessionResult = await supabase.auth.getSession();
      if (sessionResult?.error && isInvalidRefreshTokenError(sessionResult.error)) {
        return recoverInvalidRefreshTokenSession({ user: null });
      }
      return {
        data: {
          user: sessionResult?.data?.session?.user || null
        },
        error: null
      };
    }

    const result = await supabase.auth.getUser();
    if (result?.error && isInvalidRefreshTokenError(result.error)) {
      return recoverInvalidRefreshTokenSession({ user: null });
    }
    return result;
  },

  async signOut() {
    return supabase.auth.signOut();
  },

  async getCurrentSession() {
    const result = await supabase.auth.getSession();
    if (result?.error && isInvalidRefreshTokenError(result.error)) {
      return recoverInvalidRefreshTokenSession({ session: null });
    }
    return result;
  },

  async signOutGlobal() {
    return supabase.auth.signOut({ scope: 'global' });
  },

  async signInWithPassword({ email, password }) {
    return supabase.auth.signInWithPassword({ email, password });
  },

  async signUpWithPassword({
    email,
    password,
    options = {}
  }) {
    return supabase.auth.signUp({
      email,
      password,
      options
    });
  },

  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange(callback);
  },

  subscribeToPostgresChanges({
    channelName,
    event = '*',
    schema = 'public',
    table,
    filter,
    callback
  }) {
    const channel = supabase.channel(channelName);
    channel.on(
      'postgres_changes',
      {
        event,
        schema,
        table,
        filter
      },
      callback
    );
    channel.subscribe();
    return channel;
  },

  removeRealtimeChannel(channel) {
    if (!channel) return;
    supabase.removeChannel(channel);
  },

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

  async insertEmployee(row) {
    return supabase
      .from('employees')
      .insert([row])
      .select()
      .maybeSingle();
  },

  async deleteBusinessById(businessId) {
    return supabase
      .from('businesses')
      .delete()
      .eq('id', businessId);
  },

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

  async getEmployeeByUserAndBusiness(userId, businessId, selectSql = 'id') {
    return supabase
      .from('employees')
      .select(selectSql)
      .eq('user_id', userId)
      .eq('business_id', businessId)
      .maybeSingle();
  },

  async getSaleDetails(saleId) {
    return supabase
      .from('sale_details')
      .select('quantity, unit_price, subtotal, product_id, combo_id, products(name, code), combos(nombre)')
      .eq('sale_id', saleId);
  },

  async getSalesByBusinessDateRange({ businessId, start, end, selectSql = 'total, payment_method' }) {
    return supabase
      .from('sales')
      .select(selectSql)
      .eq('business_id', businessId)
      .gte('created_at', start)
      .lte('created_at', end);
  },

  async getRecentSalesByBusiness({
    businessId,
    selectSql,
    limit = 50
  }) {
    return supabase
      .from('sales')
      .select(selectSql)
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(limit);
  },

  async getRecentSalesByBusinessSince({
    businessId,
    startIso,
    selectSql = 'id, total, created_at',
    limit = 3
  }) {
    return supabase
      .from('sales')
      .select(selectSql)
      .eq('business_id', businessId)
      .gte('created_at', startIso)
      .order('created_at', { ascending: false })
      .limit(limit);
  },

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

  async getPaginatedTableRows({
    tableName,
    selectSql = '*',
    filters = {},
    orderBy = { column: 'created_at', ascending: false },
    from = 0,
    to = 49,
    countMode = 'exact'
  }) {
    let query = supabase
      .from(tableName)
      .select(selectSql, { count: countMode })
      .order(orderBy?.column || 'created_at', {
        ascending: Boolean(orderBy?.ascending)
      })
      .range(from, to);

    Object.entries(filters || {}).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        query = query.eq(key, value);
      }
    });

    return query;
  },

  async getSalesEnrichedRpc(payload) {
    return supabase.rpc('get_sales_enriched', payload);
  },

  async createSaleCompleteRpc(payload) {
    return supabase.rpc('create_sale_complete', payload);
  },

  async createSaleCompleteIdempotentRpc(payload) {
    return supabase.rpc('create_sale_complete_idempotent', payload);
  },

  async createSplitSalesCompleteRpc(payload) {
    return supabase.rpc('create_split_sales_complete', payload);
  },

  async createSplitSalesCompleteIdempotentRpc(payload) {
    return supabase.rpc('create_split_sales_complete_idempotent', payload);
  },

  async reconcileTablesOrdersConsistencyRpc(payload) {
    return supabase.rpc('reconcile_tables_orders_consistency', payload);
  },

  async getFilteredSalesLegacy({
    businessId,
    fromDateIso = null,
    toDateIso = null,
    paymentMethod = null,
    employeeId = null,
    customerId = null,
    minAmount = null,
    maxAmount = null,
    limit = 50,
    offset = 0,
    includeCount = true,
    countMode = 'planned',
    selectSql
  }) {
    let query = includeCount
      ? supabase.from('sales').select(selectSql, { count: countMode })
      : supabase.from('sales').select(selectSql);

    query = query.eq('business_id', businessId).order('created_at', { ascending: false });

    if (fromDateIso) query = query.gte('created_at', fromDateIso);
    if (toDateIso) query = query.lte('created_at', toDateIso);
    if (paymentMethod) query = query.eq('payment_method', paymentMethod);
    if (employeeId) query = query.eq('user_id', employeeId);
    if (customerId) query = query.eq('customer_id', customerId);
    if (minAmount) query = query.gte('total', minAmount);
    if (maxAmount) query = query.lte('total', maxAmount);

    query = query.range(offset, offset + limit - 1);
    return query;
  },

  async getPurchasesByBusinessDateRange({ businessId, start, end, selectSql = 'total' }) {
    return supabase
      .from('purchases')
      .select(selectSql)
      .eq('business_id', businessId)
      .gte('created_at', start)
      .lte('created_at', end);
  },

  async getActiveProductsStockByBusiness(businessId) {
    return supabase
      .from('products')
      .select('stock, min_stock, manage_stock')
      .eq('business_id', businessId)
      .eq('is_active', true);
  },

  async countSuppliersByBusiness(businessId) {
    return supabase
      .from('suppliers')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId);
  },

  async countInvoicesByBusinessDateRange({ businessId, start, end }) {
    return supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .gte('created_at', start)
      .lte('created_at', end);
  },

  async getSaleDetailsWithProductCostByBusinessDateRange({ businessId, start, end }) {
    return supabase
      .from('sale_details')
      .select(`
        quantity,
        unit_price,
        products!inner(name, purchase_price),
        sales!inner(business_id, created_at)
      `)
      .eq('sales.business_id', businessId)
      .gte('sales.created_at', start)
      .lte('sales.created_at', end);
  },

  async getSaleCashMetadata(saleId) {
    return supabase
      .from('sales')
      .select('amount_received, change_amount, change_breakdown')
      .eq('id', saleId)
      .maybeSingle();
  },

  async updateSaleCashMetadataByBusinessAndId({ businessId, saleId, payload }) {
    return supabase
      .from('sales')
      .update(payload)
      .eq('id', saleId)
      .eq('business_id', businessId);
  },

  async getSaleForPrint(saleId) {
    return supabase
      .from('sales')
      .select('id, total, payment_method, created_at, seller_name')
      .eq('id', saleId)
      .maybeSingle();
  },

  async insertSale(row) {
    return supabase
      .from('sales')
      .insert([row])
      .select()
      .single();
  },

  async insertSaleDetails(rows) {
    return supabase
      .from('sale_details')
      .insert(rows);
  },

  async getSaleDetailsBySaleIdWithSelect(saleId, selectSql) {
    return supabase
      .from('sale_details')
      .select(selectSql)
      .eq('sale_id', saleId);
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

  async deleteSaleDetails(saleId) {
    return supabase
      .from('sale_details')
      .delete()
      .eq('sale_id', saleId);
  },

  async deleteSaleById(saleId) {
    return supabase
      .from('sales')
      .delete()
      .eq('id', saleId);
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

  async getEmployeesByBusiness(businessId) {
    return supabase
      .from('employees')
      .select('user_id, full_name, role')
      .eq('business_id', businessId);
  },

  async getEmployeesByBusinessWithSelect(businessId, selectSql) {
    return supabase
      .from('employees')
      .select(selectSql)
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });
  },

  async getEmployeeByBusinessAndUsername({ businessId, username, selectSql = 'id' }) {
    return supabase
      .from('employees')
      .select(selectSql)
      .eq('business_id', businessId)
      .eq('username', username)
      .maybeSingle();
  },

  async getEmployeeRoleByBusinessAndUser(businessId, userId) {
    return supabase
      .from('employees')
      .select('role')
      .eq('business_id', businessId)
      .eq('user_id', userId)
      .maybeSingle();
  },

  async createEmployeeRpc(payload) {
    return supabase.rpc('create_employee', payload);
  },

  async deleteEmployeeRpc(employeeId) {
    return supabase.rpc('delete_employee', {
      p_employee_id: employeeId
    });
  },

  async deleteEmployeeByBusinessAndId({ employeeId, businessId }) {
    return supabase
      .from('employees')
      .delete()
      .eq('id', employeeId)
      .eq('business_id', businessId);
  },

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

  async getProductsForPurchase(businessId) {
    return supabase
      .from('products')
      .select('id, name, purchase_price, supplier_id, stock, manage_stock, is_active')
      .eq('business_id', businessId)
      .eq('is_active', true);
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

  async getOpenOrdersByBusiness(businessId, selectSql = 'id, business_id, table_id, status, opened_at, updated_at') {
    return supabase
      .from('orders')
      .select(selectSql)
      .eq('business_id', businessId)
      .eq('status', 'open')
      .order('opened_at', { ascending: true });
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

  async getProductsForOrdersByBusiness(businessId) {
    return supabase
      .from('products')
      .select('id, code, name, sale_price, stock, category, manage_stock')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .order('name')
      .limit(200);
  },

  async insertOrder(row) {
    const result = await supabase
      .from('orders')
      .insert([row])
      .select()
      .maybeSingle();

    if (!result?.error) return result;

    if (!Object.prototype.hasOwnProperty.call(row || {}, 'total')) {
      return result;
    }

    if (!isMissingColumnError(result.error, { tableName: 'orders', columnName: 'total' })) {
      return result;
    }

    const { total: _ignoredTotal, ...legacyRow } = row || {};
    return supabase
      .from('orders')
      .insert([legacyRow])
      .select()
      .maybeSingle();
  },

  async deleteOrderById(orderId) {
    return supabase
      .from('orders')
      .delete()
      .eq('id', orderId);
  },

  async deleteOrdersByTableId(tableId) {
    return supabase
      .from('orders')
      .delete()
      .eq('table_id', tableId);
  },

  async deleteOrdersByBusinessAndTableId({ businessId, tableId }) {
    return supabase
      .from('orders')
      .delete()
      .eq('table_id', tableId)
      .eq('business_id', businessId);
  },

  async deleteOrderItemsByOrderIds(orderIds = []) {
    const normalized = Array.isArray(orderIds)
      ? orderIds.map((id) => String(id || '').trim()).filter(Boolean)
      : [];

    if (normalized.length === 0) {
      return { data: [], error: null };
    }

    return supabase
      .from('order_items')
      .delete()
      .in('order_id', normalized);
  },

  async updateOrderById(orderId, payload) {
    return supabase
      .from('orders')
      .update(payload)
      .eq('id', orderId);
  },

  async updateOrderByBusinessAndId({ businessId, orderId, payload }) {
    return supabase
      .from('orders')
      .update(payload)
      .eq('id', orderId)
      .eq('business_id', businessId);
  },

  async getOrderItemsByOrderId(orderId, selectSql) {
    return supabase
      .from('order_items')
      .select(selectSql)
      .eq('order_id', orderId)
      .order('id', { ascending: true });
  },

  async getOrderWithItemsById(orderId, selectSql) {
    return supabase
      .from('orders')
      .select(`
          *,
          order_items!order_items_order_id_fkey (
            ${selectSql}
          )
        `)
      .eq('id', orderId)
      .order('id', { foreignTable: 'order_items', ascending: true })
      .maybeSingle();
  },

  async getOrderForRealtimeById(orderId, selectSql) {
    return supabase
      .from('orders')
      .select(`
          *,
          order_items!order_items_order_id_fkey (
            ${selectSql}
          )
        `)
      .eq('id', orderId)
      .order('id', { foreignTable: 'order_items', ascending: true })
      .single();
  },

  async deleteOrderItemById(itemId) {
    return supabase
      .from('order_items')
      .delete()
      .eq('id', itemId);
  },

  async updateOrderItemById(itemId, payload) {
    return supabase
      .from('order_items')
      .update(payload)
      .eq('id', itemId);
  },

  async getOrderItemById(itemId, selectSql) {
    return supabase
      .from('order_items')
      .select(selectSql)
      .eq('id', itemId)
      .maybeSingle();
  },

  async getOrderItemByOrderAndReference({
    orderId,
    productId = null,
    comboId = null,
    selectSql = 'id, order_id, product_id, combo_id, quantity, price'
  }) {
    let query = supabase
      .from('order_items')
      .select(selectSql)
      .eq('order_id', orderId);

    if (productId) {
      query = query.eq('product_id', productId).is('combo_id', null);
    } else if (comboId) {
      query = query.eq('combo_id', comboId).is('product_id', null);
    } else {
      return { data: null, error: null };
    }

    return query
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();
  },

  async insertOrderItem(row, selectSql = 'id') {
    return supabase
      .from('order_items')
      .insert([row])
      .select(selectSql)
      .maybeSingle();
  },

  async getSaleForPrintByBusinessAndId({ businessId, saleId }) {
    return supabase
      .from('sales')
      .select('id, total, payment_method, created_at, seller_name')
      .eq('id', saleId)
      .eq('business_id', businessId)
      .maybeSingle();
  },

  async getRecentSalesByBusinessAndUserSince({
    businessId,
    userId,
    start,
    limit = 20,
    selectSql = 'id'
  }) {
    return supabase
      .from('sales')
      .select(selectSql)
      .eq('business_id', businessId)
      .eq('user_id', userId)
      .gte('created_at', start)
      .order('created_at', { ascending: false })
      .limit(limit);
  },

  async getSaleDetailsForPrintBySaleId(saleId) {
    return supabase
      .from('sale_details')
      .select('quantity, unit_price, subtotal, product_id, combo_id, products(name, code), combos(nombre)')
      .eq('sale_id', saleId);
  },

  async getProductsWithSupplierByBusiness(businessId) {
    return supabase
      .from('products')
      .select(`
        *,
        supplier:suppliers(id, business_name, contact_name)
      `)
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });
  },

  async getSuppliersByBusinessOrdered(businessId) {
    return supabase
      .from('suppliers')
      .select('id, business_name, contact_name')
      .eq('business_id', businessId)
      .order('business_name', { ascending: true });
  },

  async getActiveEmployeeByUserId(userId, selectSql = 'id, business_id') {
    return supabase
      .from('employees')
      .select(selectSql)
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle();
  },

  async getEmployeeByUserId(userId, selectSql = 'id, business_id') {
    return supabase
      .from('employees')
      .select(selectSql)
      .eq('user_id', userId)
      .maybeSingle();
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

  async getSaleSyncStateById({ saleId, businessId }) {
    return supabase
      .from('sales')
      .select('id, business_id, total, payment_method')
      .eq('id', saleId)
      .eq('business_id', businessId)
      .maybeSingle();
  },

  async getSalesSyncStateByIds({ saleIds = [], businessId }) {
    return supabase
      .from('sales')
      .select('id, business_id')
      .eq('business_id', businessId)
      .in('id', saleIds);
  },

  async getPurchaseSyncStateById({ purchaseId, businessId }) {
    return supabase
      .from('purchases')
      .select('id, business_id, total, payment_method')
      .eq('id', purchaseId)
      .eq('business_id', businessId)
      .maybeSingle();
  },

  async getSupplierSyncStateById({ supplierId, businessId }) {
    return supabase
      .from('suppliers')
      .select('id, business_id, business_name')
      .eq('id', supplierId)
      .eq('business_id', businessId)
      .maybeSingle();
  },

  async getOrderSyncStateById({ orderId, businessId }) {
    return supabase
      .from('orders')
      .select('id, business_id, table_id, status, total')
      .eq('id', orderId)
      .eq('business_id', businessId)
      .maybeSingle();
  },

  async getTableSyncStateById({ tableId, businessId }) {
    return supabase
      .from('tables')
      .select('id, business_id, table_number, status, current_order_id')
      .eq('id', tableId)
      .eq('business_id', businessId)
      .maybeSingle();
  },

  async getOrderItemSyncStateById(itemId) {
    return supabase
      .from('order_items')
      .select('id, order_id, quantity')
      .eq('id', itemId)
      .maybeSingle();
  },

  async getOrderItemsSyncStateByIds(itemIds = []) {
    return supabase
      .from('order_items')
      .select('id, order_id, quantity')
      .in('id', itemIds);
  },

  async getOrdersByTableId({ tableId, businessId }) {
    return supabase
      .from('orders')
      .select('id, status')
      .eq('table_id', tableId)
      .eq('business_id', businessId);
  },

  async getProductSyncStateById({ productId, businessId }) {
    return supabase
      .from('products')
      .select('id, business_id, is_active')
      .eq('id', productId)
      .eq('business_id', businessId)
      .maybeSingle();
  },

  async getInvoiceSyncStateById({ invoiceId, businessId }) {
    return supabase
      .from('invoices')
      .select('id, business_id, status')
      .eq('id', invoiceId)
      .eq('business_id', businessId)
      .maybeSingle();
  }
};
