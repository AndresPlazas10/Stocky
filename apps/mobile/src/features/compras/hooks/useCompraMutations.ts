import { useCallback, useState } from 'react';
import {
  createCompraWithRpcFallback,
  deleteCompraWithStockFallback,
  listRecentCompras,
  type CompraCartItem,
  type CompraRecord,
} from '../../../services/comprasService';

interface UseCompraMutationsParams {
  businessId: string;
  userId: string;
  supplierId: string;
  paymentMethod: string;
  cart: CompraCartItem[];
  cartTotal: number;
  canDeletePurchases: boolean;
  selectedPurchase: CompraRecord | null;
  clearForm: () => void;
  refreshPurchases: () => Promise<void>;
  refreshProducts: () => Promise<void>;
  setShowCreatePurchaseModal: (show: boolean) => void;
  setShowPurchaseDetails: (show: boolean) => void;
  setSelectedPurchase: (p: CompraRecord | null) => void;
  setSelectedPurchaseDetails: (d: any[]) => void;
  setPurchases: (p: CompraRecord[] | ((prev: CompraRecord[]) => CompraRecord[])) => void;
  setError: (error: string | null) => void;
}

export function useCompraMutations({
  businessId,
  userId,
  supplierId,
  paymentMethod,
  cart,
  cartTotal,
  canDeletePurchases,
  selectedPurchase,
  clearForm,
  refreshPurchases,
  refreshProducts,
  setShowCreatePurchaseModal,
  setShowPurchaseDetails,
  setSelectedPurchase,
  setSelectedPurchaseDetails,
  setPurchases,
  setError,
}: UseCompraMutationsParams) {
  const [creatingPurchase, setCreatingPurchase] = useState(false);
  const [purchaseToDelete, setPurchaseToDelete] = useState<CompraRecord | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingPurchase, setDeletingPurchase] = useState(false);

  const submitPurchase = useCallback(async () => {
    if (creatingPurchase) return;
    setError(null);

    if (!supplierId) {
      setError('Selecciona un proveedor.');
      return;
    }
    if (cart.length === 0) {
      setError('Agrega al menos un producto a la compra.');
      return;
    }
    if (cart.some((item) => item.manage_stock === false)) {
      setError('Hay productos sin control de stock en el carrito. Retiralos para continuar.');
      return;
    }
    if (cart.some((item) => {
      const quantity = Number(item.quantity || 0);
      const unitPrice = Number(item.unit_price || 0);
      return !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0;
    })) {
      setError('Hay productos con cantidad o precio invalido.');
      return;
    }
    if (!Number.isFinite(cartTotal) || cartTotal <= 0) {
      setError('El total de la compra debe ser mayor a 0.');
      return;
    }

    setCreatingPurchase(true);
    try {
      await createCompraWithRpcFallback({
        businessId,
        userId,
        supplierId,
        paymentMethod,
        notes: null,
        cart,
      });

      clearForm();
      await Promise.all([refreshPurchases(), refreshProducts()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar compra.');
    } finally {
      setCreatingPurchase(false);
    }
  }, [businessId, cart, cartTotal, clearForm, creatingPurchase, paymentMethod, refreshProducts, refreshPurchases, supplierId, userId, setError]);

  const askDeletePurchase = useCallback((purchase: CompraRecord) => {
    if (!canDeletePurchases) return;
    setPurchaseToDelete(purchase);
    setShowDeleteModal(true);
  }, [canDeletePurchases]);

  const confirmDeletePurchase = useCallback(async () => {
    if (!purchaseToDelete?.id || !canDeletePurchases) return;

    setDeletingPurchase(true);
    setError(null);
    try {
      await deleteCompraWithStockFallback({
        purchaseId: purchaseToDelete.id,
        businessId,
      });

      setPurchases((prev) => prev.filter((item) => item.id !== purchaseToDelete.id));
      if (selectedPurchase?.id === purchaseToDelete.id) {
        setShowPurchaseDetails(false);
        setSelectedPurchase(null);
        setSelectedPurchaseDetails([]);
      }

      setShowDeleteModal(false);
      setPurchaseToDelete(null);
      await refreshProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar compra.');
    } finally {
      setDeletingPurchase(false);
    }
  }, [businessId, canDeletePurchases, purchaseToDelete, refreshProducts, selectedPurchase?.id, setPurchases, setShowPurchaseDetails, setSelectedPurchase, setSelectedPurchaseDetails, setError]);

  return {
    creatingPurchase,
    purchaseToDelete,
    setPurchaseToDelete,
    showDeleteModal,
    setShowDeleteModal,
    deletingPurchase,
    submitPurchase,
    askDeletePurchase,
    confirmDeletePurchase,
  };
}
