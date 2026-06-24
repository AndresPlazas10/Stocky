export interface InvoiceItem {
  id: string;
  invoice_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  created_at: string;
}

export interface Invoice {
  id: string;
  business_id: string;
  sale_id: string | null;
  invoice_number: string;
  customer_name: string | null;
  customer_nit: string | null;
  subtotal: number;
  tax: number;
  total: number;
  status: 'draft' | 'sent' | 'paid' | 'cancelled';
  notes: string | null;
  created_at: string;
  updated_at: string;
  items?: InvoiceItem[];
}
