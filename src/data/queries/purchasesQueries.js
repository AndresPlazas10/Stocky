import { readAdapter } from '../adapters/localAdapter';

export async function getProductsForPurchase(businessId) {
  const { data, error } = await readAdapter.getProductsForPurchase(businessId);
  if (error) throw error;
  return data || [];
}

export async function getSuppliersForBusiness(businessId) {
  const { data, error } = await readAdapter.getSuppliersByBusiness(businessId);
  if (error) throw error;
  return data || [];
}

export async function getEmployeesByBusiness(businessId) {
  const { data, error } = await readAdapter.getEmployeesByBusiness(businessId);
  if (error) throw error;
  return data || [];
}

export async function getSupplierById(supplierId) {
  const { data, error } = await readAdapter.getSupplierById(supplierId);
  if (error) throw error;
  return data || null;
}

export async function getEmployeeRoleByBusinessAndUser({ businessId, userId }) {
  const { data, error } = await readAdapter.getEmployeeRoleByBusinessAndUser(businessId, userId);
  if (error) throw error;
  return data?.role || null;
}

export async function getPurchaseDetailsByPurchaseId(purchaseId) {
  const { data, error } = await readAdapter.getPurchaseDetailsByPurchaseId(purchaseId);
  if (error) throw error;
  return data || [];
}

export async function getPurchaseDetailsWithProductByPurchaseId(purchaseId) {
  const { data, error } = await readAdapter.getPurchaseDetailsWithProductByPurchaseId(purchaseId);
  if (error) throw error;
  return data || [];
}

export async function getProductsByBusinessAndIds({ businessId, productIds }) {
  if (!Array.isArray(productIds) || productIds.length === 0) return [];
  const { data, error } = await readAdapter.getProductsByBusinessAndIds(businessId, productIds);
  if (error) throw error;
  return data || [];
}
