import {
  deleteSupplierById,
  saveSupplierWithTaxFallback,
  type ProveedorFormPayload,
  type SupplierTaxColumn,
} from '../../services/proveedoresService';

export async function saveProveedor({
  businessId,
  formData,
  supplierId = null,
  preferredTaxColumn = 'nit',
}: {
  businessId: string;
  formData: ProveedorFormPayload;
  supplierId?: string | null;
  preferredTaxColumn?: SupplierTaxColumn;
}) {
  return saveSupplierWithTaxFallback({
    businessId,
    formData,
    supplierId,
    preferredTaxColumn,
  });
}

export async function removeProveedor({
  businessId,
  supplierId,
}: {
  businessId: string;
  supplierId: string;
}): Promise<void> {
  await deleteSupplierById({
    businessId,
    supplierId,
  });
}

// Alias de compatibilidad.
export async function mutateProveedores({
  businessId,
  formData,
  supplierId = null,
  preferredTaxColumn = 'nit',
}: {
  businessId: string;
  formData: ProveedorFormPayload;
  supplierId?: string | null;
  preferredTaxColumn?: SupplierTaxColumn;
}) {
  return saveProveedor({
    businessId,
    formData,
    supplierId,
    preferredTaxColumn,
  });
}
