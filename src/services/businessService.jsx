import { supabase } from '../supabase/Client.jsx';

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
 * Obtiene la información del negocio del usuario autenticado
 * @returns {Promise<Object>} - Información del negocio
 */
export async function getCurrentBusiness() {
  try {
    // Obtener el usuario autenticado
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError) throw userError;
    if (!user) throw new Error('❌ Usuario no autenticado');

    // Buscar el negocio por email del usuario
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select(BUSINESS_COLUMNS)
      .eq('email', user.email)
      .single();

    if (businessError) throw businessError;

    return {
      success: true,
      data: business,
      message: 'Información del negocio obtenida exitosamente'
    };

  } catch (error) {
    return {
      success: false,
      data: null,
      message: error.message || 'Error al obtener la información del negocio'
    };
  }
}

/**
 * Obtiene todos los negocios creados por el usuario
 * @returns {Promise<Object>} - Lista de negocios
 */
export async function getAllBusinesses() {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError) throw userError;
    if (!user) throw new Error('❌ Usuario no autenticado');

    const { data: businesses, error: businessError } = await supabase
      .from('businesses')
      .select(BUSINESS_COLUMNS)
      .eq('created_by', user.id)
      .order('created_at', { ascending: false });

    if (businessError) throw businessError;

    return {
      success: true,
      data: businesses,
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
