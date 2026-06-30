import { useState, useCallback } from 'react';
import { parsePriceInput } from '../../../utils/formatters';
import {
  createProductWithFallback,
  deleteProductById,
  checkProductCanDelete,
  setProductActiveStatus,
  updateProductById,
} from '../../../data/commands/inventoryCommands';
import { INITIAL_FORM_STATE } from './productFormConstants';
import type { ProductWithSupplier } from '../../../types/product';
import type { ProductFormData } from '../../../types/components';

interface DeleteCheckResult {
  has_sales?: boolean;
  has_purchases?: boolean;
  sales_count?: number;
  purchases_count?: number;
}

interface UseInventoryCrudParams {
  businessId: string;
  loadProducts: () => Promise<void>;
  setProductsWithSnapshot: (updater: ProductWithSupplier[] | ((prev: ProductWithSupplier[]) => ProductWithSupplier[])) => void;
  hasAdminPrivileges: boolean;
  isEmployee: boolean;
}

export function useInventoryCrud({ businessId, loadProducts, setProductsWithSnapshot, hasAdminPrivileges, isEmployee }: UseInventoryCrudParams) {
  const [formData, setFormData] = useState<ProductFormData>(INITIAL_FORM_STATE);
  const [showForm, setShowForm] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<ProductWithSupplier | null>(null);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [generatedCode, setGeneratedCode] = useState<string>('');

  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState<boolean>(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [deleteCheckResult, setDeleteCheckResult] = useState<DeleteCheckResult | null>(null);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type, checked } = e.target as HTMLInputElement;
    setFormData((prev) => {
      const nextValue = type === 'checkbox' ? checked : value;
      const nextState = { ...prev, [name]: nextValue };
      if (name === 'manage_stock' && !checked) {
        nextState.stock = '';
        nextState.min_stock = '';
      }
      return nextState;
    });
  }, []);

  const resetForm = useCallback(() => {
    setFormData(INITIAL_FORM_STATE);
    setGeneratedCode('');
  }, []);

  const handleUpdate = useCallback(async () => {
    try {
      const normalizedSalePrice = parsePriceInput(formData.sale_price, NaN);
      const normalizedPurchasePrice = parsePriceInput(formData.purchase_price, 0);
      const productData = {
        name: formData.name.trim(),
        category: formData.category.trim(),
        purchase_price: normalizedPurchasePrice,
        sale_price: normalizedSalePrice,
        min_stock: formData.manage_stock ? parseInt(formData.min_stock) || 5 : 0,
        unit: formData.unit || 'unit',
        supplier_id: formData.supplier_id || null,
        is_active: formData.is_active,
        manage_stock: formData.manage_stock !== false,
      };

      const updateResult = await updateProductById({
        productId: editingProduct!.id,
        businessId,
        payload: productData,
      });

      if ((updateResult as Record<string, unknown>)?.__localOnly) {
        setProductsWithSnapshot((prev) =>
          prev.map((item) => (item.id === editingProduct!.id ? { ...item, ...productData } : item)),
        );
      } else {
        await loadProducts();
      }

      setShowEditModal(false);
      setEditingProduct(null);
      resetForm();
    } finally {
      setIsSubmitting(false);
    }
  }, [editingProduct, formData, loadProducts, businessId, setProductsWithSnapshot, resetForm]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (isSubmitting) return;

      setIsSubmitting(true);

      try {
        const normalizedSalePrice = parsePriceInput(formData.sale_price, NaN);
        const normalizedPurchasePrice = parsePriceInput(formData.purchase_price, 0);

        if (!formData.name?.trim()) throw new Error('El nombre del producto es requerido');
        if (!formData.category?.trim()) throw new Error('La categoría del producto es requerida');
        if (!formData.sale_price || !Number.isFinite(normalizedSalePrice) || normalizedSalePrice <= 0) {
          throw new Error('El precio de venta debe ser mayor a 0');
        }
        if (formData.purchase_price && normalizedPurchasePrice < 0) {
          throw new Error('El precio de compra no puede ser negativo');
        }
        if (formData.sale_price && formData.purchase_price && normalizedSalePrice < normalizedPurchasePrice) {
          throw new Error('El precio de venta no puede ser menor al precio de compra');
        }

        if (editingProduct) {
          await handleUpdate();
          return;
        }

        const productData = {
          name: formData.name.trim(),
          category: formData.category.trim(),
          purchase_price: normalizedPurchasePrice,
          sale_price: normalizedSalePrice,
          stock: formData.manage_stock ? parseInt(formData.stock) || 0 : 0,
          min_stock: formData.manage_stock ? parseInt(formData.min_stock) || 5 : 0,
          unit: formData.unit || 'unit',
          supplier_id: formData.supplier_id || null,
          business_id: businessId,
          is_active: true,
          manage_stock: formData.manage_stock !== false,
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await createProductWithFallback(productData) as any;

        if (result?.localOnly && result?.createdProduct) {
          setProductsWithSnapshot((prev) => {
            const next = [result.createdProduct as ProductWithSupplier, ...prev];
            const seen = new Set<string>();
            return next.filter((item) => {
              const key = String(item?.id || '');
              if (!key || seen.has(key)) return false;
              seen.add(key);
              return true;
            });
          });
        } else {
          await loadProducts();
        }

        setShowForm(false);
        resetForm();
      } finally {
        setIsSubmitting(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [businessId, formData, loadProducts, isSubmitting, editingProduct],
  );

  const handleEdit = useCallback(
    (producto: ProductWithSupplier) => {
      setEditingProduct(producto);
      setFormData({
        name: producto.name,
        category: producto.category,
        purchase_price: producto.purchase_price.toString(),
        sale_price: producto.sale_price.toString(),
        stock: producto.stock.toString(),
        min_stock: producto.min_stock.toString(),
        unit: producto.unit,
        supplier_id: producto.supplier_id || '',
        is_active: producto.is_active,
        manage_stock: producto.manage_stock !== false,
      });
      setGeneratedCode(producto.code);
      setShowEditModal(true);
    },
    [],
  );

  const handleDelete = useCallback(async (productId: string) => {
    setProductToDelete(productId);
    try {
      const checkResult = await checkProductCanDelete(productId) as DeleteCheckResult | null;
      setDeleteCheckResult(checkResult);
      if (checkResult?.has_sales || checkResult?.has_purchases) {
        setShowDeactivateModal(true);
      } else {
        setShowDeleteModal(true);
      }
    } catch {
      setShowDeleteModal(true);
      setDeleteCheckResult(null);
    }
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!productToDelete) return;
    if (!hasAdminPrivileges || isEmployee) {
      setShowDeleteModal(false);
      setProductToDelete(null);
      throw new Error('No tienes permisos para eliminar productos');
    }

    try {
      const deleteResult = await deleteProductById({ productId: productToDelete, businessId });

      setShowDeleteModal(false);
      setProductToDelete(null);

      if (deleteResult?.localOnly) {
        setProductsWithSnapshot((prev) => prev.filter((item) => item.id !== productToDelete));
      } else {
        await loadProducts();
      }
    } catch (_error) {
      setShowDeleteModal(false);
      setProductToDelete(null);
      setDeleteCheckResult(null);
      throw _error;
    }
  }, [productToDelete, loadProducts, businessId, setProductsWithSnapshot, hasAdminPrivileges, isEmployee]);

  const confirmDeactivate = useCallback(async () => {
    if (!productToDelete) return;

    try {
      const statusResult = await setProductActiveStatus({
        productId: productToDelete,
        isActive: false,
        businessId,
      }) as Record<string, unknown> | null;

      if (statusResult?.__localOnly) {
        setProductsWithSnapshot((prev) =>
          prev.map((item) => (item.id === productToDelete ? { ...item, is_active: false } : item)),
        );
      } else {
        await loadProducts();
      }
      setShowDeactivateModal(false);
      setProductToDelete(null);
      setDeleteCheckResult(null);
    } catch {
      setShowDeactivateModal(false);
      setProductToDelete(null);
      setDeleteCheckResult(null);
      throw new Error('Error al desactivar el producto');
    }
  }, [productToDelete, loadProducts, businessId, setProductsWithSnapshot]);

  const cancelDelete = useCallback(() => {
    setShowDeleteModal(false);
    setShowDeactivateModal(false);
    setProductToDelete(null);
    setDeleteCheckResult(null);
  }, []);

  const toggleActive = useCallback(
    async (productId: string, currentStatus: boolean) => {
      try {
        const statusResult = await setProductActiveStatus({
          productId,
          isActive: !currentStatus,
          businessId,
        }) as Record<string, unknown> | null;

        if (statusResult?.__localOnly) {
          setProductsWithSnapshot((prev) =>
            prev.map((item) => (item.id === productId ? { ...item, is_active: !currentStatus } : item)),
          );
        } else {
          await loadProducts();
        }
      } catch {
        throw new Error('Error al actualizar el estado del producto');
      }
    },
    [loadProducts, businessId, setProductsWithSnapshot],
  );

  return {
    formData,
    setFormData,
    showForm,
    setShowForm,
    editingProduct,
    setEditingProduct,
    showEditModal,
    setShowEditModal,
    isSubmitting,
    setIsSubmitting,
    generatedCode,
    setGeneratedCode,
    showDeleteModal,
    setShowDeleteModal,
    showDeactivateModal,
    setShowDeactivateModal,
    productToDelete,
    deleteCheckResult,
    handleChange,
    handleSubmit,
    handleUpdate,
    handleEdit,
    handleDelete,
    confirmDelete,
    confirmDeactivate,
    cancelDelete,
    toggleActive,
    resetForm,
  };
}
