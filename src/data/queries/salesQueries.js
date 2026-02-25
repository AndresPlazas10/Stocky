import { readAdapter } from '../adapters/localAdapter';

export async function getProductsForSale(businessId) {
  const { data, error } = await readAdapter.getActiveProductsForSale(businessId);
  if (error) throw error;
  return data || [];
}

export async function getSaleDetailsBySaleId(saleId) {
  const { data, error } = await readAdapter.getSaleDetails(saleId);
  if (error) throw error;
  return data || [];
}

export async function getSaleCashMetadataBySaleId(saleId) {
  const { data, error } = await readAdapter.getSaleCashMetadata(saleId);
  if (error) throw error;
  return data || null;
}

export async function getSaleForPrintById(saleId) {
  const { data, error } = await readAdapter.getSaleForPrint(saleId);
  if (error) throw error;
  return data || null;
}

export async function getBusinessNameById(businessId) {
  const { data, error } = await readAdapter.getBusinessName(businessId);
  if (error) throw error;
  return data?.name || null;
}
