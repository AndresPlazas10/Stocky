export type TableStatus = 'available' | 'occupied' | 'reserved' | 'cleaning';

export interface Table {
  id: string;
  business_id: string;
  identifier: string;
  name: string | null;
  status: TableStatus;
  capacity: number | null;
  current_order_id: string | null;
  created_at: string;
  updated_at: string;
  orders?: { status: string; order_items?: unknown[]; [key: string]: unknown } | null;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  status: 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
  created_at: string;
}

export interface Order {
  id: string;
  business_id: string;
  table_id: string;
  status: 'open' | 'closed' | 'cancelled';
  total: number;
  employee_id: string | null;
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
  table?: Table;
}

export interface OrderSnapshot {
  orderId: string;
  tableId: string;
  status: string;
  total: number;
  items: Array<{
    product_id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
  }>;
  created_at: string;
  updated_at: string;
}
