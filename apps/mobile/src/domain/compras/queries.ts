import {
  listCompraDetails,
  listPurchaseProducts,
  listPurchaseSuppliers,
  listRecentCompras,
  type CompraDetailRecord,
  type CompraProductRecord,
  type CompraRecord,
  type CompraSupplierRecord,
} from '../../services/comprasService';

export async function listComprasByBusinessId(businessId: string): Promise<CompraRecord[]> {
  return listRecentCompras(businessId);
}

export async function listProductsForCompras(businessId: string): Promise<CompraProductRecord[]> {
  return listPurchaseProducts(businessId);
}

export async function listSuppliersForCompras(businessId: string): Promise<CompraSupplierRecord[]> {
  return listPurchaseSuppliers(businessId);
}

export async function listCompraDetailsById(purchaseId: string): Promise<CompraDetailRecord[]> {
  return listCompraDetails(purchaseId);
}
