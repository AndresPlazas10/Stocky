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

    return { success: true, data: sale };
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
