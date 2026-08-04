export type MesaOrderProduct = {
  id: string;
  item_type: 'product';
  product_id: string;
  combo_id: null;
  name: string;
  code: string | null;
  category: string | null;
  sale_price: number;
  stock: number;
  manage_stock: boolean;
  combo_items: [];
};

export type MesaOrderCombo = {
  id: string;
  item_type: 'combo';
  product_id: null;
  combo_id: string;
  name: string;
  code: null;
  sale_price: number;
  stock: null;
  manage_stock: false;
  combo_items: {
    producto_id: string;
    cantidad: number;
    products?: {
      id?: string;
      name?: string;
      stock?: number;
      manage_stock?: boolean;
    } | null;
  }[];
};

export type MesaOrderCatalogItem = MesaOrderProduct | MesaOrderCombo;

export type MesaOrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  combo_id: string | null;
  quantity: number;
  price: number;
  subtotal: number;
  category?: string;
  products?: {
    id?: string;
    name?: string;
    code?: string;
    category?: string;
  } | null;
  combos?: {
    id?: string;
    nombre?: string;
  } | null;
};

export type StockShortage = {
  product_id: string;
  product_name: string;
  available_stock: number;
  quantity: number;
};

export type ComboComponentShortage = {
  product_id: string;
  product_name: string;
  available_stock: number;
  required_quantity: number;
};

export type CatalogLookup = {
  productById: Map<string, MesaOrderProduct>;
  comboById: Map<string, MesaOrderCombo>;
};

export type ListCatalogItemsOptions = {
  forceRefresh?: boolean;
  ttlMs?: number;
};

export type MesaOpenOrderSnapshot = {
  orderId: string;
  items: MesaOrderItem[];
  total: number;
  units: number;
};
