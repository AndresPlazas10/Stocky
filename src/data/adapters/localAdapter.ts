// @ts-nocheck — FIXME: Migración incremental Phase 8
import { supabaseAdapter } from './supabaseAdapter.js';
import { readCacheGet, readCacheSet } from './readCacheStore.js';

const READ_CACHE_TTL_MS = 30000;

function buildCacheKey(parts = []) {
  return parts
    .filter((part) => part !== undefined && part !== null && String(part).trim() !== '')
    .map((part) => String(part).trim())
    .join(':');
}

function normalizeDateKey(value) {
  const parsed = Date.parse(String(value || '').trim());
  if (!Number.isFinite(parsed)) return String(value || '').trim();
  return new Date(parsed).toISOString().slice(0, 10);
}

function shouldUseOrdersReadCache() {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

function shouldUseCriticalOrdersReadCache() {
  // Para consultas criticas de mesas/ordenes en pantalla activa,
  // priorizamos consistencia en online y dejamos cache solo para offline.
  if (typeof navigator === 'undefined') return false;
  return navigator.onLine === false;
}

function shouldUseCriticalInventoryReadCache() {
  // Para inventario (pantalla de edición), evitar lecturas stale en online.
  // En offline seguimos permitiendo cache como fallback.
  if (typeof navigator === 'undefined') return false;
  return navigator.onLine === false;
}

function shouldUseCriticalInvoicesReadCache() {
  // Para facturas y stock de facturación, priorizar consistencia en online.
  if (typeof navigator === 'undefined') return false;
  return navigator.onLine === false;
}

function shouldUseCatalogCache() {
  return true;
}

async function readThroughCache({
  cacheKey: _cacheKey,
  enabled: _enabled,
  fetcher,
  ttlMs = READ_CACHE_TTL_MS
}) {
  const cacheKey = buildCacheKey([_cacheKey]);
  const enabled = Boolean(_enabled);

  if (!enabled || !cacheKey) {
    return fetcher();
  }

  const cached = readCacheGet(cacheKey);
  if (cached) {
    return cached;
  }

  const result = await fetcher();
  if (!result?.error) {
    readCacheSet(cacheKey, result, ttlMs);
  }

  return result;
}

export const readAdapter = {
  subscribeToPostgresChanges(options = {}) {
    return supabaseAdapter.subscribeToPostgresChanges(options);
  },

  removeRealtimeChannel(channel) {
    return supabaseAdapter.removeRealtimeChannel(channel);
  },

  async getCurrentUser() {
    return supabaseAdapter.getCurrentUser();
  },

  async getBusinessById(businessId, selectSql = '*') {
    return readThroughCache({
      cacheKey: buildCacheKey(['business', businessId, 'detail', selectSql]),
      enabled: true,
      fetcher: () => supabaseAdapter.getBusinessById(businessId, selectSql)
    });
  },

  async getBusinessByOwnerId(userId, selectSql = '*') {
    return readThroughCache({
      cacheKey: buildCacheKey(['business', 'owner', userId, selectSql]),
      enabled: true,
      fetcher: () => supabaseAdapter.getBusinessByOwnerId(userId, selectSql)
    });
  },

  async getActiveProductsForSale(businessId) {
    return readThroughCache({
      cacheKey: buildCacheKey(['products', 'sales', businessId, 'active']),
      enabled: shouldUseCatalogCache(),
      fetcher: () => supabaseAdapter.getActiveProductsForSale(businessId)
    });
  },

  async getLowStockProductsByBusiness({
    businessId,
    threshold = 10,
    limit = 5
  }) {
    return supabaseAdapter.getLowStockProductsByBusiness({
      businessId,
      threshold,
      limit
    });
  },

  async getEmployeeByUserAndBusiness(userId, businessId) {
    return readThroughCache({
      cacheKey: buildCacheKey(['employees', businessId, 'user', userId, 'membership']),
      enabled: false,
      fetcher: () => supabaseAdapter.getEmployeeByUserAndBusiness(userId, businessId)
    });
  },

  async getSaleDetails(saleId) {
    return readThroughCache({
      cacheKey: buildCacheKey(['sales', saleId, 'details']),
      enabled: false,
      fetcher: () => supabaseAdapter.getSaleDetails(saleId)
    });
  },

  async getSalesByBusinessDateRange({
    businessId,
    start,
    end,
    selectSql = 'total, payment_method'
  }) {
    const startKey = normalizeDateKey(start);
    const endKey = normalizeDateKey(end);
    return readThroughCache({
      cacheKey: buildCacheKey(['reports', businessId, 'sales', startKey, endKey, selectSql]),
      enabled: false,
      fetcher: () => supabaseAdapter.getSalesByBusinessDateRange({ businessId, start, end, selectSql })
    });
  },

  async getPurchasesByBusinessDateRange({
    businessId,
    start,
    end,
    selectSql = 'total'
  }) {
    const startKey = normalizeDateKey(start);
    const endKey = normalizeDateKey(end);
    return readThroughCache({
      cacheKey: buildCacheKey(['reports', businessId, 'purchases', startKey, endKey, selectSql]),
      enabled: false,
      fetcher: () => supabaseAdapter.getPurchasesByBusinessDateRange({ businessId, start, end, selectSql })
    });
  },

  async getActiveProductsStockByBusiness(businessId) {
    return readThroughCache({
      cacheKey: buildCacheKey(['reports', businessId, 'products_stock']),
      enabled: false,
      fetcher: () => supabaseAdapter.getActiveProductsStockByBusiness(businessId)
    });
  },

  async countSuppliersByBusiness(businessId) {
    const result = await readThroughCache({
      cacheKey: buildCacheKey(['reports', businessId, 'suppliers_count']),
      enabled: false,
      fetcher: async () => {
        const { count, error } = await supabaseAdapter.countSuppliersByBusiness(businessId);
        return {
          data: { count: Number(count || 0) },
          error
        };
      }
    });

    return {
      count: Number(result?.data?.count || 0),
      error: result?.error || null
    };
  },

  async countInvoicesByBusinessDateRange({ businessId, start, end }) {
    const startKey = normalizeDateKey(start);
    const endKey = normalizeDateKey(end);
    const result = await readThroughCache({
      cacheKey: buildCacheKey(['reports', businessId, 'invoices_count', startKey, endKey]),
      enabled: false,
      fetcher: async () => {
        const { count, error } = await supabaseAdapter.countInvoicesByBusinessDateRange({ businessId, start, end });
        return {
          data: { count: Number(count || 0) },
          error
        };
      }
    });

    return {
      count: Number(result?.data?.count || 0),
      error: result?.error || null
    };
  },

  async getSaleDetailsWithProductCostByBusinessDateRange({ businessId, start, end }) {
    const startKey = normalizeDateKey(start);
    const endKey = normalizeDateKey(end);
    return readThroughCache({
      cacheKey: buildCacheKey(['reports', businessId, 'sale_details_cost', startKey, endKey]),
      enabled: false,
      fetcher: () => supabaseAdapter.getSaleDetailsWithProductCostByBusinessDateRange({ businessId, start, end })
    });
  },

  async getComboSaleDetailsByBusinessDateRange({ businessId, start, end }) {
    const startKey = normalizeDateKey(start);
    const endKey = normalizeDateKey(end);
    return readThroughCache({
      cacheKey: buildCacheKey(['reports', businessId, 'combo_sale_details', startKey, endKey]),
      enabled: false,
      fetcher: () => supabaseAdapter.getComboSaleDetailsByBusinessDateRange({ businessId, start, end })
    });
  },

  async getRecentSalesByBusinessSince({
    businessId,
    startIso,
    selectSql = 'id, total, created_at',
    limit = 3
  }) {
    return supabaseAdapter.getRecentSalesByBusinessSince({
      businessId,
      startIso,
      selectSql,
      limit
    });
  },

  async getRecentPurchasesByBusinessSince({
    businessId,
    startIso,
    selectSql,
    limit = 3
  }) {
    return supabaseAdapter.getRecentPurchasesByBusinessSince({
      businessId,
      startIso,
      selectSql,
      limit
    });
  },

  async getSaleCashMetadata(saleId) {
    return readThroughCache({
      cacheKey: buildCacheKey(['sales', saleId, 'cash_metadata']),
      enabled: false,
      fetcher: () => supabaseAdapter.getSaleCashMetadata(saleId)
    });
  },

  async getSaleForPrint(saleId) {
    return readThroughCache({
      cacheKey: buildCacheKey(['sales', saleId, 'print']),
      enabled: false,
      fetcher: () => supabaseAdapter.getSaleForPrint(saleId)
    });
  },

  async getBusinessName(businessId) {
    return readThroughCache({
      cacheKey: buildCacheKey(['business', businessId, 'name']),
      enabled: false,
      fetcher: () => supabaseAdapter.getBusinessName(businessId)
    });
  },

  async getBusinessOwnerById(businessId) {
    return readThroughCache({
      cacheKey: buildCacheKey(['business', businessId, 'owner']),
      enabled: false,
      fetcher: () => supabaseAdapter.getBusinessOwnerById(businessId)
    });
  },

  async getEmployeesByBusiness(businessId) {
    return readThroughCache({
      cacheKey: buildCacheKey(['employees', businessId, 'list']),
      enabled: false,
      fetcher: () => supabaseAdapter.getEmployeesByBusiness(businessId)
    });
  },

  async getEmployeesByBusinessWithSelect(businessId, selectSql) {
    return readThroughCache({
      cacheKey: buildCacheKey(['employees', businessId, 'detailed', selectSql]),
      enabled: false,
      fetcher: () => supabaseAdapter.getEmployeesByBusinessWithSelect(businessId, selectSql)
    });
  },

  async getEmployeeByBusinessAndUsername({ businessId, username, selectSql = 'id' }) {
    return supabaseAdapter.getEmployeeByBusinessAndUsername({
      businessId,
      username,
      selectSql
    });
  },

  async getEmployeeRoleByBusinessAndUser(businessId, userId) {
    return readThroughCache({
      cacheKey: buildCacheKey(['employees', businessId, 'role_by_user', userId]),
      enabled: false,
      fetcher: () => supabaseAdapter.getEmployeeRoleByBusinessAndUser(businessId, userId)
    });
  },

  async getSuppliersByBusiness(businessId) {
    return readThroughCache({
      cacheKey: buildCacheKey(['suppliers', businessId, 'list']),
      enabled: shouldUseCatalogCache(),
      fetcher: () => supabaseAdapter.getSuppliersByBusiness(businessId)
    });
  },

  async getSuppliersByBusinessWithSelect(businessId, selectSql) {
    return readThroughCache({
      cacheKey: buildCacheKey(['suppliers', businessId, 'detailed', selectSql]),
      enabled: shouldUseCatalogCache(),
      fetcher: () => supabaseAdapter.getSuppliersByBusinessWithSelect(businessId, selectSql)
    });
  },

  async getSupplierById(supplierId) {
    return readThroughCache({
      cacheKey: buildCacheKey(['supplier', supplierId]),
      enabled: shouldUseCatalogCache(),
      fetcher: () => supabaseAdapter.getSupplierById(supplierId)
    });
  },

  async getProductsForPurchase(businessId) {
    return readThroughCache({
      cacheKey: buildCacheKey(['products', 'purchases', businessId, 'active']),
      enabled: shouldUseCatalogCache(),
      fetcher: () => supabaseAdapter.getProductsForPurchase(businessId)
    });
  },

  async getProductPurchasePricesByBusiness(businessId) {
    return readThroughCache({
      cacheKey: buildCacheKey(['products', 'purchase_prices', businessId, 'all']),
      enabled: shouldUseCatalogCache(),
      fetcher: () => supabaseAdapter.getProductPurchasePricesByBusiness(businessId)
    });
  },

  async getPurchaseDetailsByPurchaseId(purchaseId) {
    return readThroughCache({
      cacheKey: buildCacheKey(['purchases', purchaseId, 'details_min']),
      enabled: false,
      fetcher: () => supabaseAdapter.getPurchaseDetailsByPurchaseId(purchaseId)
    });
  },

  async getPurchaseDetailsWithProductByPurchaseId(purchaseId) {
    return readThroughCache({
      cacheKey: buildCacheKey(['purchases', purchaseId, 'details_with_product']),
      enabled: false,
      fetcher: () => supabaseAdapter.getPurchaseDetailsWithProductByPurchaseId(purchaseId)
    });
  },

  async getProductsByBusinessAndIds(businessId, productIds) {
    const normalizedIds = (productIds || []).filter(Boolean).map(String).sort().join(',');
    return readThroughCache({
      cacheKey: buildCacheKey(['products', 'subset', businessId, normalizedIds]),
      enabled: false,
      fetcher: () => supabaseAdapter.getProductsByBusinessAndIds(businessId, productIds)
    });
  },

  async getTablesWithCurrentOrderByBusiness(businessId) {
    return readThroughCache({
      cacheKey: buildCacheKey(['tables', businessId, 'current_order']),
      enabled: shouldUseCriticalOrdersReadCache(),
      fetcher: () => supabaseAdapter.getTablesWithCurrentOrderByBusiness(businessId)
    });
  },

  async getTablesSyncFingerprint(businessId) {
    // La huella SIEMPRE va a la red (sin cache): es la señal barata que decide
    // si el poll de fallback necesita el reload completo.
    try {
      const data = await supabaseAdapter.getTablesSyncFingerprint(businessId);
      return { data, error: null };
    } catch (error) {
      return { data: '', error };
    }
  },

  async getOpenOrdersByBusiness(businessId, selectSql = 'id, business_id, table_id, status, opened_at, updated_at') {
    return readThroughCache({
      cacheKey: buildCacheKey(['orders', businessId, 'open', selectSql]),
      enabled: shouldUseOrdersReadCache(),
      fetcher: () => supabaseAdapter.getOpenOrdersByBusiness(businessId, selectSql)
    });
  },

  async getProductsForOrdersByBusiness(businessId) {
    return readThroughCache({
      cacheKey: buildCacheKey(['products', 'orders', businessId, 'active']),
      enabled: shouldUseCatalogCache(),
      fetcher: () => supabaseAdapter.getProductsForOrdersByBusiness(businessId)
    });
  },

  async getCombosByBusinessWithItems({ businessId, onlyActive = false }) {
    return readThroughCache({
      cacheKey: buildCacheKey(['combos', businessId, onlyActive ? 'active' : 'all', 'with_items']),
      enabled: shouldUseCatalogCache(),
      fetcher: () => supabaseAdapter.getCombosByBusinessWithItems({ businessId, onlyActive })
    });
  },

  async getOrderItemsByOrderId(orderId, selectSql) {
    return readThroughCache({
      cacheKey: buildCacheKey(['orders', orderId, 'items', selectSql]),
      enabled: shouldUseCriticalOrdersReadCache(),
      fetcher: () => supabaseAdapter.getOrderItemsByOrderId(orderId, selectSql)
    });
  },

  async getOrderWithItemsById(orderId, selectSql) {
    return readThroughCache({
      cacheKey: buildCacheKey(['orders', orderId, 'with_items', selectSql]),
      enabled: shouldUseCriticalOrdersReadCache(),
      fetcher: () => supabaseAdapter.getOrderWithItemsById(orderId, selectSql)
    });
  },

  async getOrderForRealtimeById(orderId, selectSql) {
    return readThroughCache({
      cacheKey: buildCacheKey(['orders', orderId, 'realtime', selectSql]),
      enabled: shouldUseCriticalOrdersReadCache(),
      fetcher: () => supabaseAdapter.getOrderForRealtimeById(orderId, selectSql)
    });
  },

  async getSaleForPrintByBusinessAndId({ businessId, saleId }) {
    return readThroughCache({
      cacheKey: buildCacheKey(['sales', businessId, saleId, 'print_bundle_sale']),
      enabled: false,
      fetcher: () => supabaseAdapter.getSaleForPrintByBusinessAndId({ businessId, saleId })
    });
  },

  async getSaleDetailsForPrintBySaleId(saleId) {
    return readThroughCache({
      cacheKey: buildCacheKey(['sales', saleId, 'print_bundle_details']),
      enabled: false,
      fetcher: () => supabaseAdapter.getSaleDetailsForPrintBySaleId(saleId)
    });
  },

  async getProductsWithSupplierByBusiness(businessId) {
    return readThroughCache({
      cacheKey: buildCacheKey(['products', 'inventory', businessId, 'with_supplier']),
      enabled: shouldUseCriticalInventoryReadCache(),
      fetcher: () => supabaseAdapter.getProductsWithSupplierByBusiness(businessId)
    });
  },

  async getSuppliersByBusinessOrdered(businessId) {
    return readThroughCache({
      cacheKey: buildCacheKey(['suppliers', businessId, 'ordered']),
      enabled: shouldUseCatalogCache(),
      fetcher: () => supabaseAdapter.getSuppliersByBusinessOrdered(businessId)
    });
  },

  async getActiveEmployeeByUserId(userId, selectSql = 'id, business_id') {
    return readThroughCache({
      cacheKey: buildCacheKey(['employees', 'active_by_user', userId, selectSql]),
      enabled: true,
      fetcher: () => supabaseAdapter.getActiveEmployeeByUserId(userId, selectSql)
    });
  },

  async getEmployeeByUserId(userId, selectSql = 'id, business_id', businessId?) {
    return readThroughCache({
      cacheKey: buildCacheKey(['employees', 'by_user', userId, selectSql, businessId || '']),
      enabled: true,
      fetcher: () => supabaseAdapter.getEmployeeByUserId(userId, selectSql, businessId)
    });
  },

  async getInvoicesWithItemsByBusiness({
    businessId,
    invoiceColumns,
    invoiceItemsColumns
  }) {
    return readThroughCache({
      cacheKey: buildCacheKey(['invoices', businessId, 'list']),
      enabled: shouldUseCriticalInvoicesReadCache(),
      fetcher: () => supabaseAdapter.getInvoicesWithItemsByBusiness({
        businessId,
        invoiceColumns,
        invoiceItemsColumns
      })
    });
  },

  async getProductsForInvoicesByBusiness(businessId, selectSql) {
    return readThroughCache({
      cacheKey: buildCacheKey(['products', 'invoices', businessId, selectSql]),
      enabled: shouldUseCriticalInvoicesReadCache(),
      fetcher: () => supabaseAdapter.getProductsForInvoicesByBusiness(businessId, selectSql)
    });
  },

  async getProductsStockByIds(productIds = []) {
    const normalizedIds = (productIds || []).filter(Boolean).map(String).sort().join(',');
    return readThroughCache({
      cacheKey: buildCacheKey(['products', 'stock_subset', normalizedIds]),
      enabled: shouldUseCriticalInvoicesReadCache(),
      fetcher: () => supabaseAdapter.getProductsStockByIds(productIds)
    });
  },

  async getInvoiceWithItemsById(invoiceId, invoiceItemsColumns) {
    return readThroughCache({
      cacheKey: buildCacheKey(['invoice', invoiceId, 'with_items', invoiceItemsColumns]),
      enabled: shouldUseCriticalInvoicesReadCache(),
      fetcher: () => supabaseAdapter.getInvoiceWithItemsById(invoiceId, invoiceItemsColumns)
    });
  },

  async getInvoiceItemsByInvoiceId(invoiceId) {
    return readThroughCache({
      cacheKey: buildCacheKey(['invoice', invoiceId, 'items']),
      enabled: shouldUseCriticalInvoicesReadCache(),
      fetcher: () => supabaseAdapter.getInvoiceItemsByInvoiceId(invoiceId)
    });
  },

  async getDaneCities({ searchTerm = '', limit = 50 } = {}) {
    const normalizedSearchTerm = String(searchTerm || '').trim().toLowerCase();
    return readThroughCache({
      cacheKey: buildCacheKey(['dane_cities', normalizedSearchTerm, limit]),
      enabled: false,
      fetcher: () => supabaseAdapter.getDaneCities({ searchTerm, limit })
    });
  }
};

export default readAdapter;
