import { supabaseAdapter } from '../adapters/supabaseAdapter';

export async function updateBusinessLogo({ businessId, logoUrl }) {
  const { error } = await supabaseAdapter.updateBusinessLogoById(businessId, logoUrl);
  if (error) throw error;
  return true;
}

export async function updateBusinessProfile({
  businessId,
  payload
}) {
  const { data, error } = await supabaseAdapter.updateBusinessById(businessId, payload);
  if (error) throw error;
  return data || null;
}
