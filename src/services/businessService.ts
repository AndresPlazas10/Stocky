import { supabaseAdapter } from '../data/adapters/supabaseAdapter.js';
import { BUSINESS_COLUMNS } from '../utils/businessColumns';
import i18n from '../i18n';

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

export async function getCurrentBusiness(): Promise<ServiceResult<BusinessRow>> {
  try {
    const { data: { user }, error: userError } = await supabaseAdapter.getCurrentUser();
    
    if (userError) throw userError;
    if (!user) throw new Error(i18n.t('businessService.errors.userNotAuthenticated'));

    const { data: business, error: businessError } = await supabaseAdapter.getBusinessByEmail(
      user.email!,
      BUSINESS_COLUMNS
    );

    if (businessError) throw businessError;

    return {
      success: true,
      data: business as unknown as BusinessRow,
      message: i18n.t('businessService.success.businessLoaded')
    };

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : i18n.t('businessService.errors.loadBusinessFailed');
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
    if (!user) throw new Error(i18n.t('businessService.errors.userNotAuthenticated'));

    const { data: businesses, error: businessError } = await supabaseAdapter.getBusinessesByOwnerId(
      user.id,
      BUSINESS_COLUMNS
    );

    if (businessError) throw businessError;

    return {
      success: true,
      data: (businesses as unknown as BusinessRow[]) ?? null,
      message: i18n.t('businessService.success.businessesLoaded')
    };

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : i18n.t('businessService.errors.loadBusinessesFailed');
    return {
      success: false,
      data: null,
      message
    };
  }
}
