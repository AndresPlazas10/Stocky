import { readAdapter } from '../adapters/localAdapter';
import type { ProductWithSupplier } from '../../types';

export async function getProductsForCombos(businessId: string): Promise<ProductWithSupplier[]> {
  const { data, error } = await readAdapter.getProductsForOrdersByBusiness(businessId);
  if (error) throw error;
  return data || [];
}
