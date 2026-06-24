export interface PurchaseItem {
  id: string;
  purchase_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  created_at: string;
}

export interface Purchase {
  id: string;
  business_id: string;
  supplier_id: string | null;
  total: number;
  status: 'pending' | 'received' | 'cancelled';
  notes: string | null;
  created_at: string;
  updated_at: string;
  items?: PurchaseItem[];
  supplier?: {
    id: string;
    business_name: string;
  } | null;
}

export interface PurchaseFilters {
  fromDate?: string;
  toDate?: string;
  supplierId?: string;
  minAmount?: number;
  maxAmount?: number;
}
