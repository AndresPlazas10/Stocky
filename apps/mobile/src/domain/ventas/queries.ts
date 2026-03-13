import {
  listRecentVentas,
  listVentaDetails,
  listVentasCatalog,
  type VentaDetailRecord,
  type VentaRecord,
} from '../../services/ventasService';
import type { MesaOrderCatalogItem } from '../../services/mesaOrderService';

export async function listVentasByBusinessId(businessId: string): Promise<VentaRecord[]> {
  return listRecentVentas(businessId);
}

export async function listVentasCatalogByBusinessId(businessId: string): Promise<MesaOrderCatalogItem[]> {
  return listVentasCatalog(businessId);
}

export async function listVentaDetailsById(saleId: string): Promise<VentaDetailRecord[]> {
  return listVentaDetails(saleId);
}
