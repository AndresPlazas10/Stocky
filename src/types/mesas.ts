// Shared types for Mesa/Order operations

export interface MesaRecord {
  id: string;
  business_id: string;
  table_number: number;
  capacity?: number;
  status: 'available' | 'occupied' | 'reserved' | 'inactive';
  current_order_id: string | null;
  orders?: OrderRecord | null;
  created_at?: string;
  updated_at?: string;
}

export interface OrderRecord {
  id: string;
  business_id: string;
  table_id: string;
  status: 'open' | 'closed' | 'cancelled';
  total: number;
  created_at?: string;
  updated_at?: string;
  order_items?: OrderItem[];
  __localOnly?: boolean | string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id?: string | null;
  combo_id?: string | null;
  quantity: number;
  unit_price: number;
  subtotal: number;
  type?: 'product' | 'combo';
  products?: { id: string; name: string; code?: string } | null;
  combos?: { id: string; nombre: string; name?: string } | null;
  item_type?: string;
  item_key?: string;
  tempId?: string;
}

export interface CatalogComboItem {
  producto_id?: string;
  cantidad?: number;
  products?: {
    id?: string;
    name?: string;
    stock?: number;
    manage_stock?: boolean;
  } | null;
}

export interface CatalogItem {
  item_type: 'product' | 'combo';
  item_id: string;
  product_id: string | null;
  combo_id: string | null;
  name: string;
  code: string;
  sale_price: number;
  stock: number | null;
  manage_stock: boolean;
  combo_items: CatalogComboItem[];
}

export interface MesaLockState {
  lockedByOther?: boolean;
  lockedBy?: string;
  lockToken?: string;
  expiresAt?: string;
}

export interface MesaBroadcastState {
  tableId: string;
  lockToken: string;
  locked: boolean;
  mode: string;
}

export interface MesaLockResult {
  unsupported?: boolean;
  ok?: boolean;
  lockToken?: string;
  error?: string;
}
