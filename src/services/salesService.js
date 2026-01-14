/**
 * 🛒 SERVICIO DE VENTAS
 * Centraliza toda la lógica de ventas con manejo robusto de errores
 */

import { supabase } from '../supabase/Client';

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
    const { user, error: userError } = await getCurrentUser();
    if (userError) throw new Error(userError);

    // 2. Obtener ventas
    const { data: sales, error: salesError } = await supabase
      .from('sales')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (salesError) throw salesError;

    // 3. Obtener info del negocio
    const { data: business } = await supabase
      .from('businesses')
      .select('created_by, name')
      .eq('id', businessId)
      .maybeSingle();

    // 4. Obtener empleados del negocio
    const { data: employees } = await supabase
      .from('employees')
      .select('user_id, full_name, role')
      .eq('business_id', businessId);

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
      const isAdmin = employee?.role === 'admin';

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
  } catch (error) {
    // Error en getSales
    return [];
  }
}

/**
 * Obtiene ventas aplicando filtros en la base de datos (no en memoria).
 * @param {string} businessId - ID del negocio (requerido)
 * @param {object} filters - { fromDate, toDate, paymentMethod, employeeId, minAmount, maxAmount, invoiceNumber, status, customerId }
 * @param {object} pagination - { limit = 50, offset = 0 }
 * @returns {Promise<{data: Array, count: number}>}
 */
export async function getFilteredSales(businessId, filters = {}, pagination = {}) {
  try {
    if (!businessId) return { data: [], count: 0 };

    const limit = Number(pagination.limit || 50);
    const offset = Number(pagination.offset || 0);

    // Construir query optimizada - solo seleccionar campos necesarios
    let query = supabase
      .from('sales')
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
    if (filters.paymentMethod) query = query.eq('payment_method', filters.paymentMethod);
    if (filters.employeeId) query = query.eq('user_id', filters.employeeId);
    if (filters.customerId) query = query.eq('customer_id', filters.customerId);

    // Filtros de monto
    if (filters.minAmount) query = query.gte('total', filters.minAmount);
    if (filters.maxAmount) query = query.lte('total', filters.maxAmount);

    // Aplicar paginación
    query = query.range(offset, offset + limit - 1);

    const { data: sales, error, count } = await query;
    if (error) throw error;

    // Enriquecer con empleados de forma optimizada
    const { data: employees } = await supabase
      .from('employees')
      .select('user_id, full_name, role')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .limit(100);

    // Obtener created_by del negocio para identificar owner
    const { data: business } = await supabase
      .from('businesses')
      .select('created_by')
      .eq('id', businessId)
      .maybeSingle();

    // Crear mapa de empleados para acceso O(1)
    const employeeMap = new Map();
    employees?.forEach(emp => {
      if (emp.user_id) {
        employeeMap.set(emp.user_id, { 
          full_name: emp.full_name || 'Empleado', 
          role: emp.role 
        });
      }
    });

    // Enriquecer ventas
    const enriched = (sales || []).map(sale => {
      const employee = sale.user_id ? employeeMap.get(sale.user_id) : null;
      const isOwner = sale.user_id && business?.created_by && 
                      String(sale.user_id).trim() === String(business.created_by).trim();
      const isAdmin = employee?.role === 'admin';

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

    return { data: enriched, count: count || 0 };
  } catch (error) {
    
    return { data: [], count: 0 };
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
  total,
  documentType = 'receipt',
  generateElectronicInvoice = false,
  customerData = null
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

    // 3. Obtener info del empleado
    const { data: employee } = await supabase
      .from('employees')
      .select('id, full_name')
      .eq('user_id', user.id)
      .eq('business_id', businessId)
      .maybeSingle();

    // 4. Preparar datos de venta
    const saleData = {
      business_id: businessId,
      user_id: user.id,
      seller_name: employee?.full_name || user.email || 'Vendedor',
      payment_method: paymentMethod || 'cash',
      total: total || 0,
      document_type: documentType,
      is_electronic_invoice: generateElectronicInvoice
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

    // 7. Reducir stock de productos
    for (const item of cart) {
      const { error: stockError } = await supabase
        .from('products')
        .update({ 
          stock: supabase.raw(`stock - ${item.quantity}`)
        })
        .eq('id', item.product_id);

      if (stockError) {
        // Error actualizando stock (no crítico)
      }
    }

    // 8. Si se solicitó factura electrónica, generarla
    let invoiceResult = null;
    if (generateElectronicInvoice) {
      try {
        invoiceResult = await generateElectronicInvoiceForSale(sale.id, businessId, cart, total, paymentMethod, customerData);
        
        if (!invoiceResult.success) {
          // La factura falló pero la venta ya está registrada
          // Actualizamos la venta para indicar que la factura falló
          await supabase
            .from('sales')
            .update({ 
              invoice_status: 'failed',
              invoice_error: invoiceResult.error
            })
            .eq('id', sale.id);
        } else {
          // Actualizar venta con datos de factura
          await supabase
            .from('sales')
            .update({ 
              invoice_status: 'success',
              cufe: invoiceResult.cufe,
              invoice_number: invoiceResult.invoiceNumber,
              invoice_pdf_url: invoiceResult.pdfUrl
            })
            .eq('id', sale.id);
        }
      } catch (invoiceError) {
        // Error generando factura (la venta ya está registrada)
        console.error('Error generando factura electrónica:', invoiceError);
      }
    }

    return { 
      success: true, 
      data: sale,
      invoice: invoiceResult
    };
  } catch (error) {
    // Error en createSale
    return { success: false, error: error.message };
  }
}

/**
 * Genera factura electrónica para una venta
 * @param {string} saleId - ID de la venta
 * @param {string} businessId - ID del negocio
 * @param {Array} cart - Items del carrito
 * @param {number} total - Total de la venta
 * @param {string} paymentMethod - Método de pago
 * @param {object} customerData - Datos del cliente (opcional)
 * @returns {Promise<{success: boolean, cufe?: string, invoiceNumber?: string, pdfUrl?: string, error?: string}>}
 */
async function generateElectronicInvoiceForSale(saleId, businessId, cart, total, paymentMethod, customerData) {
  try {
    // Obtener token de sesión
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return { success: false, error: 'Sesión no válida' };
    }

    // URL de la Edge Function de Siigo
    const SIIGO_FUNCTION_URL = import.meta.env.VITE_SUPABASE_URL + '/functions/v1/siigo-invoice';

    // Preparar datos para la factura
    const invoiceData = {
      action: 'create',
      businessId: businessId,
      customer: customerData || {
        // Cliente genérico si no se especifica
        identification: '222222222222',
        id_type: 'CC',
        name: ['Consumidor', 'Final'],
        address: {
          city_code: '11001', // Bogotá por defecto
          address: 'Calle Principal'
        }
      },
      items: cart.map(item => ({
        code: item.product_id,
        description: item.name,
        quantity: item.quantity,
        price: item.unit_price,
        tax_rate: 0 // Por defecto sin IVA, ajustar según producto
      })),
      payment: {
        method: paymentMethod === 'cash' ? 'CASH' : 
                paymentMethod === 'card' ? 'CREDIT_CARD' : 
                paymentMethod === 'transfer' ? 'TRANSFER' : 'CASH'
      },
      sale_id: saleId
    };

    // Llamar a la Edge Function
    const response = await fetch(SIIGO_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify(invoiceData)
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      return { 
        success: false, 
        error: result.error || 'Error generando factura electrónica'
      };
    }

    return {
      success: true,
      cufe: result.cufe,
      invoiceNumber: result.invoice_number,
      pdfUrl: result.pdf_url,
      qrCode: result.qr_code
    };
  } catch (error) {
    console.error('Error en generateElectronicInvoiceForSale:', error);
    return { 
      success: false, 
      error: error.message || 'Error inesperado generando factura'
    };
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
      .select('*')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .gt('stock', 0)
      .order('name');

    if (error) throw error;
    return data || [];
  } catch (error) {
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
    const { user, error: userError } = await getCurrentUser();
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

    // Restaurar stock
    if (details) {
      for (const detail of details) {
        await supabase
          .from('products')
          .update({ 
            stock: supabase.raw(`stock + ${detail.quantity}`)
          })
          .eq('id', detail.product_id);
      }
    }

    return { success: true };
  } catch (error) {
    // Error en deleteSale
    return { success: false, error: error.message };
  }
}
