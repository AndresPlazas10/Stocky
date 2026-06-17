import { useCallback, useState } from 'react';
import {
  deleteSupplierById,
  saveSupplierWithTaxFallback,
  type ProveedorRecord,
  type SupplierTaxColumn,
} from '../../../services/proveedoresService';
import { invalidatePurchaseCatalogCache } from '../../../services/comprasService';
import { getErrorCode, getErrorMessage } from '../../../utils/error';
import type { ProveedorFormState } from '../proveedoresUtils';

interface UseProveedorMutationsParams {
  businessId: string;
  canManageSuppliers: boolean;
  form: ProveedorFormState;
  editingSupplier: ProveedorRecord | null;
  taxColumn: SupplierTaxColumn;
  setTaxColumn: (column: SupplierTaxColumn) => void;
  closeFormModal: () => void;
  refreshSuppliers: () => Promise<void>;
  setError: (error: string | null) => void;
}

export function useProveedorMutations({
  businessId,
  canManageSuppliers,
  form,
  editingSupplier,
  taxColumn,
  setTaxColumn,
  closeFormModal,
  refreshSuppliers,
  setError,
}: UseProveedorMutationsParams) {
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<ProveedorRecord | null>(null);

  const submitForm = useCallback(async () => {
    if (saving || !canManageSuppliers) return;

    setSaving(true);
    setError(null);
    try {
      const businessName = String(form.business_name || '').trim();
      if (!businessName) {
        throw new Error('El nombre del proveedor es obligatorio.');
      }

      const result = await saveSupplierWithTaxFallback({
        businessId,
        supplierId: editingSupplier?.id || null,
        preferredTaxColumn: taxColumn,
        formData: {
          business_name: businessName,
          contact_name: form.contact_name,
          email: form.email,
          phone: form.phone,
          address: form.address,
          notes: form.notes,
          nit: form.nit,
        },
      });

      if (result.taxColumn !== taxColumn) {
        setTaxColumn(result.taxColumn);
      }

      invalidatePurchaseCatalogCache(businessId);
      closeFormModal();
      await refreshSuppliers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el proveedor.');
    } finally {
      setSaving(false);
    }
  }, [
    businessId,
    canManageSuppliers,
    closeFormModal,
    editingSupplier,
    form,
    refreshSuppliers,
    saving,
    setTaxColumn,
    taxColumn,
    setError,
  ]);

  const askDeleteSupplier = useCallback(
    (supplier: ProveedorRecord) => {
      if (!canManageSuppliers) return;
      setSupplierToDelete(supplier);
      setShowDeleteModal(true);
    },
    [canManageSuppliers],
  );

  const confirmDeleteSupplier = useCallback(async () => {
    if (!supplierToDelete?.id || deleting || !canManageSuppliers) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteSupplierById({
        supplierId: supplierToDelete.id,
        businessId,
      });
      setShowDeleteModal(false);
      setSupplierToDelete(null);
      invalidatePurchaseCatalogCache(businessId);
      await refreshSuppliers();
    } catch (err) {
      if (String(getErrorCode(err) || '') === '23503') {
        setError('No se puede eliminar este proveedor porque tiene compras asociadas.');
      } else {
        setError(getErrorMessage(err));
      }
    } finally {
      setDeleting(false);
    }
  }, [businessId, canManageSuppliers, deleting, refreshSuppliers, supplierToDelete, setError]);

  const closeDeleteModal = useCallback(() => {
    if (deleting) return;
    setShowDeleteModal(false);
    setSupplierToDelete(null);
  }, [deleting]);

  return {
    saving,
    deleting,
    showDeleteModal,
    supplierToDelete,
    submitForm,
    askDeleteSupplier,
    confirmDeleteSupplier,
    closeDeleteModal,
  };
}
