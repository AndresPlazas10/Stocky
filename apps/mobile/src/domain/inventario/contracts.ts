export type InventarioSupplier = {
  id: string;
  businessName: string | null;
  contactName: string | null;
};

export type InventarioListItem = {
  id: string;
  businessId: string;
  code: string | null;
  name: string;
  category: string | null;
  purchasePrice: number;
  salePrice: number;
  stock: number;
  minStock: number;
  unit: string;
  supplierId: string | null;
  isActive: boolean;
  manageStock: boolean;
  createdAt: string | null;
  supplier: InventarioSupplier | null;
};

export type InventarioUpsertPayload = {
  name: string;
  category?: string | null;
  purchasePrice: number;
  salePrice: number;
  stock: number;
  minStock: number;
  unit?: string | null;
  supplierId?: string | null;
  isActive?: boolean;
  manageStock?: boolean;
};
