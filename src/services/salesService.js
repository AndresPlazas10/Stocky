/**
 * 🛒 SERVICIO DE VENTAS
 * Centraliza toda la lógica de ventas con manejo robusto de errores
 */

import { supabase } from '../supabase/Client';
import { isAdminRole } from '../utils/roles.js';

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

const SALES_RPC_NOT_AVAILABLE = 'SALES_RPC_NOT_AVAILABLE';

function isMissingSalesRpcError(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || '').toLowerCase();
  return code === 'PGRST202' || code === '42883' || message.includes('get_sales_enriched');
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
    const { data: { user }, error } = await supabase.auth.getUser();
    
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
    const { data: sales, error: salesError } = await supabase
      .from('sales')
      .select(SALES_LIST_COLUMNS)
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (salesError) throw salesError;

    // 3-4. Obtener info adicional en paralelo
    const [{ data: business }, { data: employees }] = await Promise.all([
      supabase
        .from('businesses')
        .select('created_by, name')
        .eq('id', businessId)
        .maybeSingle(),
      supabase
        .from('employees')
        .select('user_id, full_name, role')
        .eq('business_id', businessId)
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

  const limit = Number(pagination.limit || 50);
  const offset = Number(pagination.offset || 0);
  const includeCount = pagination.includeCount !== false;
  const countMode = pagination.countMode || 'exact';

  const toDateIso = filters.toDate
    ? (() => {
        const endDate = new Date(filters.toDate);
        endDate.setHours(23, 59, 59, 999);
        return endDate.toISOString();
      })()
    : null;

  try {
    const { data: rpcRows, error: rpcError } = await supabase.rpc('get_sales_enriched', {
      p_business_id: businessId,
      p_limit: limit,
      p_offset: offset,
      p_from_date: filters.fromDate || null,
      p_to_date: toDateIso,
      p_payment_method: filters.paymentMethod || null,
      p_user_id: filters.employeeId || null,
      p_customer_id: filters.customerId || null,
      p_min_amount: filters.minAmount ?? null,
      p_max_amount: filters.maxAmount ?? null,
      p_include_count: includeCount
    });

    if (rpcError) {
      if (isMissingSalesRpcError(rpcError)) {
        throw new Error(SALES_RPC_NOT_AVAILABLE);
      }
      throw rpcError;
    }

    const mapped = mapRpcSalesRows(rpcRows || [], includeCount);
    return { ...mapped, error: null };
  } catch (rpcErr) {
    try {
      let query = includeCount
        ? supabase.from('sales').select(SALES_LIST_COLUMNS, { count: countMode })
        : supabase.from('sales').select(SALES_LIST_COLUMNS);
      query = query.eq('business_id', businessId).order('created_at', { ascending: false });

      if (filters.fromDate) query = query.gte('created_at', filters.fromDate);
      if (filters.toDate) query = query.lte('created_at', toDateIso);
      if (filters.paymentMethod) query = query.eq('payment_method', filters.paymentMethod);
      if (filters.employeeId) query = query.eq('user_id', filters.employeeId);
      if (filters.customerId) query = query.eq('customer_id', filters.customerId);
      if (filters.minAmount) query = query.gte('total', filters.minAmount);
      if (filters.maxAmount) query = query.lte('total', filters.maxAmount);

      query = query.range(offset, offset + limit - 1);

      const { data: sales, error, count } = await query;
      if (error) throw error;

      if (!sales || sales.length === 0) {
        return { data: [], count: includeCount ? (count || 0) : null, error: null };
      }

      const [{ data: employees }, { data: business }] = await Promise.all([
        supabase
          .from('employees')
          .select('user_id, full_name, role')
          .eq('business_id', businessId)
          .limit(100),
        supabase
          .from('businesses')
          .select('created_by')
          .eq('id', businessId)
          .maybeSingle()
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

      return { data: enriched, count: includeCount ? (count || 0) : null, error: null };
    } catch (legacyError) {
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
      supabase
        .from('employees')
        .select('id, full_name, role')
        .eq('user_id', user.id)
        .eq('business_id', businessId)
        .maybeSingle(),
      supabase
        .from('businesses')
        .select('created_by')
        .eq('id', businessId)
        .maybeSingle()
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
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert([saleData])
      .select()
      .single();

    if (saleError) {
      // Error insertando venta
      return { success: false, error: saleError.message };
    }

    // 6. Insertar detalles de venta
    const saleDetails = cart.map(item => ({
      sale_id: sale.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price
    }));

    const { error: detailsError } = await supabase
      .from('sale_details')
      .insert(saleDetails);

    if (detailsError) {
      // Error insertando detalles
      // Intentar revertir la venta
      await supabase.from('sales').delete().eq('id', sale.id);
      return { success: false, error: detailsError.message };
    }

    // 7. Reducir stock de productos en BATCH (OPTIMIZADO)
    // CAMBIO: De 10 queries secuenciales a 1 sola llamada RPC
    const { error: stockError } = await supabase.rpc('update_stock_batch', {
      product_updates: cart.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity
      }))
    });

    if (stockError) {
      // Error crítico: revertir venta
      await supabase.from('sales').delete().eq('id', sale.id);
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
    const { data, error } = await supabase
      .from('products')
      .select('id, code, name, sale_price, stock, category, is_active')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .gt('stock', 0)
      .order('name');

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
    const { data: details } = await supabase
      .from('sale_details')
      .select('product_id, quantity')
      .eq('sale_id', saleId);

    // Eliminar la venta (cascade eliminará los detalles)
    const { error: deleteError } = await supabase
      .from('sales')
      .delete()
      .eq('id', saleId);

    if (deleteError) {
      // Error eliminando venta
      return { success: false, error: deleteError.message };
    }

    // Restaurar stock en BATCH (OPTIMIZADO)
    if (details && details.length > 0) {
      const { error: restoreError } = await supabase.rpc('restore_stock_batch', {
        product_updates: details.map(d => ({
          product_id: d.product_id,
          quantity: d.quantity
        }))
      });
      
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
