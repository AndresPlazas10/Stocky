export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'nequi' | 'daviplata' | 'other';

export interface SaleDetail {
  id: string;
  sale_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  created_at: string;
}

export interface SaleCashMetadata {
  id: string;
  sale_id: string;
  cash_received: number;
  change_given: number;
  created_at: string;
}

export interface Sale {
  id: string;
  business_id: string;
  employee_id: string | null;
  table_id: string | null;
  total: number;
  payment_method: PaymentMethod;
  status: 'completed' | 'cancelled' | 'pending';
  notes: string | null;
  created_at: string;
  updated_at: string;
  synced_at?: string | null;
  pending_sync?: boolean;
  details?: SaleDetail[];
  cash_metadata?: SaleCashMetadata;
}

export interface SaleListItem extends Sale {
  employee_name?: string;
  table_identifier?: string;
  item_count?: number;
}

export interface SaleFilters {
  fromDate?: string;
  toDate?: string;
  paymentMethod?: PaymentMethod | string;
  employeeId?: string;
  minAmount?: number;
  maxAmount?: number;
  customerId?: string;
}

export interface CreateSaleParams {
  businessId: string;
  employeeId?: string;
  tableId?: string;
  cart: CartItem[];
  paymentMethod: PaymentMethod;
  total: number;
  cashReceived?: number;
  changeGiven?: number;
  notes?: string;
  idempotencyKey?: string;
}

export interface CartItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}
