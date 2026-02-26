import { supabaseAdapter } from '../data/adapters/supabaseAdapter.js';

const BUSINESS_COLUMNS = `
  id,
  name,
  username,
  email,
  phone,
  address,
  created_by,
  is_active,
  created_at,
  updated_at
`;

/**
 * Crea un nuevo negocio en la tabla businesses
 * @param {Object} businessData - Datos del negocio
 * @param {string} businessData.name - Nombre del negocio (requerido)
 * @param {string} businessData.address - Dirección del negocio (opcional)
 * @param {string} businessData.phone - Teléfono del negocio (opcional)
 * @param {string} businessData.email - Email del negocio (opcional)
 * @returns {Promise<Object>} - Resultado de la operación
 */
export async function setBusiness(businessData) {
  try {
    // Validar campos requeridos
    if (!businessData.name) {
      throw new Error('❌ El nombre del negocio es requerido');
    }

    // Obtener el usuario actual autenticado
    const { data: { user }, error: userError } = await supabaseAdapter.getCurrentUser();
    
    if (userError) throw userError;
    
    if (!user) {
      throw new Error('❌ Usuario no autenticado');
    }

    // Validar si ya existe un negocio con el mismo email
    if (businessData.email) {
      const { data: existingEmail, error: emailError } = await supabaseAdapter.getBusinessByEmail(
        businessData.email,
        'id, email'
      );

      if (emailError && emailError.code !== 'PGRST116') { // PGRST116 = no se encontraron filas
        throw emailError;
      }

      if (existingEmail) {
        throw new Error('❌ Ya existe un negocio registrado con este correo electrónico');
      }
    }

    // Insertar el negocio en la tabla businesses
    const { data, error } = await supabaseAdapter.insertBusiness({
      name: businessData.name,
      address: businessData.address || null,
      phone: businessData.phone || null,
      email: businessData.email || null,
      created_by: user.id,
      created_at: new Date().toISOString()
    });

    if (error) throw error;

    return {
      success: true,
      data,
      message: 'Negocio creado exitosamente'
    };

  } catch (error) {
    return {
      success: false,
      data: null,
      message: error.message || 'Error al crear el negocio'
    };
  }
}

/**
 * Obtiene todos los negocios del usuario actual
 * @returns {Promise<Object>} - Lista de negocios
 */
export async function getBusinesses() {
  try {
    const { data: { user }, error: userError } = await supabaseAdapter.getCurrentUser();
    
    if (userError) throw userError;
    if (!user) throw new Error('❌ Usuario no autenticado');

    const { data, error } = await supabaseAdapter.getBusinessesByOwnerId(user.id, BUSINESS_COLUMNS);

    if (error) throw error;

    return {
      success: true,
      data: data,
      message: 'Negocios obtenidos exitosamente'
    };

  } catch (error) {
    return {
      success: false,
      data: null,
      message: error.message || 'Error al obtener los negocios'
    };
  }
}

/**
 * Obtiene un negocio por su ID
 * @param {string} businessId - ID del negocio
 * @returns {Promise<Object>} - Datos del negocio
 */
export async function getBusinessById(businessId) {
  try {
    if (!businessId) {
      throw new Error('❌ El ID del negocio es requerido');
    }

    const { data, error } = await supabaseAdapter.getBusinessById(businessId, BUSINESS_COLUMNS);

    if (error) throw error;

    return {
      success: true,
      data: data,
      message: 'Negocio obtenido exitosamente'
    };

  } catch (error) {
    return {
      success: false,
      data: null,
      message: error.message || 'Error al obtener el negocio'
    };
  }
}

/**
 * Actualiza un negocio existente
 * @param {string} businessId - ID del negocio
 * @param {Object} updates - Campos a actualizar
 * @returns {Promise<Object>} - Resultado de la operación
 */
export async function updateBusiness(businessId, updates) {
  try {
    if (!businessId) {
      throw new Error('❌ El ID del negocio es requerido');
    }

    const { data, error } = await supabaseAdapter.updateBusinessById(businessId, updates);

    if (error) throw error;

    return {
      success: true,
      data,
      message: 'Negocio actualizado exitosamente'
    };

  } catch (error) {
    return {
      success: false,
      data: null,
      message: error.message || 'Error al actualizar el negocio'
    };
  }
}

/**
 * Elimina un negocio
 * @param {string} businessId - ID del negocio
 * @returns {Promise<Object>} - Resultado de la operación
 */
export async function deleteBusiness(businessId) {
  try {
    if (!businessId) {
      throw new Error('❌ El ID del negocio es requerido');
    }

    const { error } = await supabaseAdapter.deleteBusinessById(businessId);

    if (error) throw error;

    return {
      success: true,
      data: null,
      message: 'Negocio eliminado exitosamente'
    };

  } catch (error) {
    return {
      success: false,
      data: null,
      message: error.message || 'Error al eliminar el negocio'
    };
  }
}
