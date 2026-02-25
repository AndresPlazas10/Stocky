import { readAdapter } from '../adapters/localAdapter';

export async function getInventoryProductsByBusiness(businessId) {
  const { data, error } = await readAdapter.getProductsWithSupplierByBusiness(businessId);
  if (error) throw error;
  return data || [];
}

export async function getSuppliersByBusiness(businessId) {
  const { data, error } = await readAdapter.getSuppliersByBusinessOrdered(businessId);
  if (error) throw error;
  return data || [];
}

export async function getSupplierById(supplierId) {
  const { data, error } = await readAdapter.getSupplierById(supplierId);
  if (error) throw error;
  return data || null;
}
