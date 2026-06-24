export type ProductCategory = string;

export interface Product {
  id: string;
  business_id: string;
  code: string;
  name: string;
  category: ProductCategory;
  purchase_price: number;
  sale_price: number;
  stock: number;
  min_stock: number;
  unit: string;
  supplier_id: string | null;
  is_active: boolean;
  manage_stock: boolean;
  created_at: string;
}

export interface ProductWithSupplier extends Product {
  supplier?: {
    id: string;
    business_name: string;
    contact_name: string | null;
  } | null;
}
