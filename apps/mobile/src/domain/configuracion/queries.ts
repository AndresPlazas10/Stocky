import { EXPO_CONFIG } from '../../config/env';
import { getSupabaseClient } from '../../lib/supabase';
import { normalizeText } from '../../utils/normalization';
import { isMissingColumnError } from '../../utils/supabaseErrors';
import type { ConfiguracionSnapshot } from './contracts';

type Input = {
  businessId: string | null;
  businessName: string | null;
  source: 'owner' | 'employee' | null;
  userId: string;
  userEmail: string | null;
};

type BusinessDetails = {
  name: string | null;
  nit: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
};

async function fetchBusinessDetails(
  businessId: string,
  fallbackBusinessName: string | null,
): Promise<BusinessDetails> {
  const client = getSupabaseClient();

  const detailed = await client
    .from('businesses')
    .select('name,nit,email,phone,address')
    .eq('id', businessId)
    .maybeSingle();

  if (!detailed.error) {
    return {
      name: normalizeText(detailed.data?.name) || fallbackBusinessName,
      nit: normalizeText(detailed.data?.nit) || null,
      email: normalizeText(detailed.data?.email) || null,
      phone: normalizeText(detailed.data?.phone) || null,
      address: normalizeText(detailed.data?.address) || null,
    };
  }

  if (!isMissingColumnError(detailed.error)) {
    throw detailed.error;
  }

  const fallback = await client
    .from('businesses')
    .select('name')
    .eq('id', businessId)
    .maybeSingle();

  if (fallback.error) {
    throw fallback.error;
  }

  return {
    name: normalizeText(fallback.data?.name) || fallbackBusinessName,
    nit: null,
    email: null,
    phone: null,
    address: null,
  };
}

export async function listConfiguracionByBusinessId(input: Input): Promise<ConfiguracionSnapshot> {
  const businessDetails = input.businessId
    ? await fetchBusinessDetails(input.businessId, input.businessName)
    : {
        name: input.businessName,
        nit: null,
        email: null,
        phone: null,
        address: null,
      };

  const supabaseConfigured = Boolean(EXPO_CONFIG.supabaseUrl && EXPO_CONFIG.supabaseAnonKey);

  return {
    businessId: input.businessId,
    businessName: businessDetails.name,
    businessNit: businessDetails.nit,
    businessEmail: businessDetails.email,
    businessPhone: businessDetails.phone,
    businessAddress: businessDetails.address,
    source: input.source || 'unknown',
    userId: input.userId,
    userEmail: input.userEmail,
    apiBaseUrl: EXPO_CONFIG.apiBaseUrl,
    clientVersion: EXPO_CONFIG.clientVersion,
    supabaseConfigured,
    connectionStatus: supabaseConfigured ? 'connected' : 'needs_setup',
    generatedAt: new Date().toISOString(),
  };
}
