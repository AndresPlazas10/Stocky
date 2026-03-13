import { listInventoryProducts, listInventorySuppliers } from '../../services/inventoryService';
import type { InventarioListItem, InventarioSupplier } from './contracts';

export async function listInventarioByBusinessId(businessId: string): Promise<InventarioListItem[]> {
  const items = await listInventoryProducts(businessId);
  return items.map((item) => ({
    id: item.id,
    businessId: item.business_id,
    code: item.code,
    name: item.name,
    category: item.category,
    purchasePrice: item.purchase_price,
    salePrice: item.sale_price,
    stock: item.stock,
    minStock: item.min_stock,
    unit: item.unit,
    supplierId: item.supplier_id,
    isActive: item.is_active,
    manageStock: item.manage_stock,
    createdAt: item.created_at,
    supplier: item.supplier
      ? {
          id: item.supplier.id,
          businessName: item.supplier.business_name,
          contactName: item.supplier.contact_name,
        }
      : null,
  }));
}

export async function listInventarioSuppliersByBusinessId(businessId: string): Promise<InventarioSupplier[]> {
  const suppliers = await listInventorySuppliers(businessId);
  return suppliers.map((supplier) => ({
    id: supplier.id,
    businessName: supplier.business_name,
    contactName: supplier.contact_name,
  }));
}
