import { readAdapter } from '../adapters/localAdapter';
import { supabaseAdapter } from '../adapters/supabaseAdapter';

export async function getInventoryProductsByBusiness(businessId) {
  const { data, error } = await readAdapter.getProductsWithSupplierByBusiness(businessId);
  if (error) throw error;
  return data || [];
}

export async function getInventoryProductsPage({
  businessId,
  limit = 120,
  offset = 0
}) {
  const { data, error } = await supabaseAdapter.getProductsWithSupplierByBusinessPaginated({
    businessId,
    limit,
    offset
  });
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
