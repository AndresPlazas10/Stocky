import { readAdapter } from '../adapters/localAdapter';
import type { ProductWithSupplier, Supplier, Employee, PurchaseItem } from '../../types';

export async function getProductsForPurchase(businessId: string): Promise<ProductWithSupplier[]> {
  const { data, error } = await readAdapter.getProductsForPurchase(businessId);
  if (error) throw error;
  return data || [];
}

export async function getSuppliersForBusiness(businessId: string): Promise<Supplier[]> {
  const { data, error } = await readAdapter.getSuppliersByBusiness(businessId);
  if (error) throw error;
  return data || [];
}

export async function getEmployeesByBusiness(businessId: string): Promise<Employee[]> {
  const { data, error } = await readAdapter.getEmployeesByBusiness(businessId);
  if (error) throw error;
  return data || [];
}

export async function getSupplierById(supplierId: string): Promise<Supplier | null> {
  const { data, error } = await readAdapter.getSupplierById(supplierId);
  if (error) throw error;
  return data || null;
}

export async function getEmployeeRoleByBusinessAndUser({
  businessId,
  userId
}: {
  businessId: string;
  userId: string;
}): Promise<string | null> {
  const { data, error } = await readAdapter.getEmployeeRoleByBusinessAndUser(businessId, userId);
  if (error) throw error;
  return data?.role || null;
}

export async function getPurchaseDetailsByPurchaseId(purchaseId: string): Promise<PurchaseItem[]> {
  const { data, error } = await readAdapter.getPurchaseDetailsByPurchaseId(purchaseId);
  if (error) throw error;
  return data || [];
}

export async function getPurchaseDetailsWithProductByPurchaseId(purchaseId: string): Promise<PurchaseItem[]> {
  const { data, error } = await readAdapter.getPurchaseDetailsWithProductByPurchaseId(purchaseId);
  if (error) throw error;
  return data || [];
}

export async function getProductsByBusinessAndIds({
  businessId,
  productIds
}: {
  businessId: string;
  productIds: string[];
}): Promise<ProductWithSupplier[]> {
  if (!Array.isArray(productIds) || productIds.length === 0) return [];
  const { data, error } = await readAdapter.getProductsByBusinessAndIds(businessId, productIds);
  if (error) throw error;
  return data || [];
}
