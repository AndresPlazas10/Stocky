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
  employee_id?: string;
  sale_id: string | null;
  invoice_number: string;
  customer_name: string | null;
  customer_email?: string | null;
  customer_id_number?: string | null;
  customer_nit: string | null;
  payment_method?: string;
  subtotal: number;
  tax: number;
  total: number;
  status: 'draft' | 'sent' | 'paid' | 'cancelled';
  notes: string | null;
  issued_at?: string;
  created_at: string;
  updated_at: string;
  sent_at?: string | null;
  cancelled_at?: string | null;
  items?: InvoiceItem[];
  invoice_items?: InvoiceItem[];
}
