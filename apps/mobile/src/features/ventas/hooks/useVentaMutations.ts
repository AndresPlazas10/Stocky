import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createVenta, deleteVentaWithDetails } from '../../../services/ventasService';
import {
  evaluateOrderStockShortages,
  type MesaOrderItem,
} from '../../../services/mesaOrderService';
import { calculateCashChange } from '../../../services/mesaOrderService';
import { cartReferenceKey } from './useVentaCart';
import type { PaymentMethod } from '../../../utils/paymentMethods';
import type { MesaOrderCatalogItem } from '../../../services/mesaOrderService';
import type {
  VentaCartItem,
  VentaDetailRecord,
  VentaRecord,
} from '../../../services/ventasService';

interface UseVentaMutationsParams {
  businessId: string;
  source: 'owner' | 'employee';
  cart: VentaCartItem[];
  paymentMethod: PaymentMethod;
  amountReceived: string;
  cartTotal: number;
  catalogItems: MesaOrderCatalogItem[];
  selectedVenta: VentaRecord | null;
  canDeleteSales: boolean;
  clearCart: () => void;
  refreshSales: () => Promise<void>;
  setCatalogItems: (items: MesaOrderCatalogItem[]) => void;
  setShowCreateSaleModal: (show: boolean) => void;
  setShowVentaDetails: (show: boolean) => void;
  setSelectedVenta: (venta: VentaRecord | null) => void;
  setSelectedVentaDetails: (details: VentaDetailRecord[]) => void;
  setVentas: (ventas: VentaRecord[] | ((prev: VentaRecord[]) => VentaRecord[])) => void;
  setError: (error: string | null) => void;
  onSaleCreated?: (total: number) => void;
  onSaleDeleted?: () => void;
}

export function useVentaMutations({
  businessId,
  source,
  cart,
  paymentMethod,
  amountReceived,
  cartTotal,
  catalogItems,
  selectedVenta,
  canDeleteSales,
  clearCart,
  refreshSales,
  setCatalogItems,
  setShowCreateSaleModal,
  setShowVentaDetails,
  setSelectedVenta,
  setSelectedVentaDetails,
  setVentas,
  setError,
  onSaleCreated,
  onSaleDeleted,
}: UseVentaMutationsParams) {
  const { t } = useTranslation();
  const [submitting, setSubmitting] = useState(false);
  const [ventaToDelete, setVentaToDelete] = useState<VentaRecord | null>(null);
  const [showDeleteVentaModal, setShowDeleteVentaModal] = useState(false);
  const [deletingVenta, setDeletingVenta] = useState(false);

  const cashChangeData = (() => {
    if (paymentMethod !== 'cash') return null;
    if (String(amountReceived || '').trim() === '')
      return { isValid: false, reason: 'empty' as const, change: 0, paid: 0 };
    return calculateCashChange(cartTotal, amountReceived);
  })();

  const submitSale = useCallback(async () => {
    if (submitting) return;
    setError(null);

    if (cart.length === 0) {
      setError(t('ventasSection.emptyCartError'));
      return;
    }

    const validationOrderItems: MesaOrderItem[] = cart.map((item, index) => ({
      id: `${cartReferenceKey(item)}:${index}`,
      order_id: 'virtual-sale',
      product_id: item.product_id,
      combo_id: item.combo_id,
      quantity: Number(item.quantity || 0),
      price: Number(item.unit_price || 0),
      subtotal: Number(item.subtotal || 0),
      products: item.product_id ? { name: item.name, code: item.code || undefined } : null,
      combos: item.combo_id ? { nombre: item.name } : null,
    }));
    const { insufficientItems, insufficientComboComponents } = evaluateOrderStockShortages({
      orderItems: validationOrderItems,
      catalogItems,
    });

    if (insufficientItems.length > 0) {
      const first = insufficientItems[0];
      setError(
        `${t('ventasSection.insufficientStockError')} "${first.product_name}" (disp: ${first.available_stock}, req: ${first.quantity}).`,
      );
      return;
    }

    if (insufficientComboComponents.length > 0) {
      const first = insufficientComboComponents[0];
      setError(
        `${t('ventasSection.insufficientStockError')} "${first.product_name}" (disp: ${first.available_stock}, req: ${first.required_quantity}).`,
      );
      return;
    }

    if (paymentMethod === 'cash' && !cashChangeData?.isValid) {
      setError(
        cashChangeData?.reason === 'insufficient'
          ? t('ventasSection.insufficientAmountError')
          : t('ventasSection.invalidAmountError'),
      );
      return;
    }

    setSubmitting(true);
    try {
      const idempotencySeed = `${paymentMethod}:${cart
        .map((item) => `${cartReferenceKey(item)}:${item.quantity}`)
        .sort()
        .join('|')}`;
      const amount = paymentMethod === 'cash' ? Number(cashChangeData?.paid || 0) : null;
      const breakdown: { denomination: number; count: number }[] = [];

      const result = await createVenta({
        businessId,
        cartItems: cart,
        paymentMethod,
        amountReceived: amount,
        changeBreakdown: breakdown,
        idempotencySeed,
      });

      onSaleCreated?.(cartTotal);
      clearCart();
      setShowCreateSaleModal(false);
      await Promise.all([
        refreshSales(),
        import('../../../services/ventasService')
          .then((m) => m.listVentasCatalog(businessId, { forceRefresh: true }))
          .then(setCatalogItems),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('ventasSection.createSaleError'));
    } finally {
      setSubmitting(false);
    }
  }, [
    businessId,
    catalogItems,
    cart,
    cashChangeData,
    clearCart,
    paymentMethod,
    refreshSales,
    setCatalogItems,
    setError,
    setShowCreateSaleModal,
    source,
    submitting,
  ]);

  const askDeleteVenta = useCallback(
    (venta: VentaRecord) => {
      if (!canDeleteSales) return;
      setVentaToDelete(venta);
      setShowDeleteVentaModal(true);
    },
    [canDeleteSales],
  );

  const confirmDeleteVenta = useCallback(async () => {
    if (!canDeleteSales || !ventaToDelete?.id) return;

    setDeletingVenta(true);
    setError(null);
    try {
      await deleteVentaWithDetails({
        saleId: ventaToDelete.id,
        businessId,
      });

      setVentas((prev) => prev.filter((row) => row.id !== ventaToDelete.id));
      if (selectedVenta?.id === ventaToDelete.id) {
        setShowVentaDetails(false);
        setSelectedVenta(null);
        setSelectedVentaDetails([]);
      }

      onSaleDeleted?.();
      setShowDeleteVentaModal(false);
      setVentaToDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('ventasSection.deleteSaleError'));
    } finally {
      setDeletingVenta(false);
    }
  }, [
    businessId,
    canDeleteSales,
    selectedVenta,
    ventaToDelete,
    setVentas,
    setShowVentaDetails,
    setSelectedVenta,
    setSelectedVentaDetails,
    setError,
    onSaleDeleted,
  ]);

  return {
    submitting,
    ventaToDelete,
    setVentaToDelete,
    showDeleteVentaModal,
    setShowDeleteVentaModal,
    deletingVenta,
    cashChangeData,
    submitSale,
    askDeleteVenta,
    confirmDeleteVenta,
  };
}
