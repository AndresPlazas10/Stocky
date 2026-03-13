export type ConfiguracionFeatureFlagItem = {
  id: string;
  label: string;
  enabled: boolean;
};

export type ConfiguracionSnapshot = {
  businessId: string | null;
  businessName: string | null;
  businessNit: string | null;
  businessEmail: string | null;
  businessPhone: string | null;
  businessAddress: string | null;
  source: 'owner' | 'employee' | 'unknown';
  userId: string;
  userEmail: string | null;
  apiBaseUrl: string;
  clientVersion: string;
  supabaseConfigured: boolean;
  connectionStatus: 'connected' | 'needs_setup';
  generatedAt: string;
};
