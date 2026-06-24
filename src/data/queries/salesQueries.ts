import { readAdapter } from '../adapters/localAdapter';
import type { ProductWithSupplier, SaleDetail, SaleCashMetadata, SaleListItem } from '../../types';

export async function getProductsForSale(businessId: string): Promise<ProductWithSupplier[]> {
  const { data, error } = await readAdapter.getActiveProductsForSale(businessId);
  if (error) throw error;
  return data || [];
}

export async function getSaleDetailsBySaleId(saleId: string): Promise<SaleDetail[]> {
  const { data, error } = await readAdapter.getSaleDetails(saleId);
  if (error) throw error;
  return data || [];
}

export async function getSaleCashMetadataBySaleId(saleId: string): Promise<SaleCashMetadata | null> {
  const { data, error } = await readAdapter.getSaleCashMetadata(saleId);
  if (error) throw error;
  return data || null;
}

export async function getSaleForPrintById(saleId: string): Promise<SaleListItem | null> {
  const { data, error } = await readAdapter.getSaleForPrint(saleId);
  if (error) throw error;
  return data || null;
}

export async function getBusinessNameById(businessId: string): Promise<string | null> {
  const { data, error } = await readAdapter.getBusinessName(businessId);
  if (error) throw error;
  return data?.name || null;
}
