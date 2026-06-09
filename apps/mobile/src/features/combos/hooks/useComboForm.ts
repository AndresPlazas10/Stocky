import { useCallback, useMemo, useState } from 'react';
import type { ComboRecord } from '../../../services/combosService';
import {
  EMPTY_FORM_ITEM,
  normalizeStatus,
  type ComboFormState,
} from '../comboUtils';

export function useComboForm() {
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingCombo, setEditingCombo] = useState<ComboRecord | null>(null);
  const [form, setForm] = useState<ComboFormState>({
    nombre: '',
    precioVenta: '',
    descripcion: '',
    estado: 'active' as any,
    items: [{ ...EMPTY_FORM_ITEM }],
  });
  const [showProductPickerModal, setShowProductPickerModal] = useState(false);
  const [productPickerRowIndex, setProductPickerRowIndex] = useState<number | null>(null);

  const hasDuplicateProducts = useMemo(() => {
    const seen = new Set<string>();
    for (const item of form.items) {
      const id = String(item.productoId || '').trim();
      if (!id) continue;
      if (seen.has(id)) return true;
      seen.add(id);
    }
    return false;
  }, [form.items]);

  const resetFormState = useCallback(() => {
    setEditingCombo(null);
    setForm({
      nombre: '',
      precioVenta: '',
      descripcion: '',
      estado: 'active' as any,
      items: [{ ...EMPTY_FORM_ITEM }],
    });
    setShowProductPickerModal(false);
    setProductPickerRowIndex(null);
  }, []);

  const openCreateModal = useCallback(() => {
    resetFormState();
    setShowFormModal(true);
  }, [resetFormState]);

  const openEditModal = useCallback((combo: ComboRecord) => {
    setEditingCombo(combo);
    setForm({
      nombre: combo.nombre || '',
      precioVenta: String(combo.precio_venta ?? ''),
      descripcion: combo.descripcion || '',
      estado: normalizeStatus(combo.estado),
      items: (Array.isArray(combo.combo_items) ? combo.combo_items : []).length > 0
        ? (Array.isArray(combo.combo_items) ? combo.combo_items : []).map((item) => ({
          productoId: item.producto_id,
          cantidad: String(item.cantidad ?? 1),
        }))
        : [{ ...EMPTY_FORM_ITEM }],
    });
    setShowFormModal(true);
  }, []);

  const closeFormModal = useCallback(() => {
    setShowFormModal(false);
    resetFormState();
  }, [resetFormState]);

  const handleAddItemRow = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, { ...EMPTY_FORM_ITEM }],
    }));
  }, []);

  const handleRemoveItemRow = useCallback((index: number) => {
    setForm((prev) => {
      if (prev.items.length <= 1) return prev;
      return {
        ...prev,
        items: prev.items.filter((_, itemIndex) => itemIndex !== index),
      };
    });
  }, []);

  const handleItemChange = useCallback((index: number, field: 'productoId' | 'cantidad', value: string) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, itemIndex) => (
        itemIndex === index ? { ...item, [field]: value } : item
      )),
    }));
  }, []);

  const openProductPicker = useCallback((rowIndex: number) => {
    setProductPickerRowIndex(rowIndex);
    setShowProductPickerModal(true);
  }, []);

  const closeProductPicker = useCallback(() => {
    setShowProductPickerModal(false);
    setProductPickerRowIndex(null);
  }, []);

  return {
    showFormModal,
    editingCombo,
    form,
    setForm,
    showProductPickerModal,
    setShowProductPickerModal,
    productPickerRowIndex,
    setProductPickerRowIndex,
    hasDuplicateProducts,
    openCreateModal,
    openEditModal,
    closeFormModal,
    handleAddItemRow,
    handleRemoveItemRow,
    handleItemChange,
    openProductPicker,
    closeProductPicker,
  };
}
