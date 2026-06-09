import { useCallback, useState } from 'react';
import {
  createInventoryProductWithRpcFallback,
  deleteInventoryProductById,
  checkInventoryProductCanDelete,
  setInventoryProductActiveStatus,
  updateInventoryProductById,
  type InventoryProductRecord,
} from '../../../services/inventoryService';
import { invalidateCatalogItemsCache } from '../../../services/mesaOrderService';
import { parseIntegerText, parseMoneyText, type ProductFormState } from '../inventoryUtils';

interface UseInventoryMutationsParams {
  businessId: string;
  canManageProducts: boolean;
  form: ProductFormState;
  editingProduct: InventoryProductRecord | null;
  closeFormModal: () => void;
  refreshProducts: () => Promise<void>;
  setError: (error: string | null) => void;
}

export function useInventoryMutations({
  businessId,
  canManageProducts,
  form,
  editingProduct,
  closeFormModal,
  refreshProducts,
  setError,
}: UseInventoryMutationsParams) {
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [productTarget, setProductTarget] = useState<InventoryProductRecord | null>(null);
  const [deleteCheckResult, setDeleteCheckResult] = useState<{
    has_sales: boolean;
    has_purchases: boolean;
    sales_count: number;
    purchases_count: number;
  } | null>(null);

  const handleSaveProduct = useCallback(async () => {
    if (!canManageProducts) {
      setError('No tienes permisos para gestionar productos.');
      return;
    }

    const normalizedName = String(form.name || '').trim();
    const normalizedCategory = String(form.category || '').trim();
    const purchasePrice = parseMoneyText(form.purchasePrice, 0);
    const salePrice = parseMoneyText(form.salePrice, NaN);
    const stock = form.manageStock ? parseIntegerText(form.stock, 0) : 0;
    const minStock = form.manageStock ? parseIntegerText(form.minStock, 5) : 0;

    if (!normalizedName) {
      setError('El nombre del producto es obligatorio.');
      return;
    }
    if (!normalizedCategory) {
      setError('La categoría es obligatoria.');
      return;
    }
    if (!Number.isFinite(purchasePrice) || purchasePrice < 0) {
      setError('El precio de compra no es válido.');
      return;
    }
    if (!Number.isFinite(salePrice) || salePrice < 0) {
      setError('El precio de venta no es válido.');
      return;
    }
    if (form.manageStock && (!Number.isFinite(stock) || stock < 0 || !Number.isFinite(minStock) || minStock < 0)) {
      setError('Stock y stock mínimo deben ser valores válidos.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (editingProduct) {
        await updateInventoryProductById({
          businessId,
          productId: editingProduct.id,
          name: normalizedName,
          category: normalizedCategory,
          purchasePrice,
          salePrice,
          minStock,
          unit: form.unit || 'unit',
          supplierId: form.supplierId,
          isActive: form.isActive,
          manageStock: form.manageStock,
        });
      } else {
        await createInventoryProductWithRpcFallback({
          businessId,
          name: normalizedName,
          category: normalizedCategory,
          purchasePrice,
          salePrice,
          stock,
          minStock,
          unit: form.unit || 'unit',
          supplierId: form.supplierId,
          isActive: true,
          manageStock: form.manageStock,
        });
      }

      closeFormModal();
      invalidateCatalogItemsCache(businessId);
      await refreshProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el producto.');
    } finally {
      setSaving(false);
    }
  }, [businessId, canManageProducts, closeFormModal, editingProduct, form, refreshProducts, setError]);

  const askDeleteProduct = useCallback(async (product: InventoryProductRecord) => {
    setProductTarget(product);
    try {
      const checkResult = await checkInventoryProductCanDelete(product.id);
      setDeleteCheckResult(checkResult);
      if (checkResult?.has_sales || checkResult?.has_purchases) {
        setShowDeactivateModal(true);
        setShowDeleteModal(false);
      } else {
        setShowDeleteModal(true);
        setShowDeactivateModal(false);
      }
    } catch {
      setShowDeleteModal(true);
      setShowDeactivateModal(false);
      setDeleteCheckResult(null);
    }
  }, []);

  const confirmDeleteProduct = useCallback(async () => {
    if (!productTarget) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteInventoryProductById({
        businessId,
        productId: productTarget.id,
      });
      setShowDeleteModal(false);
      setProductTarget(null);
      invalidateCatalogItemsCache(businessId);
      await refreshProducts();
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el producto.');
    } finally {
      setDeleting(false);
      setDeleteCheckResult(null);
    }
  }, [businessId, productTarget, refreshProducts, setError]);

  const confirmDeactivateProduct = useCallback(async () => {
    if (!productTarget) return;
    setDeleting(true);
    setError(null);
    try {
      await setInventoryProductActiveStatus({
        businessId,
        productId: productTarget.id,
        isActive: false,
      });
      setShowDeactivateModal(false);
      setProductTarget(null);
      setDeleteCheckResult(null);
      invalidateCatalogItemsCache(businessId);
      await refreshProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo desactivar el producto.');
    } finally {
      setDeleting(false);
    }
  }, [businessId, productTarget, refreshProducts, setError]);

  const activateProduct = useCallback(async (product: InventoryProductRecord) => {
    setDeleting(true);
    setError(null);
    try {
      await setInventoryProductActiveStatus({
        businessId,
        productId: product.id,
        isActive: true,
      });
      invalidateCatalogItemsCache(businessId);
      await refreshProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo activar el producto.');
    } finally {
      setDeleting(false);
    }
  }, [businessId, refreshProducts, setError]);

  const closeDeleteModals = useCallback(() => {
    setShowDeleteModal(false);
    setShowDeactivateModal(false);
    setProductTarget(null);
    setDeleteCheckResult(null);
  }, []);

  return {
    saving,
    deleting,
    showDeleteModal,
    setShowDeleteModal,
    showDeactivateModal,
    setShowDeactivateModal,
    productTarget,
    deleteCheckResult,
    handleSaveProduct,
    askDeleteProduct,
    confirmDeleteProduct,
    confirmDeactivateProduct,
    activateProduct,
    closeDeleteModals,
  };
}
