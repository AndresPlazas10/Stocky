export interface Supplier {
  id: string;
  business_id: string;
  business_name: string;
  contact_name: string | null;
  nit: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  is_active: boolean;
  created_at: string;
}
