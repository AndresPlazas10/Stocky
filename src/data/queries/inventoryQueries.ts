import { readAdapter } from '../adapters/localAdapter';
import { supabaseAdapter } from '../adapters/supabaseAdapter';
import type { ProductWithSupplier, Supplier } from '../../types';

export async function getInventoryProductsByBusiness(businessId: string): Promise<ProductWithSupplier[]> {
  const { data, error } = await readAdapter.getProductsWithSupplierByBusiness(businessId);
  if (error) throw error;
  return (data as unknown as ProductWithSupplier[]) || [];
}

export async function getInventoryProductsPage({
  businessId,
  limit = 120,
  offset = 0
}: {
  businessId: string;
  limit?: number;
  offset?: number;
}): Promise<ProductWithSupplier[]> {
  const { data, error } = await supabaseAdapter.getProductsWithSupplierByBusinessPaginated({
    businessId,
    limit,
    offset
  });
  if (error) throw error;
  return (data as unknown as ProductWithSupplier[]) || [];
}

export async function getSuppliersByBusiness(businessId: string): Promise<Supplier[]> {
  const { data, error } = await readAdapter.getSuppliersByBusinessOrdered(businessId);
  if (error) throw error;
  return (data as unknown as Supplier[]) || [];
}

export async function getSupplierById(supplierId: string): Promise<Supplier | null> {
  const { data, error } = await readAdapter.getSupplierById(supplierId);
  if (error) throw error;
  return (data as unknown as Supplier) || null;
}
