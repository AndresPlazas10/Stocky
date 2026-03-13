import {
  listSuppliersForManagement,
  type ProveedorRecord,
  type SupplierTaxColumn,
} from '../../services/proveedoresService';

export async function listProveedoresByBusinessId(
  businessId: string,
  preferredTaxColumn: SupplierTaxColumn = 'nit',
): Promise<{ suppliers: ProveedorRecord[]; taxColumn: SupplierTaxColumn }> {
  return listSuppliersForManagement({
    businessId,
    preferredTaxColumn,
  });
}
