export interface BusinessConfig {
  id: string;
  business_id: string;
  tax_rate: number;
  currency: string;
  receipt_footer: string | null;
  created_at: string;
  updated_at: string;
}

export interface Business {
  id: string;
  name: string;
  owner_id: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  nit: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  config?: BusinessConfig;
}
