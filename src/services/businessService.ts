import { supabaseAdapter } from '../data/adapters/supabaseAdapter.js';

interface BusinessRow {
  id: string;
  name: string;
  username: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  created_by: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ServiceResult<T> {
  success: boolean;
  data: T | null;
  message: string;
}

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

export async function getCurrentBusiness(): Promise<ServiceResult<BusinessRow>> {
  try {
    const { data: { user }, error: userError } = await supabaseAdapter.getCurrentUser();
    
    if (userError) throw userError;
    if (!user) throw new Error('❌ Usuario no autenticado');

    const { data: business, error: businessError } = await supabaseAdapter.getBusinessByEmail(
      user.email!,
      BUSINESS_COLUMNS
    );

    if (businessError) throw businessError;

    return {
      success: true,
      data: business as unknown as BusinessRow,
      message: 'Información del negocio obtenida exitosamente'
    };

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al obtener la información del negocio';
    return {
      success: false,
      data: null,
      message
    };
  }
}

export async function getAllBusinesses(): Promise<ServiceResult<BusinessRow[]>> {
  try {
    const { data: { user }, error: userError } = await supabaseAdapter.getCurrentUser();
    
    if (userError) throw userError;
    if (!user) throw new Error('❌ Usuario no autenticado');

    const { data: businesses, error: businessError } = await supabaseAdapter.getBusinessesByOwnerId(
      user.id,
      BUSINESS_COLUMNS
    );

    if (businessError) throw businessError;

    return {
      success: true,
      data: (businesses as unknown as BusinessRow[]) ?? null,
      message: 'Negocios obtenidos exitosamente'
    };

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al obtener los negocios';
    return {
      success: false,
      data: null,
      message
    };
  }
}
