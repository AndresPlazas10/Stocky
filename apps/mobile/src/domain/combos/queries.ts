import {
  listComboProducts,
  listCombosByBusiness,
  type ComboProductRecord,
  type ComboRecord,
} from '../../services/combosService';

export async function listCombosByBusinessId(businessId: string): Promise<ComboRecord[]> {
  return listCombosByBusiness(businessId);
}

export async function listActiveCombosByBusinessId(businessId: string): Promise<ComboRecord[]> {
  return listCombosByBusiness(businessId, { onlyActive: true });
}

export async function listProductsForCombosByBusinessId(
  businessId: string,
): Promise<ComboProductRecord[]> {
  return listComboProducts(businessId);
}
