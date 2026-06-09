import { useCallback, useState } from 'react';
import type { ProveedorRecord } from '../../../services/proveedoresService';
import { INITIAL_FORM, createFormFromSupplier, type ProveedorFormState } from '../proveedoresUtils';

export function useProveedorForm() {
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<ProveedorRecord | null>(null);
  const [form, setForm] = useState<ProveedorFormState>(INITIAL_FORM);
  const [formDetailsReady, setFormDetailsReady] = useState(false);

  const resetFormState = useCallback(() => {
    setEditingSupplier(null);
    setForm(INITIAL_FORM);
  }, []);

  const openCreateModal = useCallback(() => {
    resetFormState();
    setShowFormModal(true);
  }, [resetFormState]);

  const openEditModal = useCallback((supplier: ProveedorRecord) => {
    setEditingSupplier(supplier);
    setForm(createFormFromSupplier(supplier));
    setShowFormModal(true);
  }, []);

  const closeFormModal = useCallback(() => {
    setShowFormModal(false);
    resetFormState();
  }, [resetFormState]);

  return {
    showFormModal,
    editingSupplier,
    form,
    setForm,
    formDetailsReady,
    setFormDetailsReady,
    openCreateModal,
    openEditModal,
    closeFormModal,
  };
}
