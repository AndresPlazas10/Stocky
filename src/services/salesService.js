/**
 * 🛒 SERVICIO DE VENTAS
 * Centraliza toda la lógica de ventas con manejo robusto de errores
 */

import { supabaseAdapter } from '../data/adapters/supabaseAdapter.js';
import { isAdminRole } from '../utils/roles.js';
import { buildUtcRangeFromLocalDates } from '../utils/dateRange.js';
import { logger } from '../utils/logger.js';

const SALES_LIST_COLUMNS = `
  id,
  business_id,
  user_id,
  seller_name,
  payment_method,
  amount_received,
  change_amount,
  change_breakdown,
  customer_id,
  notes,
  total,
  created_at
`;
const SALES_LIST_MINIMAL_COLUMNS = `
  id,
  business_id,
  user_id,
  seller_name,
  payment_method,
  customer_id,
  notes,
  total,
  created_at
`;

const SALES_RPC_NOT_AVAILABLE = 'SALES_RPC_NOT_AVAILABLE';
let salesRpcDisabled = false;

function buildSalesListCacheKey({ businessId, filters = {}, pagination = {} }) {
  return [
    'sales',
    'list',
    businessId,
    JSON.stringify({
      fromDate: filters?.fromDate || null,
      toDate: filters?.toDate || null,
      paymentMethod: filters?.paymentMethod || null,
      employeeId: filters?.employeeId || null,
      customerId: filters?.customerId || null,
      minAmount: filters?.minAmount ?? null,
      maxAmount: filters?.maxAmount ?? null,
      limit: Number(pagination?.limit || 50),
      offset: Number(pagination?.offset || 0),
      includeCount: pagination?.includeCount !== false,
      countMode: pagination?.countMode || 'planned'
    })
  ].join(':');
}

async function readCachedSalesList(cacheKey) {
  void cacheKey;
  return null;
}

async function writeCachedSalesList(cacheKey, payload) {
  void cacheKey;
  void payload;
}

function isConnectivityError(errorLike) {
  const message = String(errorLike?.message || errorLike || '').toLowerCase();
  return (
    message.includes('failed to fetch')
    || message.includes('networkerror')
    || message.includes('network request failed')
    || message.includes('fetch failed')
    || message.includes('load failed')
    || message.includes('network')
  );
}

function isMissingSalesRpcError(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || '').toLowerCase();
  return code === 'PGRST202' || code === '42883' || message.includes('get_sales_enriched');
}

function isRpcBadRequestError(errorLike) {
  const status = Number(errorLike?.status || errorLike?.statusCode || 0);
  const code = String(errorLike?.code || '').toUpperCase();
  return status === 400 || code === 'PGRST100' || code === 'PGRST116' || code === 'PGRST301';
}

function isMissingColumnError(errorLike) {
  const message = String(errorLike?.message || errorLike || '').toLowerCase();
  return message.includes('column') && message.includes('does not exist');
}

function normalizeOptionalText(value) {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function normalizeOptionalAmount(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapRpcSalesRows(rows = [], includeCount = true) {
  const data = rows.map((row) => {
    const employeeRole = row.employee_role || 'employee';
    const isOwner = !!row.is_owner;
    const isAdmin = isAdminRole(employeeRole);

    return {
      id: row.id,
      business_id: row.business_id,
      user_id: row.user_id,
      seller_name: row.seller_name,
      payment_method: row.payment_method,
      amount_received: row.amount_received ?? null,
      change_amount: row.change_amount ?? null,
      change_breakdown: row.change_breakdown ?? [],
      customer_id: row.customer_id,
      customer_name: row.customer_name,
      customer_email: row.customer_email,
      customer_id_number: row.customer_id_number,
      notes: row.notes,
      total: row.total,
      created_at: row.created_at,
      employees: isOwner
        ? { full_name: 'Administrador', role: 'owner' }
        : isAdmin
        ? { full_name: 'Administrador', role: 'admin' }
        : {
            full_name: row.employee_full_name || row.seller_name || 'Empleado',
            role: employeeRole
          }
    };
  });

  return {
    data,
    count: includeCount ? Number(rows[0]?.total_count || 0) : null
  };
}

/**
 * Valida y obtiene la sesión actual del usuario
 * @returns {Promise<{user: object, error: null} | {user: null, error: string}>}
 */
export async function getCurrentUser() {
  try {
    const { data: { user }, error } = await supabaseAdapter.getCurrentUser();
    
    if (error) {
      // Error obteniendo usuario
      return { user: null, error: error.message };
    }
    
    if (!user || !user.id) {
      return { user: null, error: 'Sesión no válida' };
    }
    
    return { user, error: null };
  } catch (err) {
    // Error crítico en getCurrentUser
    return { user: null, error: err.message };
  }
}

/**
 * Obtiene las ventas de un negocio con información enriquecida
 * @param {string} businessId - ID del negocio
 * @returns {Promise<Array>} Ventas con datos de empleados
 */
export async function getSales(businessId) {
  try {
    // 1. Validar sesión
    const { error: userError } = await getCurrentUser();
    if (userError) throw new Error(userError);

    // 2. Obtener ventas
    const { data: sales, error: salesError } = await supabaseAdapter.getRecentSalesByBusiness({
      businessId,
      selectSql: SALES_LIST_COLUMNS,
      limit: 50
    });

    if (salesError) throw salesError;

    // 3-4. Obtener info adicional en paralelo
    const [{ data: business }, { data: employees }] = await Promise.all([
      supabaseAdapter.getBusinessById(businessId, 'created_by, name'),
      supabaseAdapter.getEmployeesByBusinessWithSelect(businessId, 'user_id, full_name, role')
    ]);

    // 5. Crear mapa de empleados
    const employeeMap = new Map();
    employees?.forEach(emp => {
      if (emp.user_id) {
        employeeMap.set(emp.user_id, {
          full_name: emp.full_name || 'Empleado',
          role: emp.role || 'employee'
        });
      }
    });

    // 6. Enriquecer ventas con info de empleados
    const enrichedSales = (sales || []).map(sale => {
      // Validar que user_id existe
      const userId = sale.user_id;
      const employee = userId ? employeeMap.get(userId) : null;
      
      // Determinar si es owner
      const isOwner = userId && business?.created_by && 
                      String(userId).trim() === String(business.created_by).trim();
      
      // Determinar si es admin
      const isAdmin = isAdminRole(employee?.role);

      return {
        ...sale,
        employees: isOwner
          ? { full_name: 'Administrador', role: 'owner' }
          : isAdmin
          ? { full_name: 'Administrador', role: 'admin' }
          : employee || { 
              full_name: sale.seller_name || 'Empleado', 
              role: 'employee' 
            }
      };
    });

    return enrichedSales;
  } catch {
    // Error en getSales
    return [];
  }
}

/**
 * Obtiene ventas aplicando filtros en la base de datos (no en memoria).
 * @param {string} businessId - ID del negocio (requerido)
 * @param {object} filters - { fromDate, toDate, paymentMethod, employeeId, minAmount, maxAmount, customerId }
 * @param {object} pagination - { limit = 50, offset = 0 }
 * @returns {Promise<{data: Array, count: number}>}
 */
export async function getFilteredSales(businessId, filters = {}, pagination = {}) {
  if (!businessId) return { data: [], count: 0, error: null };
  const cacheKey = buildSalesListCacheKey({
    businessId,
    filters,
    pagination
  });
  const offlineRuntime = typeof navigator !== 'undefined' && navigator.onLine === false;

  const limit = Number(pagination.limit || 50);
  const offset = Number(pagination.offset || 0);
  const includeCount = pagination.includeCount !== false;
  const countMode = pagination.countMode || 'planned';

  const { fromIso: fromDateIso, toIso: toDateIso } = buildUtcRangeFromLocalDates(
    filters.fromDate,
    filters.toDate
  );
  const normalizedPaymentMethod = normalizeOptionalText(filters.paymentMethod);
  const normalizedEmployeeId = normalizeOptionalText(filters.employeeId);
  const normalizedCustomerId = normalizeOptionalText(filters.customerId);
  const normalizedMinAmount = normalizeOptionalAmount(filters.minAmount);
  const normalizedMaxAmount = normalizeOptionalAmount(filters.maxAmount);

  if (offlineRuntime) {
    const cached = await readCachedSalesList(cacheKey);
    if (cached && Array.isArray(cached?.data)) {
      return {
        data: cached.data,
        count: Number.isFinite(Number(cached?.count)) ? Number(cached.count) : 0,
        error: null
      };
    }
    return { data: [], count: 0, error: null };
  }

  try {
    if (!salesRpcDisabled) {
      const { data: rpcRows, error: rpcError } = await supabaseAdapter.getSalesEnrichedRpc({
        p_business_id: businessId,
        p_limit: limit,
        p_offset: offset,
        p_from_date: fromDateIso,
        p_to_date: toDateIso,
        p_payment_method: normalizedPaymentMethod,
        p_user_id: normalizedEmployeeId,
        p_customer_id: normalizedCustomerId,
        p_min_amount: normalizedMinAmount,
        p_max_amount: normalizedMaxAmount,
        p_include_count: includeCount
      });

      if (rpcError) {
        if (isMissingSalesRpcError(rpcError) || isRpcBadRequestError(rpcError)) {
          salesRpcDisabled = true;
          logger.warn('[sales-service] disabling get_sales_enriched RPC fallback after remote error', {
            code: rpcError?.code || null,
            status: rpcError?.status || rpcError?.statusCode || null,
            message: rpcError?.message || String(rpcError)
          });
          throw new Error(SALES_RPC_NOT_AVAILABLE);
        }
        throw rpcError;
      }

      const mapped = mapRpcSalesRows(rpcRows || [], includeCount);
      await writeCachedSalesList(cacheKey, mapped);
      return { ...mapped, error: null };
    }

    throw new Error(SALES_RPC_NOT_AVAILABLE);
  } catch (rpcErr) {
    try {
      const queryParams = {
        businessId,
        fromDateIso,
        toDateIso,
        paymentMethod: normalizedPaymentMethod,
        employeeId: normalizedEmployeeId,
        customerId: normalizedCustomerId,
        minAmount: normalizedMinAmount,
        maxAmount: normalizedMaxAmount,
        limit,
        offset,
        includeCount,
        countMode
      };

      let sales = null;
      let count = null;
      {
        const primary = await supabaseAdapter.getFilteredSalesLegacy({
          ...queryParams,
          selectSql: SALES_LIST_COLUMNS
        });
        if (primary.error) {
          if (!isMissingColumnError(primary.error)) throw primary.error;
          const fallback = await supabaseAdapter.getFilteredSalesLegacy({
            ...queryParams,
            selectSql: SALES_LIST_MINIMAL_COLUMNS
          });
          if (fallback.error) throw fallback.error;
          sales = fallback.data;
          count = fallback.count;
        } else {
          sales = primary.data;
          count = primary.count;
        }
      }

      if (!sales || sales.length === 0) {
        return { data: [], count: includeCount ? (count || 0) : null, error: null };
      }

      const [{ data: employees }, { data: business }] = await Promise.all([
        supabaseAdapter.getEmployeesByBusinessWithSelect(businessId, 'user_id, full_name, role'),
        supabaseAdapter.getBusinessById(businessId, 'created_by')
      ]);

      const employeeMap = new Map();
      employees?.forEach(emp => {
        if (emp.user_id) {
          employeeMap.set(emp.user_id, {
            full_name: emp.full_name || 'Empleado',
            role: emp.role
          });
        }
      });

      const enriched = (sales || []).map(sale => {
        const employee = sale.user_id ? employeeMap.get(sale.user_id) : null;
        const isOwner = sale.user_id && business?.created_by &&
                        String(sale.user_id).trim() === String(business.created_by).trim();
        const isAdmin = isAdminRole(employee?.role);

        return {
          ...sale,
          employees: isOwner
            ? { full_name: 'Administrador', role: 'owner' }
            : isAdmin
            ? { full_name: 'Administrador', role: 'admin' }
            : employee || {
                full_name: sale.seller_name || 'Empleado',
                role: 'employee'
              }
        };
      });

      const legacyResult = { data: enriched, count: includeCount ? (count || 0) : null };
      await writeCachedSalesList(cacheKey, legacyResult);
      return { ...legacyResult, error: null };
    } catch (legacyError) {
      if (isConnectivityError(legacyError) || isConnectivityError(rpcErr)) {
        const cached = await readCachedSalesList(cacheKey);
        if (cached && Array.isArray(cached?.data)) {
          return {
            data: cached.data,
            count: Number.isFinite(Number(cached?.count)) ? Number(cached.count) : 0,
            error: null
          };
        }
      }
      const normalizedError = legacyError?.message || rpcErr?.message || 'Error al obtener ventas';
      return { data: [], count: 0, error: normalizedError };
    }
  }
}

/**
 * Crea una nueva venta
 * @param {object} params - Parámetros de la venta
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export async function createSale({
  businessId,
  cart,
  paymentMethod,
  total
}) {
  try {
    // 1. Validar sesión
    const { user, error: userError } = await getCurrentUser();
    if (userError) {
      return { success: false, error: userError };
    }

    // 2. Validar carrito
    if (!cart || cart.length === 0) {
      return { success: false, error: 'El carrito está vacío' };
    }

    // 3. Obtener info del empleado (incluye role) y created_by del negocio
    const [{ data: employee }, { data: business }] = await Promise.all([
      supabaseAdapter.getEmployeeByUserAndBusiness(user.id, businessId, 'id, full_name, role'),
      supabaseAdapter.getBusinessById(businessId, 'created_by')
    ]);

    // 4. Preparar datos de venta
    // Determinar nombre del vendedor: si es owner/admin -> 'Administrador'
    const isOwner = user.id && business?.created_by && String(user.id).trim() === String(business.created_by).trim();
    const isAdmin = isAdminRole(employee?.role);

    const sellerName = isOwner || isAdmin
      ? 'Administrador'
      : (employee?.full_name || user.email || 'Vendedor');

    const saleData = {
      business_id: businessId,
      user_id: user.id,
      seller_name: sellerName,
      payment_method: paymentMethod || 'cash',
      total: total || 0
    };

    // Creando venta

    // 5. Insertar venta
    const { data: sale, error: saleError } = await supabaseAdapter.insertSale(saleData);

    if (saleError) {
      // Error insertando venta
      return { success: false, error: saleError.message };
    }

    // 6. Insertar detalles de venta
    const saleDetails = cart.map(item => ({
      sale_id: sale.id,
      product_id: item.product_id || null,
      combo_id: item.combo_id || null,
      quantity: item.quantity,
      unit_price: item.unit_price
    }));

    const { error: detailsError } = await supabaseAdapter.insertSaleDetails(saleDetails);

    if (detailsError) {
      // Error insertando detalles
      // Intentar revertir la venta
      await supabaseAdapter.deleteSaleById(sale.id);
      return { success: false, error: detailsError.message };
    }

    // 7. Reducir stock de productos en BATCH (OPTIMIZADO)
    // CAMBIO: De 10 queries secuenciales a 1 sola llamada RPC
    const stockUpdates = cart
      .filter((item) => item.product_id)
      .map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity
      }));

    const { error: stockError } = stockUpdates.length > 0
      ? await supabaseAdapter.updateStockBatch(stockUpdates)
      : { error: null };

    if (stockError) {
      // Error crítico: revertir venta
      await supabaseAdapter.deleteSaleById(sale.id);
      return { 
        success: false, 
        error: `Error al actualizar inventario: ${stockError.message}` 
      };
    }

    return { 
      success: true, 
      data: sale
    };
  } catch (error) {
    // Error en createSale
    return { success: false, error: error.message };
  }
}

/**
 * Obtiene productos disponibles para venta
 * @param {string} businessId - ID del negocio
 * @returns {Promise<Array>} Lista de productos
 */
export async function getAvailableProducts(businessId) {
  try {
    const { data, error } = await supabaseAdapter.getAvailableProductsForSaleByBusiness(businessId);

    if (error) throw error;
    return data || [];
  } catch {
    // Error obteniendo productos
    return [];
  }
}

/**
 * Elimina una venta (solo admin)
 * @param {string} saleId - ID de la venta
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function deleteSale(saleId) {
  try {
    // Validar sesión
    const { error: userError } = await getCurrentUser();
    if (userError) {
      return { success: false, error: userError };
    }

    // Primero obtener los detalles para restaurar stock
    const { data: details } = await supabaseAdapter.getSaleDetailsBySaleIdWithSelect(
      saleId,
      'product_id, quantity'
    );

    // Eliminar la venta (cascade eliminará los detalles)
    const { error: deleteError } = await supabaseAdapter.deleteSaleById(saleId);

    if (deleteError) {
      // Error eliminando venta
      return { success: false, error: deleteError.message };
    }

    // Restaurar stock en BATCH (OPTIMIZADO)
    if (details && details.length > 0) {
      const productUpdates = details
        .filter((d) => d.product_id)
        .map((d) => ({
          product_id: d.product_id,
          quantity: d.quantity
        }));

      const { error: restoreError } = productUpdates.length > 0
        ? await supabaseAdapter.restoreStockBatch(productUpdates)
        : { error: null };
      
      if (restoreError) {
        // Log error pero no fallar (venta ya fue eliminada)
      }
    }

    return { success: true };
  } catch (error) {
    // Error en deleteSale
    return { success: false, error: error.message };
  }
}
