/**
 * 🚀 SERVICIO DE VENTAS OPTIMIZADO
 * Usa RPC para crear venta en una sola transacción (~100ms en lugar de 1000ms)
 */

import { supabaseAdapter } from '../data/adapters/supabaseAdapter.js';
import { isAdminRole } from '../utils/roles.js';

function isFunctionUnavailableError(errorLike, functionName) {
  const message = String(errorLike?.message || errorLike || '').toLowerCase();
  if (!message) return false;

  const normalizedFn = String(functionName || '').toLowerCase();
  const referencesFunction = normalizedFn ? message.includes(normalizedFn) : true;

  return referencesFunction && (
    message.includes('does not exist')
    || message.includes('could not find the function')
    || message.includes('schema cache')
    || message.includes('not found')
    || message.includes('pgrst202')
  );
}

function getFriendlySaleErrorMessage(errorLike) {
  const rawMessage = String(errorLike?.message || errorLike || '').trim();
  const normalized = rawMessage.toLowerCase();

  if (normalized.includes('idx_sales_prevent_duplicates')) {
    return 'La venta ya estaba siendo procesada o ya fue registrada. Actualiza y verifica en Ventas.';
  }

  return rawMessage || 'Error al procesar la venta';
}

function normalizeReference(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const lowered = raw.toLowerCase();
  if (lowered === 'null' || lowered === 'undefined') return null;
  return raw;
}

function normalizeRpcSaleItem(item = {}) {
  const itemType = String(item?.item_type || '').trim().toLowerCase();
  const fallbackId = normalizeReference(item?.item_id || item?.id || null);

  const explicitProductId = normalizeReference(item?.product_id);
  const explicitComboId = normalizeReference(item?.combo_id);

  // Priorizar referencias explícitas; inferir solo cuando no llega ninguna.
  let productId = explicitProductId;
  let comboId = explicitComboId;

  if (!productId && !comboId) {
    if (itemType === 'combo') comboId = fallbackId;
    if (itemType === 'product') productId = fallbackId;
  }

  const quantity = Number(item?.quantity);
  const unitPrice = Number(item?.unit_price ?? item?.price);

  if ((!productId && !comboId) || (productId && comboId)) {
    throw new Error(
      `Item inválido en carrito: "${item?.name || 'sin nombre'}" ` +
      `(product_id=${productId || 'null'}, combo_id=${comboId || 'null'}, item_type=${itemType || 'null'})`
    );
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error(`Cantidad inválida para "${item?.name || 'item'}"`);
  }
  if (!Number.isFinite(unitPrice) || unitPrice < 0) {
    throw new Error(`Precio inválido para "${item?.name || 'item'}"`);
  }

  return {
    product_id: productId,
    combo_id: comboId,
    quantity,
    unit_price: unitPrice
  };
}

/**
 * Crea una venta completa en UNA SOLA LLAMADA RPC
 * @param {object} params
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export async function createSaleOptimized({
  businessId,
  cart,
  paymentMethod = 'cash',
  total: _total,
  idempotencyKey = null
}) {
  try {
    // 1. Validar inputs
    if (!businessId || !cart || cart.length === 0) {
      return { 
        success: false, 
        error: 'Datos de venta inválidos' 
      };
    }

    // 2. Obtener usuario actual
    const { data: { user }, error: userError } = await supabaseAdapter.getCurrentUser();
    if (userError || !user) {
      return { 
        success: false, 
        error: 'Sesión no válida' 
      };
    }

    // 3. Obtener nombre del empleado y role + created_by del negocio para detectar admin/owner
    const [{ data: employee }, { data: business }] = await Promise.all([
      supabaseAdapter.getEmployeeByUserAndBusiness(user.id, businessId, 'full_name, role'),
      supabaseAdapter.getBusinessById(businessId, 'created_by')
    ]);

    const isOwner = user.id && business?.created_by && String(user.id).trim() === String(business.created_by).trim();
    const isAdmin = isAdminRole(employee?.role);
    const sellerName = isOwner || isAdmin ? 'Administrador' : (employee?.full_name || user.email || 'Vendedor');

    // 4. Preparar items en formato esperado por la función RPC
    const itemsForRpc = cart.map((item) => normalizeRpcSaleItem(item));

    const startTime = performance.now();

    const hasComboItems = itemsForRpc.some((item) => Boolean(item?.combo_id));

    // 5. LLAMADA RPC
    let data = null;
    let error = null;
    if (hasComboItems) {
      ({ data, error } = await supabaseAdapter.createSaleCompleteRpc({
        p_business_id: businessId,
        p_user_id: user.id,
        p_seller_name: sellerName,
        p_payment_method: paymentMethod,
        p_items: itemsForRpc,
        p_amount_received: null,
        p_change_breakdown: []
      }));

      const missingBaseFn = isFunctionUnavailableError(error, 'create_sale_complete');
      if (error && missingBaseFn) {
        ({ data, error } = await supabaseAdapter.createSaleCompleteIdempotentRpc({
          p_business_id: businessId,
          p_user_id: user.id,
          p_seller_name: sellerName,
          p_payment_method: paymentMethod,
          p_items: itemsForRpc,
          p_amount_received: null,
          p_change_breakdown: [],
          p_idempotency_key: idempotencyKey
        }));
      }
    } else {
      ({ data, error } = await supabaseAdapter.createSaleCompleteIdempotentRpc({
        p_business_id: businessId,
        p_user_id: user.id,
        p_seller_name: sellerName,
        p_payment_method: paymentMethod,
        p_items: itemsForRpc,
        p_amount_received: null,
        p_change_breakdown: [],
        p_idempotency_key: idempotencyKey
      }));

      const missingIdempotentFn = isFunctionUnavailableError(
        error,
        'create_sale_complete_idempotent'
      );
      if (error && missingIdempotentFn) {
        ({ data, error } = await supabaseAdapter.createSaleCompleteRpc({
          p_business_id: businessId,
          p_user_id: user.id,
          p_seller_name: sellerName,
          p_payment_method: paymentMethod,
          p_items: itemsForRpc,
          p_amount_received: null,
          p_change_breakdown: []
        }));
      }
    }

    const _elapsed = performance.now() - startTime;

    if (error) {
      return { 
        success: false, 
        error: getFriendlySaleErrorMessage(error)
      };
    }

    if (!data || !data[0] || data[0].status !== 'success') {
      return { 
        success: false, 
        error: 'Respuesta inesperada del servidor' 
      };
    }

    return {
      success: true,
      data: {
        id: data[0].sale_id,
        total: data[0].total_amount,
        items_count: data[0].items_count,
        created_at: new Date().toISOString()
      }
    };

  } catch (err) {
    return { 
      success: false, 
      error: err.message || 'Error al crear la venta' 
    };
  }
}

/**
 * Obtiene la latencia promedio de creaciones de venta (para debugging)
 * Almacena métricas en localStorage
 */
export function recordSaleCreationTime(milliseconds) {
  try {
    const key = 'sale_creation_times';
    const times = JSON.parse(localStorage.getItem(key) || '[]');
    times.push(milliseconds);
    
    // Mantener solo los últimos 20
    if (times.length > 20) times.shift();
    
    localStorage.setItem(key, JSON.stringify(times));
    
  } catch {
    // Ignorar errores de localStorage
  }
}

export function getSaleCreationMetrics() {
  try {
    const times = JSON.parse(localStorage.getItem('sale_creation_times') || '[]');
    if (times.length === 0) return null;
    
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);
    
    return { avg, min, max, count: times.length };
  } catch {
    return null;
  }
}
