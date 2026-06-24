export interface ComboItem {
  id: string;
  combo_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
}

export interface Combo {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  sale_price: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  items?: ComboItem[];
}
