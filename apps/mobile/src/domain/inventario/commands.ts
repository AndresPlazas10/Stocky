import {
  createInventoryProductWithRpcFallback,
  deleteInventoryProductById,
  setInventoryProductActiveStatus,
  updateInventoryProductById,
} from '../../services/inventoryService';
import type { InventarioUpsertPayload } from './contracts';

export async function createInventarioProduct(
  businessId: string,
  payload: InventarioUpsertPayload,
): Promise<{ productId: string | null; usedLegacyFallback: boolean }> {
  return createInventoryProductWithRpcFallback({
    businessId,
    name: payload.name,
    category: payload.category,
    purchasePrice: payload.purchasePrice,
    salePrice: payload.salePrice,
    stock: payload.stock,
    minStock: payload.minStock,
    unit: payload.unit,
    supplierId: payload.supplierId,
    isActive: payload.isActive,
    manageStock: payload.manageStock,
  });
}

export async function updateInventarioProduct(
  businessId: string,
  productId: string,
  payload: InventarioUpsertPayload,
): Promise<void> {
  await updateInventoryProductById({
    businessId,
    productId,
    name: payload.name,
    category: payload.category,
    purchasePrice: payload.purchasePrice,
    salePrice: payload.salePrice,
    minStock: payload.minStock,
    unit: payload.unit,
    supplierId: payload.supplierId,
    isActive: payload.isActive !== false,
    manageStock: payload.manageStock !== false,
  });
}

export async function deleteInventarioProduct(businessId: string, productId: string): Promise<void> {
  await deleteInventoryProductById({ businessId, productId });
}

export async function setInventarioProductStatus(
  businessId: string,
  productId: string,
  isActive: boolean,
): Promise<void> {
  await setInventoryProductActiveStatus({ businessId, productId, isActive });
}
