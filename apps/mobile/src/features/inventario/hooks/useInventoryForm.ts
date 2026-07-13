import { useCallback, useMemo, useState } from 'react';
import {
  type InventoryProductRecord,
  type InventorySupplierRecord,
} from '../../../services/inventoryService';
import {
  getSupplierDisplayName,
  getUnitLabel,
  INITIAL_FORM,
  type ProductFormState,
} from '../inventoryUtils';

export function useInventoryForm() {
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<InventoryProductRecord | null>(null);
  const [form, setForm] = useState<ProductFormState>(INITIAL_FORM);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);

  const selectedUnitLabel = useMemo(() => getUnitLabel(form.unit), [form.unit]);

  const selectedSupplierLabel = useMemo(() => {
    if (!form.supplierId) return 'Sin proveedor';
    return 'Sin proveedor';
  }, [form.supplierId]);

  const getSelectedSupplierLabel = useCallback(
    (suppliers: InventorySupplierRecord[]) => {
      if (!form.supplierId) return 'Sin proveedor';
      const selected = suppliers.find((item) => item.id === form.supplierId);
      return getSupplierDisplayName(selected || null);
    },
    [form.supplierId],
  );

  const closeFormModal = useCallback(() => {
    setShowFormModal(false);
    setEditingProduct(null);
    setShowCategoryModal(false);
    setShowUnitModal(false);
    setShowSupplierModal(false);
    setForm(INITIAL_FORM);
  }, []);

  const openCreateModal = useCallback(() => {
    setEditingProduct(null);
    setForm(INITIAL_FORM);
    setShowCategoryModal(false);
    setShowFormModal(true);
  }, []);

  const openEditModal = useCallback((product: InventoryProductRecord) => {
    setEditingProduct(product);
    setForm({
      name: product.name,
      category: product.category || '',
      purchasePrice: String(Number(product.purchase_price || 0)),
      salePrice: String(Number(product.sale_price || 0)),
      stock: String(Number(product.stock || 0)),
      minStock: String(Number(product.min_stock || 0)),
      unit: product.unit || 'unit',
      supplierId: product.supplier_id || '',
      manageStock: product.manage_stock !== false,
      isActive: product.is_active !== false,
    });
    setShowCategoryModal(false);
    setShowFormModal(true);
  }, []);

  const selectCategory = useCallback((category: string) => {
    setShowCategoryModal(false);
    requestAnimationFrame(() => {
      setForm((prev) => ({ ...prev, category }));
    });
  }, []);

  const selectUnit = useCallback((unitValue: string) => {
    setShowUnitModal(false);
    requestAnimationFrame(() => {
      setForm((prev) => ({ ...prev, unit: unitValue }));
    });
  }, []);

  const selectSupplier = useCallback((supplierId: string) => {
    setShowSupplierModal(false);
    requestAnimationFrame(() => {
      setForm((prev) => ({ ...prev, supplierId }));
    });
  }, []);

  return {
    showFormModal,
    editingProduct,
    form,
    setForm,
    showCategoryModal,
    setShowCategoryModal,
    showUnitModal,
    setShowUnitModal,
    showSupplierModal,
    setShowSupplierModal,
    selectedUnitLabel,
    selectedSupplierLabel,
    getSelectedSupplierLabel,
    closeFormModal,
    openCreateModal,
    openEditModal,
    selectCategory,
    selectUnit,
    selectSupplier,
  };
}
