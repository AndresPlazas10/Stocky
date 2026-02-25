import { readAdapter } from '../adapters/localAdapter';

export async function getProductsForCombos(businessId) {
  const { data, error } = await readAdapter.getProductsForOrdersByBusiness(businessId);
  if (error) throw error;
  return data || [];
}
