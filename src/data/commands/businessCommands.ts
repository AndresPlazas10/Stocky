import { supabaseAdapter } from '../adapters/supabaseAdapter';
import type { Business } from '../../types';

export async function updateBusinessLogo({
  businessId,
  logoUrl
}: {
  businessId: string;
  logoUrl: string;
}): Promise<boolean> {
  const { error } = await supabaseAdapter.updateBusinessLogoById(businessId, logoUrl);
  if (error) throw error;
  return true;
}

export async function updateBusinessProfile({
  businessId,
  payload
}: {
  businessId: string;
  payload: Partial<Business>;
}): Promise<Business | null> {
  const { data, error } = await supabaseAdapter.updateBusinessById(businessId, payload);
  if (error) throw error;
  return data || null;
}
