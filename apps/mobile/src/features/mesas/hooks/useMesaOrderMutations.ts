import { useCallback } from 'react';
import { Alert } from 'react-native';
import * as Print from 'expo-print';
import { ensureBluetoothEnabled, BLUETOOTH_PRINT_REQUIRED_MESSAGE } from '../../../utils/bluetooth';
import { getSavedPrinter, printBytes } from '../../../services/bluetoothPrinterService';
import { getThermalPaperWidthMm } from '../../../utils/printer';
import { buildKitchenEscPos } from '../../../services/escposService';
import { buildKitchenOrderHtml } from '../../../utils/printTemplates';
import {
  calculateOrderTotal,
  listOrderItems,
  reconcileOrderItemsFromServer,
  setOrderItemsCacheSnapshot,
  sumOrderItemsQuantity,
  type MesaOrderCatalogItem,
  type MesaOrderItem,
} from '../../../services/mesaOrderService';
import {
  closeOrderAsSplit,
  closeOrderSingle,
  type PaymentMethod,
  type SplitSubAccount,
} from '../../../services/mesaCheckoutService';
import {
  compareMesaTableIdentifiers,
  formatCop,
  mesaDisplayName,
  openCloseMesa,
  type MesaRecord,
} from '../../../services/mesasService';
import { listVentaDetails, type VentaRecord } from '../../../services/ventasService';

type UseMesaOrderStateSnapshot = {
  showOrderModal: boolean;
  setShowOrderModal: (v: boolean) => void;
  selectedMesa: MesaRecord | null;
  setSelectedMesa: (v: MesaRecord | null) => void;
  orderItems: MesaOrderItem[];
  setOrderItems: (
    v: MesaOrderItem[] | ((prev: MesaOrderItem[]) => MesaOrderItem[]),
  ) => void;
  loadingOrder: boolean;
  setLoadingOrder: (v: boolean) => void;
  orderModalError: string | null;
  setOrderModalError: (v: string | null) => void;
  searchCatalog: string;
  setSearchCatalog: (v: string) => void;
  isSearchFocused: boolean;
  setIsSearchFocused: (v: boolean) => void;
  mutatingOrderItemId: string | null;
  setMutatingOrderItemId: (v: string | null) => void;
  releasingEmptyOrder: boolean;
  setReleasingEmptyOrder: (v: boolean) => void;
  isSavingOrder: boolean;
  setIsSavingOrder: (v: boolean) => void;
  showCloseOrderChoiceModal: boolean;
  setShowCloseOrderChoiceModal: (v: boolean) => void;
  showPaymentModal: boolean;
  setShowPaymentModal: (v: boolean) => void;
  showSplitBillModal: boolean;
  setShowSplitBillModal: (v: boolean) => void;
  showPaymentMethodMenu: boolean;
  setShowPaymentMethodMenu: (v: boolean) => void;
  isClosingOrder: boolean;
  setIsClosingOrder: (v: boolean) => void;
  paymentMethod: PaymentMethod;
  setPaymentMethod: (v: PaymentMethod) => void;
  amountReceived: string;
  setAmountReceived: (v: string) => void;

  addCatalogQueueRef: React.MutableRefObject<Promise<void>>;
  latestOrderItemsRef: React.MutableRefObject<MesaOrderItem[]>;
  orderItemsCacheRef: React.MutableRefObject<Map<string, MesaOrderItem[]>>;
  catalogItemsRef: React.MutableRefObject<MesaOrderCatalogItem[]>;
  pendingQuantityUpdatesRef: React.MutableRefObject<
    Map<
      string,
      {
        orderId: string;
        itemId: string;
        quantity: number;
        price: number;
        total: number;
      }
    >
  >;
  quantitySyncTimerRef: React.MutableRefObject<ReturnType<
    typeof setTimeout
  > | null>;
  orderModalOpenIntentRef: React.MutableRefObject<boolean>;

  orderTotal: number;
  cashChangeData: {
    isValid: boolean;
    reason?: 'insufficient' | 'empty' | 'invalid' | null;
    change: number;
    paid: number;
  } | null;
  getStockValidationMessage: () => string | null;
  ensureCatalogLoaded: (
    businessId: string,
    options?: { forceRefresh?: boolean },
  ) => Promise<MesaOrderCatalogItem[]>;
};

type UseMesaOrderMutationsParams = {
  order: UseMesaOrderStateSnapshot;

  businessId: string | null | undefined;
  source?: string | null;
  session: { access_token: string | null; user: { id: string } };
  heldMesaLockRef: React.MutableRefObject<{
    businessId: string;
    tableId: string;
    lockToken: string | null;
  } | null>;
  publishMesaLockBroadcast: (input: {
    businessId: string;
    tableId: string;
    locked: boolean;
    mode?: 'optimistic' | 'confirmed' | 'rollback';
    lockToken?: string | null;
    lockExpiresAt?: string | null;
  }) => void;
  publishMesaStateBroadcast: (
    mesa: MesaRecord,
    options?: {
      previousOrderId?: string | null;
      mode?: 'optimistic' | 'confirmed' | 'rollback';
      orderUnits?: number | null;
    },
  ) => void;
  acquireMesaLockForEdition: (mesa: MesaRecord) => Promise<boolean>;
  releaseHeldMesaLock: (lockSnapshot?: {
    businessId: string;
    tableId: string;
    lockToken: string | null;
  } | null) => Promise<void>;
  bumpMesaActionVersion: (mesaId: string) => number;
  isMesaActionVersionCurrent: (mesaId: string, version: number) => boolean;

  loadOpenOrderSnapshot: (
    orderId: string,
    options?: { forceRefresh?: boolean },
  ) => Promise<{ items: MesaOrderItem[]; total: number }>;
  addCatalogItemToOrder: (params: {
    orderId: string;
    catalogItem: MesaOrderCatalogItem;
    quantity: number;
  }) => Promise<{ item: MesaOrderItem }>;
  syncOrderItemQuantity: (params: {
    orderId: string;
    itemId: string;
    quantity: number;
    price: number;
    total: number;
  }) => Promise<void>;
  removeOrderItemFromOrder: (params: {
    orderId: string;
    itemId: string;
  }) => Promise<{ items: MesaOrderItem[]; total: number }>;
  persistOrderSnapshot: (params: {
    orderId: string;
    items: MesaOrderItem[];
    skipReload?: boolean;
  }) => Promise<{ items: MesaOrderItem[]; total: number }>;
  closeOrderSingle: (params: {
    businessId: string;
    orderId: string;
    tableId: string;
    paymentMethod: PaymentMethod;
    amountReceived: number | null;
    changeBreakdown: Array<{ denomination: number; count: number }>;
    orderItems: MesaOrderItem[];
  }) => Promise<{ saleId?: string | null }>;
  closeOrderAsSplit: (params: {
    businessId: string;
    orderId: string;
    tableId: string;
    subAccounts: SplitSubAccount[];
  }) => Promise<{ saleIds?: string[] | null }>;

  patchMesaOrderUnits: (orderId: string, units: number) => void;
  patchMesaOrderTotal: (mesaId: string, orderId: string, total: number) => void;
  publishRealtimeOrderSummary: (
    mesa: MesaRecord | null | undefined,
    orderId: string,
    total: number,
    units: number,
    mode?: 'optimistic' | 'confirmed' | 'rollback',
  ) => void;

  setError: (v: string | null) => void;
  setMesas: (
    v:
      | MesaRecord[]
      | ((prev: MesaRecord[]) => MesaRecord[]),
  ) => void;
  clearMesaOrderUnits: (orderId: string | null | undefined) => void;
  markMesaAsAvailableAfterSale: (mesaId: string) => void;
  loadData: () => Promise<void>;

  beginPrintFlow: () => boolean;
  endPrintFlow: () => void;
  buildCashBreakdown: (change: number) => Array<{
    denomination: number;
    count: number;
  }>;

  setPrintSalesData: (
    v: Array<{ saleRecord: VentaRecord; saleDetails: any[] }>,
  ) => void;
  setShowPrintModal: (v: boolean) => void;
};

export function useMesaOrderMutations({
  order,
  businessId,
  source,
  session,
  heldMesaLockRef,
  publishMesaLockBroadcast,
  publishMesaStateBroadcast,
  acquireMesaLockForEdition,
  releaseHeldMesaLock,
  bumpMesaActionVersion,
  isMesaActionVersionCurrent,
  loadOpenOrderSnapshot,
  addCatalogItemToOrder,
  syncOrderItemQuantity,
  removeOrderItemFromOrder,
  persistOrderSnapshot,
  closeOrderSingle,
  closeOrderAsSplit,
  patchMesaOrderUnits,
  patchMesaOrderTotal,
  publishRealtimeOrderSummary,
  setError,
  setMesas,
  clearMesaOrderUnits,
  markMesaAsAvailableAfterSale,
  loadData,
  beginPrintFlow,
  endPrintFlow,
  buildCashBreakdown,
  setPrintSalesData,
  setShowPrintModal,
}: UseMesaOrderMutationsParams) {
  const {
    showOrderModal,
    setShowOrderModal,
    selectedMesa,
    setSelectedMesa,
    orderItems,
    setOrderItems,
    loadingOrder,
    setLoadingOrder,
    orderModalError,
    setOrderModalError,
    searchCatalog,
    setSearchCatalog,
    isSearchFocused,
    setIsSearchFocused,
    mutatingOrderItemId,
    setMutatingOrderItemId,
    releasingEmptyOrder,
    setReleasingEmptyOrder,
    isSavingOrder,
    setIsSavingOrder,
    showCloseOrderChoiceModal,
    setShowCloseOrderChoiceModal,
    showPaymentModal,
    setShowPaymentModal,
    showSplitBillModal,
    setShowSplitBillModal,
    showPaymentMethodMenu,
    setShowPaymentMethodMenu,
    isClosingOrder,
    setIsClosingOrder,
    paymentMethod,
    setPaymentMethod,
    amountReceived,
    setAmountReceived,

    addCatalogQueueRef,
    latestOrderItemsRef,
    orderItemsCacheRef,
    catalogItemsRef,
    pendingQuantityUpdatesRef,
    quantitySyncTimerRef,
    orderModalOpenIntentRef,

    orderTotal,
    cashChangeData,
    getStockValidationMessage,
    ensureCatalogLoaded,
  } = order;

  const closeAuxiliaryOrderModals = useCallback(() => {
    setShowCloseOrderChoiceModal(false);
    setShowPaymentModal(false);
    setShowSplitBillModal(false);
    setPaymentMethod('cash');
    setAmountReceived('');
  }, [setShowCloseOrderChoiceModal, setShowPaymentModal, setShowSplitBillModal, setPaymentMethod, setAmountReceived]);

  const closeOrderModal = useCallback(() => {
    const held = heldMesaLockRef.current;
    if (held) {
      void releaseHeldMesaLock(held);
    }
    orderModalOpenIntentRef.current = false;
    closeAuxiliaryOrderModals();
    setShowOrderModal(false);
    setSelectedMesa(null);
    setOrderItems([]);
    setOrderModalError(null);
    setSearchCatalog('');
    setIsSearchFocused(false);
    setMutatingOrderItemId(null);
  }, [
    closeAuxiliaryOrderModals,
    heldMesaLockRef,
    releaseHeldMesaLock,
    orderModalOpenIntentRef,
    setShowOrderModal,
    setSelectedMesa,
    setOrderItems,
    setOrderModalError,
    setSearchCatalog,
    setIsSearchFocused,
    setMutatingOrderItemId,
  ]);

  const releaseEmptyOrderAndClose = useCallback(async () => {
    if (!selectedMesa?.id) {
      closeOrderModal();
      return;
    }

    if (!session.access_token) {
      setOrderModalError(
        'No hay token de sesión activo para liberar la mesa.',
      );
      return;
    }

    const mesaSnapshot = selectedMesa;
    const mesaId = selectedMesa.id;
    const closeActionVersion = bumpMesaActionVersion(mesaId);
    const orderId =
      String(selectedMesa.current_order_id || '').trim() || null;
    const optimisticMesa: MesaRecord = {
      ...mesaSnapshot,
      status: 'available',
      current_order_id: null,
      orders: null,
    };

    setReleasingEmptyOrder(true);
    setOrderModalError(null);
    setMesas((prev: MesaRecord[]) =>
      prev
        .map((row) =>
          row.id === mesaId
            ? {
                ...row,
                status: 'available',
                current_order_id: null,
                orders: null,
              }
            : row,
        )
        .sort(compareMesaTableIdentifiers),
    );
    clearMesaOrderUnits(orderId);
    if (orderId) {
      orderItemsCacheRef.current.delete(orderId);
    }
    publishMesaStateBroadcast(optimisticMesa, {
      previousOrderId: orderId,
      mode: 'optimistic',
    });
    closeOrderModal();

    try {
      const updatedMesa = await openCloseMesa({
        accessToken: session.access_token,
        userId: session.user.id,
        tableId: mesaId,
        action: 'close',
      });

      if (!isMesaActionVersionCurrent(mesaId, closeActionVersion)) {
        return;
      }

      const mergedMesa: MesaRecord = {
        ...mesaSnapshot,
        ...updatedMesa,
        orders: {
          ...(mesaSnapshot.orders || {}),
          ...(updatedMesa.orders || {}),
        },
      };

      setMesas((prev: MesaRecord[]) =>
        prev
          .map((row) => (row.id === mergedMesa.id ? mergedMesa : row))
          .sort(compareMesaTableIdentifiers),
      );
      publishMesaStateBroadcast(mergedMesa, {
        previousOrderId: orderId,
        mode: 'confirmed',
      });
    } catch (err) {
      if (!isMesaActionVersionCurrent(mesaId, closeActionVersion)) {
        return;
      }
      setMesas((prev: MesaRecord[]) =>
        prev
          .map((row) =>
            row.id === mesaSnapshot.id ? mesaSnapshot : row,
          )
          .sort(compareMesaTableIdentifiers),
      );
      publishMesaStateBroadcast(mesaSnapshot, {
        previousOrderId: orderId,
        mode: 'rollback',
      });
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo liberar la mesa.',
      );
    } finally {
      setReleasingEmptyOrder(false);
    }
  }, [
    bumpMesaActionVersion,
    clearMesaOrderUnits,
    closeOrderModal,
    isMesaActionVersionCurrent,
    publishMesaStateBroadcast,
    selectedMesa,
    session.access_token,
    session.user.id,
    setError,
    setMesas,
    setOrderModalError,
    setReleasingEmptyOrder,
    orderItemsCacheRef,
  ]);

  const flushPendingQuantityUpdates = useCallback(() => {
    if (quantitySyncTimerRef.current) {
      clearTimeout(quantitySyncTimerRef.current);
      quantitySyncTimerRef.current = null;
    }

    const pendingUpdates = Array.from(
      pendingQuantityUpdatesRef.current.values(),
    );
    if (pendingUpdates.length === 0) return;
    pendingQuantityUpdatesRef.current.clear();

    addCatalogQueueRef.current = addCatalogQueueRef.current
      .then(async () => {
        for (const update of pendingUpdates) {
          await syncOrderItemQuantity(update);
        }
      })
      .catch(async (err) => {
        const fallbackMessage =
          'No se pudo actualizar la cantidad.';
        const message =
          err instanceof Error
            ? err.message
            : String(
                (err as { message?: string } | null)?.message ||
                  fallbackMessage,
              );
        setOrderModalError(message || fallbackMessage);

        const latestUpdate =
          pendingUpdates[pendingUpdates.length - 1];
        if (!latestUpdate) return;

        try {
          const freshItems = await listOrderItems(
            latestUpdate.orderId,
          );
          setOrderItems(freshItems);
          patchMesaOrderUnits(
            latestUpdate.orderId,
            sumOrderItemsQuantity(freshItems),
          );
        } catch {
          // no-op
        }
      });
  }, [
    addCatalogQueueRef,
    patchMesaOrderUnits,
    pendingQuantityUpdatesRef,
    quantitySyncTimerRef,
    setOrderItems,
    setOrderModalError,
    syncOrderItemQuantity,
  ]);

  const scheduleQuantitySync = useCallback(
    (payload: {
      orderId: string;
      itemId: string;
      quantity: number;
      price: number;
      total: number;
    }) => {
      pendingQuantityUpdatesRef.current.set(payload.itemId, payload);

      if (quantitySyncTimerRef.current) {
        clearTimeout(quantitySyncTimerRef.current);
      }

      quantitySyncTimerRef.current = setTimeout(() => {
        quantitySyncTimerRef.current = null;
        flushPendingQuantityUpdates();
      }, 110);
    },
    [flushPendingQuantityUpdates, pendingQuantityUpdatesRef, quantitySyncTimerRef],
  );

  const handleAddCatalogItem = useCallback(
    async (catalogItem: MesaOrderCatalogItem) => {
      if (!selectedMesa?.current_order_id) {
        setOrderModalError(
          'No hay una orden activa para agregar items.',
        );
        return;
      }
      if (isClosingOrder || loadingOrder || releasingEmptyOrder)
        return;

      setSearchCatalog('');
      const orderId = selectedMesa.current_order_id;
      let optimisticItems: MesaOrderItem[] = [];
      let previousItemsSnapshot: MesaOrderItem[] = [];
      setOrderItems((prev: MesaOrderItem[]) => {
        previousItemsSnapshot = prev;
        const existing = prev.find((item) => {
          if (catalogItem.item_type === 'combo') {
            return (
              String(item.combo_id || '') ===
              String(catalogItem.combo_id || '')
            );
          }
          return (
            String(item.product_id || '') ===
            String(catalogItem.product_id || '')
          );
        });

        if (existing) {
          optimisticItems = prev.map((item) => {
            if (item.id !== existing.id) return item;
            const nextQuantity = Number(item.quantity || 0) + 1;
            const unitPrice = Number(
              item.price || catalogItem.sale_price || 0,
            );
            return {
              ...item,
              quantity: nextQuantity,
              subtotal: nextQuantity * unitPrice,
            };
          });
        } else {
          const optimisticId = `tmp-${catalogItem.item_type}:${catalogItem.id}-${Date.now()}`;
          optimisticItems = [
            ...prev,
            {
              id: optimisticId,
              order_id: orderId,
              product_id:
                catalogItem.item_type === 'product'
                  ? catalogItem.product_id
                  : null,
              combo_id:
                catalogItem.item_type === 'combo'
                  ? catalogItem.combo_id
                  : null,
              quantity: 1,
              price: Number(catalogItem.sale_price || 0),
              subtotal: Number(catalogItem.sale_price || 0),
              products:
                catalogItem.item_type === 'product'
                  ? {
                      id: catalogItem.product_id,
                      name: catalogItem.name,
                      code: catalogItem.code || undefined,
                    }
                  : null,
              combos:
                catalogItem.item_type === 'combo'
                  ? {
                      id: catalogItem.combo_id,
                      nombre: catalogItem.name,
                    }
                  : null,
            },
          ];
        }

        return optimisticItems;
      });

      const optimisticUnits = sumOrderItemsQuantity(optimisticItems);
      const optimisticTotal = calculateOrderTotal(optimisticItems);
      patchMesaOrderUnits(orderId, optimisticUnits);
      patchMesaOrderTotal(
        selectedMesa.id,
        orderId,
        optimisticTotal,
      );
      publishRealtimeOrderSummary(
        selectedMesa,
        orderId,
        optimisticTotal,
        optimisticUnits,
        'optimistic',
      );
      setOrderModalError(null);
      addCatalogQueueRef.current = addCatalogQueueRef.current
        .then(async () => {
          const result = await addCatalogItemToOrder({
            orderId,
            catalogItem,
            quantity: 1,
          });
          const confirmedItem: MesaOrderItem = {
            ...result.item,
            products:
              catalogItem.item_type === 'product'
                ? {
                    id: catalogItem.product_id,
                    name: catalogItem.name,
                    code: catalogItem.code || undefined,
                  }
                : null,
            combos:
              catalogItem.item_type === 'combo'
                ? {
                    id: catalogItem.combo_id,
                    nombre: catalogItem.name,
                  }
                : null,
          };

          setOrderItems((prev: MesaOrderItem[]) => {
            const next = reconcileOrderItemsFromServer(prev, [
              confirmedItem,
            ]);
            const confirmedUnits = sumOrderItemsQuantity(next);
            const confirmedTotal = calculateOrderTotal(next);
            patchMesaOrderUnits(orderId, confirmedUnits);
            patchMesaOrderTotal(
              selectedMesa.id,
              orderId,
              confirmedTotal,
            );
            publishRealtimeOrderSummary(
              selectedMesa,
              orderId,
              confirmedTotal,
              confirmedUnits,
              'confirmed',
            );
            return next;
          });

          if (
            catalogItem.item_type === 'product' &&
            catalogItem.manage_stock
          ) {
            if (
              Number(catalogItem.stock) <
              Number(confirmedItem.quantity || 0)
            ) {
              setOrderModalError(
                `Stock insuficiente para ${catalogItem.name}. Disponible: ${catalogItem.stock}.`,
              );
            }
          }
        })
        .catch((err) => {
          setOrderItems(previousItemsSnapshot);
          const rollbackUnits = sumOrderItemsQuantity(
            previousItemsSnapshot,
          );
          const rollbackTotal = calculateOrderTotal(
            previousItemsSnapshot,
          );
          patchMesaOrderUnits(orderId, rollbackUnits);
          patchMesaOrderTotal(
            selectedMesa.id,
            orderId,
            rollbackTotal,
          );
          publishRealtimeOrderSummary(
            selectedMesa,
            orderId,
            rollbackTotal,
            rollbackUnits,
            'rollback',
          );
          setOrderModalError(
            err instanceof Error
              ? err.message
              : 'No se pudo agregar el item.',
          );
        });
    },
    [
      addCatalogItemToOrder,
      addCatalogQueueRef,
      calculateOrderTotal,
      isClosingOrder,
      loadingOrder,
      patchMesaOrderTotal,
      patchMesaOrderUnits,
      publishRealtimeOrderSummary,
      reconcileOrderItemsFromServer,
      releasingEmptyOrder,
      selectedMesa,
      setOrderItems,
      setOrderModalError,
      setSearchCatalog,
      sumOrderItemsQuantity,
    ],
  );

  const handleUpdateOrderItemQuantity = useCallback(
    (item: MesaOrderItem, delta: number) => {
      if (!selectedMesa?.current_order_id) {
        setOrderModalError(
          'No hay una orden activa para actualizar.',
        );
        return;
      }
      if (String(item.id || '').startsWith('tmp-')) {
        setOrderModalError(
          'Espera un momento mientras se confirma el producto.',
        );
        return;
      }

      const orderId = selectedMesa.current_order_id;
      const itemPrice = Number(item.price || 0);
      let optimisticItems: MesaOrderItem[] = [];
      let resolvedQuantity = 0;

      setOrderItems((prev: MesaOrderItem[]) => {
        const currentRow = prev.find((row) => row.id === item.id);
        if (!currentRow) {
          optimisticItems = prev;
          resolvedQuantity = 0;
          return prev;
        }

        resolvedQuantity = Math.max(
          0,
          Number(currentRow.quantity || 0) + delta,
        );
        if (resolvedQuantity <= 0) {
          optimisticItems = prev.filter(
            (row) => row.id !== item.id,
          );
          return optimisticItems;
        }

        optimisticItems = prev.map((row) =>
          row.id === item.id
            ? {
                ...row,
                quantity: resolvedQuantity,
                subtotal:
                  resolvedQuantity * Number(row.price || 0),
              }
            : row,
        );

        return optimisticItems;
      });

      const optimisticTotal = calculateOrderTotal(optimisticItems);
      const optimisticUnits =
        sumOrderItemsQuantity(optimisticItems);
      patchMesaOrderUnits(orderId, optimisticUnits);
      patchMesaOrderTotal(
        selectedMesa.id,
        orderId,
        optimisticTotal,
      );
      publishRealtimeOrderSummary(
        selectedMesa,
        orderId,
        optimisticTotal,
        optimisticUnits,
        'optimistic',
      );
      setOrderModalError(null);

      scheduleQuantitySync({
        orderId,
        itemId: item.id,
        quantity: resolvedQuantity,
        price: itemPrice,
        total: optimisticTotal,
      });
    },
    [
      calculateOrderTotal,
      patchMesaOrderTotal,
      patchMesaOrderUnits,
      publishRealtimeOrderSummary,
      scheduleQuantitySync,
      selectedMesa,
      setOrderItems,
      setOrderModalError,
      sumOrderItemsQuantity,
    ],
  );

  const handleRemoveOrderItem = useCallback(
    async (item: MesaOrderItem) => {
      if (!selectedMesa?.current_order_id) {
        setOrderModalError(
          'No hay una orden activa para eliminar items.',
        );
        return;
      }

      setMutatingOrderItemId(item.id);
      setOrderModalError(null);

      try {
        const result = await removeOrderItemFromOrder({
          orderId: selectedMesa.current_order_id,
          itemId: item.id,
        });

        setOrderItems(result.items);
        const nextUnits = sumOrderItemsQuantity(result.items);
        patchMesaOrderUnits(
          selectedMesa.current_order_id,
          nextUnits,
        );
        patchMesaOrderTotal(
          selectedMesa.id,
          selectedMesa.current_order_id,
          result.total,
        );
        publishRealtimeOrderSummary(
          selectedMesa,
          selectedMesa.current_order_id,
          result.total,
          nextUnits,
          'confirmed',
        );
      } catch (err) {
        setOrderModalError(
          err instanceof Error
            ? err.message
            : 'No se pudo eliminar el item.',
        );
      } finally {
        setMutatingOrderItemId(null);
      }
    },
    [
      patchMesaOrderTotal,
      patchMesaOrderUnits,
      publishRealtimeOrderSummary,
      removeOrderItemFromOrder,
      selectedMesa,
      setMutatingOrderItemId,
      setOrderItems,
      setOrderModalError,
      sumOrderItemsQuantity,
    ],
  );

  const handleSaveOrder = useCallback(async () => {
    if (releasingEmptyOrder || isClosingOrder || isSavingOrder)
      return;

    const snapshotBeforeSave = latestOrderItemsRef.current;
    if (snapshotBeforeSave.length === 0) {
      void releaseEmptyOrderAndClose();
      return;
    }

    if (!selectedMesa?.id || !selectedMesa.current_order_id) {
      setOrderModalError('No hay una orden activa para guardar.');
      return;
    }

    setIsSavingOrder(true);
    setOrderModalError(null);

    try {
      if (quantitySyncTimerRef.current) {
        clearTimeout(quantitySyncTimerRef.current);
        quantitySyncTimerRef.current = null;
      }
      pendingQuantityUpdatesRef.current.clear();

      void addCatalogQueueRef.current;

      const snapshotToPersist = latestOrderItemsRef.current;
      if (snapshotToPersist.length === 0) {
        void releaseEmptyOrderAndClose();
        return;
      }

      const persisted = await persistOrderSnapshot({
        orderId: selectedMesa.current_order_id,
        items: snapshotToPersist,
        skipReload: true,
      });

      setOrderItems(persisted.items);
      orderItemsCacheRef.current.set(
        selectedMesa.current_order_id,
        persisted.items,
      );
      setOrderItemsCacheSnapshot(
        selectedMesa.current_order_id,
        persisted.items,
      );
      const persistedUnits = sumOrderItemsQuantity(
        persisted.items,
      );
      patchMesaOrderTotal(
        selectedMesa.id,
        selectedMesa.current_order_id,
        persisted.total,
      );
      patchMesaOrderUnits(
        selectedMesa.current_order_id,
        persistedUnits,
      );
      publishRealtimeOrderSummary(
        selectedMesa,
        selectedMesa.current_order_id,
        persisted.total,
        persistedUnits,
        'confirmed',
      );
      closeOrderModal();
    } catch (err) {
      const fallbackMessage = 'No se pudo guardar la orden.';
      const message =
        err instanceof Error
          ? err.message
          : String(
              (err as { message?: string; details?: string } | null)
                ?.message ||
                (err as { details?: string } | null)?.details ||
                fallbackMessage,
            );
      setOrderModalError(message || fallbackMessage);
    } finally {
      setIsSavingOrder(false);
    }
  }, [
    addCatalogQueueRef,
    closeOrderModal,
    isClosingOrder,
    isSavingOrder,
    latestOrderItemsRef,
    orderItemsCacheRef,
    patchMesaOrderTotal,
    patchMesaOrderUnits,
    pendingQuantityUpdatesRef,
    persistOrderSnapshot,
    publishRealtimeOrderSummary,
    quantitySyncTimerRef,
    releaseEmptyOrderAndClose,
    releasingEmptyOrder,
    selectedMesa,
    setIsSavingOrder,
    setOrderItems,
    setOrderModalError,
    setOrderItemsCacheSnapshot,
    sumOrderItemsQuantity,
  ]);

  const openOrderModal = useCallback(
    async (
      mesa: MesaRecord,
      options?: {
        skipOrderItemsFetch?: boolean;
        initialItems?: MesaOrderItem[];
        skipLockAcquire?: boolean;
      },
    ) => {
      orderModalOpenIntentRef.current = true;
      if (!mesa?.current_order_id) {
        setError('La mesa no tiene una orden activa para gestionar.');
        return false;
      }

      if (!businessId) {
        setError(
          'No se encontro el negocio activo para cargar el catalogo.',
        );
        return false;
      }

      const orderId = String(mesa.current_order_id || '').trim();
      const providedItems = Array.isArray(options?.initialItems)
        ? options.initialItems
        : null;
      const inMemoryCache = orderId
        ? orderItemsCacheRef.current.get(orderId)
        : null;
      const serviceCache = orderId
        ? {
            items:
              orderItemsCacheRef.current.get(orderId) || null,
          }
        : null;
      const cachedItems =
        providedItems || inMemoryCache || serviceCache?.items || null;
      const skipOrderItemsFetch =
        options?.skipOrderItemsFetch === true;

      setSelectedMesa(mesa);
      setShowOrderModal(true);
      setLoadingOrder(!cachedItems && !skipOrderItemsFetch);
      setOrderModalError(null);

      if (cachedItems) {
        setOrderItems(cachedItems);
        if (orderId) {
          orderItemsCacheRef.current.set(orderId, cachedItems);
        }
        patchMesaOrderUnits(
          orderId,
          sumOrderItemsQuantity(cachedItems),
        );
        patchMesaOrderTotal(
          mesa.id,
          orderId,
          calculateOrderTotal(cachedItems),
        );
      }

      const skipLockAcquire =
        options?.skipLockAcquire === true;

      void ensureCatalogLoaded(businessId).catch(() => {});

      if (skipOrderItemsFetch) {
        if (!cachedItems) {
          setOrderItems([]);
          patchMesaOrderUnits(orderId, 0);
          orderItemsCacheRef.current.set(orderId, []);
        }
        if (!skipLockAcquire) {
          acquireMesaLockForEdition(mesa).then((granted) => {
            if (!granted) {
              setLoadingOrder(false);
              setShowOrderModal(false);
              setSelectedMesa(null);
              setOrderItems([]);
              setError(
                'Alguien esta usando esta mesa.',
              );
            }
          });
        }
        setLoadingOrder(false);
        return true;
      }

      if (!skipLockAcquire) {
        const lockPromise = acquireMesaLockForEdition(mesa);
        const snapshotPromise = loadOpenOrderSnapshot(orderId, {
          forceRefresh: Boolean(cachedItems),
        });

        Promise.all([lockPromise, snapshotPromise])
          .then(([lockGranted, snapshot]) => {
            if (!lockGranted) {
              setLoadingOrder(false);
              setShowOrderModal(false);
              setSelectedMesa(null);
              setOrderItems([]);
              setSearchCatalog('');
              setIsSearchFocused(false);
              setMutatingOrderItemId(null);
              setError(
                'Alguien esta usando esta mesa.',
              );
              return;
            }

            if (snapshot) {
              const previousItems =
                cachedItems ||
                orderItemsCacheRef.current.get(orderId) ||
                [];
              const mergedItems =
                reconcileOrderItemsFromServer(
                  previousItems,
                  snapshot.items,
                );
              setOrderItems(mergedItems);
              orderItemsCacheRef.current.set(
                orderId,
                mergedItems,
              );
              setOrderItemsCacheSnapshot(
                orderId,
                mergedItems,
              );
              patchMesaOrderUnits(
                orderId,
                sumOrderItemsQuantity(mergedItems),
              );
              patchMesaOrderTotal(
                mesa.id,
                orderId,
                calculateOrderTotal(mergedItems),
              );
            }

            setLoadingOrder(false);
          })
          .catch((err) => {
            if (!cachedItems) {
              setOrderModalError(
                err instanceof Error
                  ? err.message
                  : 'No se pudo cargar la orden.',
              );
            }
            setLoadingOrder(false);
          });

        return true;
      }

      try {
        const snapshot = await loadOpenOrderSnapshot(orderId, {
          forceRefresh: Boolean(cachedItems),
        });
        const previousItems =
          cachedItems ||
          orderItemsCacheRef.current.get(orderId) ||
          [];
        const mergedItems = reconcileOrderItemsFromServer(
          previousItems,
          snapshot.items,
        );
        setOrderItems(mergedItems);
        orderItemsCacheRef.current.set(orderId, mergedItems);
        setOrderItemsCacheSnapshot(orderId, mergedItems);
        patchMesaOrderUnits(
          orderId,
          sumOrderItemsQuantity(mergedItems),
        );
        patchMesaOrderTotal(
          mesa.id,
          orderId,
          calculateOrderTotal(mergedItems),
        );
      } catch (err) {
        if (!cachedItems) {
          setOrderModalError(
            err instanceof Error
              ? err.message
              : 'No se pudo cargar la orden.',
          );
        }
      } finally {
        setLoadingOrder(false);
      }
      return true;
    },
    [
      acquireMesaLockForEdition,
      businessId,
      calculateOrderTotal,
      ensureCatalogLoaded,
      loadOpenOrderSnapshot,
      orderItemsCacheRef,
      orderModalOpenIntentRef,
      patchMesaOrderTotal,
      patchMesaOrderUnits,
      reconcileOrderItemsFromServer,
      setError,
      setIsSearchFocused,
      setLoadingOrder,
      setMutatingOrderItemId,
      setOrderItems,
      setOrderItemsCacheSnapshot,
      setOrderModalError,
      setSearchCatalog,
      setSelectedMesa,
      setShowOrderModal,
      sumOrderItemsQuantity,
    ],
  );

  const handleCloseOrder = useCallback(() => {
    if (orderItems.length === 0) {
      setOrderModalError(
        'No hay productos en la orden para cerrar.',
      );
      return;
    }

    setShowOrderModal(false);
    setShowCloseOrderChoiceModal(true);
  }, [orderItems.length, setOrderModalError, setShowCloseOrderChoiceModal, setShowOrderModal]);

  const handlePayAllTogether = useCallback(() => {
    setShowCloseOrderChoiceModal(false);
    setShowSplitBillModal(false);
    setShowPaymentMethodMenu(false);
    setAmountReceived(String(Math.round(orderTotal || 0)));
    setPaymentMethod('cash');
    setShowPaymentModal(true);
  }, [
    orderTotal,
    setAmountReceived,
    setPaymentMethod,
    setShowCloseOrderChoiceModal,
    setShowPaymentMethodMenu,
    setShowPaymentModal,
    setShowSplitBillModal,
  ]);

  const askReceiptPrintConfirmation = useCallback(
    async (saleIds: string[] = []) => {
      if (!Array.isArray(saleIds) || saleIds.length === 0)
        return false;

      try {
        const salesDataList: Array<{
          saleRecord: VentaRecord;
          saleDetails: any[];
        }> = [];

        for (const saleId of saleIds) {
          try {
            const normalizedSaleId = String(saleId || '').trim();
            if (!normalizedSaleId) continue;

            const fetchedDetails =
              await listVentaDetails(normalizedSaleId);
            let details =
              Array.isArray(fetchedDetails) &&
              fetchedDetails.length > 0
                ? fetchedDetails
                : null;

            if (!details) {
              await new Promise<void>((resolve) =>
                setTimeout(resolve, 1000),
              );
              const retry =
                await listVentaDetails(normalizedSaleId);
              details =
                Array.isArray(retry) && retry.length > 0
                  ? retry
                  : [];
            }

            const computedTotal = details.reduce(
              (sum, item) => sum + Number(item?.subtotal || 0),
              0,
            );
            const saleForPrint: VentaRecord = {
              id: normalizedSaleId,
              business_id: businessId || '',
              user_id: null,
              seller_name:
                source === 'employee'
                  ? 'Empleado'
                  : 'Administrador',
              payment_method: paymentMethod,
              total: Number(computedTotal),
              created_at: new Date().toISOString(),
              amount_received: null,
              change_amount: null,
              change_breakdown: [],
            };

            salesDataList.push({
              saleRecord: saleForPrint,
              saleDetails: details,
            });
          } catch {
            // Continuar con el siguiente
          }
        }

        if (salesDataList.length === 0) return false;

        setPrintSalesData(salesDataList);
        setShowPrintModal(true);

        return true;
      } catch {
        return false;
      }
    },
    [businessId, source, paymentMethod, setPrintSalesData, setShowPrintModal],
  );

  const processPaymentAndClose = useCallback(async () => {
    if (
      !businessId ||
      !selectedMesa?.id ||
      !selectedMesa.current_order_id
    ) {
      setOrderModalError(
        'No se encontro una orden activa para cerrar.',
      );
      return;
    }

    const stockMessage = getStockValidationMessage();
    if (stockMessage) {
      setOrderModalError(stockMessage);
      return;
    }

    if (paymentMethod === 'cash') {
      if (!cashChangeData?.isValid) {
        setOrderModalError(
          cashChangeData?.reason === 'insufficient'
            ? 'El monto recibido es menor al total de la cuenta.'
            : 'Ingresa un monto recibido valido.',
        );
        return;
      }
    }

    setIsClosingOrder(true);
    setOrderModalError(null);

    try {
      const resolvedAmountReceived =
        paymentMethod === 'cash'
          ? Number(cashChangeData?.paid || 0)
          : null;
      const resolvedChangeBreakdown =
        paymentMethod === 'cash'
          ? buildCashBreakdown(Number(cashChangeData?.change || 0))
          : [];

      const closeResult = await closeOrderSingle({
        businessId,
        orderId: selectedMesa.current_order_id,
        tableId: selectedMesa.id,
        paymentMethod,
        amountReceived: resolvedAmountReceived,
        changeBreakdown: resolvedChangeBreakdown,
        orderItems,
      });

      markMesaAsAvailableAfterSale(selectedMesa.id);
      closeOrderModal();

      if (closeResult.saleId) {
        askReceiptPrintConfirmation([closeResult.saleId]);
      }
      void loadData();
    } catch (err) {
      setOrderModalError(
        err instanceof Error
          ? err.message
          : 'No se pudo cerrar la orden.',
      );
    } finally {
      setIsClosingOrder(false);
    }
  }, [
    askReceiptPrintConfirmation,
    buildCashBreakdown,
    businessId,
    cashChangeData,
    closeOrderModal,
    closeOrderSingle,
    getStockValidationMessage,
    loadData,
    markMesaAsAvailableAfterSale,
    orderItems,
    paymentMethod,
    selectedMesa,
    setIsClosingOrder,
    setOrderModalError,
  ]);

  const processSplitPaymentAndClose = useCallback(
    async ({ subAccounts }: { subAccounts: SplitSubAccount[] }) => {
      if (
        !businessId ||
        !selectedMesa?.id ||
        !selectedMesa.current_order_id
      ) {
        setOrderModalError(
          'No se encontro una orden activa para cerrar.',
        );
        return;
      }

      const stockMessage = getStockValidationMessage();
      if (stockMessage) {
        setOrderModalError(stockMessage);
        return;
      }

      setIsClosingOrder(true);
      setOrderModalError(null);

      try {
        const splitResult = await closeOrderAsSplit({
          businessId,
          orderId: selectedMesa.current_order_id,
          tableId: selectedMesa.id,
          subAccounts,
        });

        markMesaAsAvailableAfterSale(selectedMesa.id);
        closeOrderModal();

        if (
          Array.isArray(splitResult.saleIds) &&
          splitResult.saleIds.length > 0
        ) {
          askReceiptPrintConfirmation(splitResult.saleIds);
        }
        void loadData();
      } catch (err) {
        setOrderModalError(
          err instanceof Error
            ? err.message
            : 'No se pudo cerrar la orden dividida.',
        );
      } finally {
        setIsClosingOrder(false);
      }
    },
    [
      askReceiptPrintConfirmation,
      businessId,
      closeOrderAsSplit,
      closeOrderModal,
      getStockValidationMessage,
      loadData,
      markMesaAsAvailableAfterSale,
      selectedMesa,
      setIsClosingOrder,
      setOrderModalError,
    ],
  );

  const handlePrintKitchen = useCallback(async () => {
    if (!selectedMesa) {
      Alert.alert(
        'Impresion de cocina',
        'No hay una mesa seleccionada.',
      );
      return;
    }

    if (!Array.isArray(orderItems) || orderItems.length === 0) {
      Alert.alert(
        'Impresion de cocina',
        'No hay productos en la orden para imprimir.',
      );
      return;
    }

    const normalizeCategory = (value: unknown) =>
      String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();

    const productCatalogLookup = new Map(
      catalogItemsRef.current
        .filter((item) => item.item_type === 'product')
        .map((item) => [item.product_id, item]),
    );

    const comboCatalogLookup = new Map(
      catalogItemsRef.current
        .filter((item) => item.item_type === 'combo')
        .map((item) => [item.combo_id, item]),
    );

    const categoriasParaCocina = new Set([
      'plato',
      'platos',
      'cocina',
      'comida',
    ]);
    const itemsParaCocina = orderItems.filter((item) => {
      if (item.combo_id) return true;
      const catalogCategory =
        productCatalogLookup.get(item.product_id || '')
          ?.category;
      const category = normalizeCategory(
        item.category ??
          item.products?.category ??
          catalogCategory,
      );
      return (
        categoriasParaCocina.has(category) ||
        category.startsWith('plato') ||
        category.includes('plato')
      );
    });

    const itemsParaCocinaConNombre = itemsParaCocina.map((item) => {
      if (item.combo_id) {
        const catalogCombo = comboCatalogLookup.get(
          item.combo_id || '',
        );
        const existingComboName = String(
          item?.combos?.nombre || '',
        ).trim();
        const fallbackComboName = String(
          catalogCombo?.name || '',
        ).trim();

        if (existingComboName || !fallbackComboName) return item;

        return {
          ...item,
          combos: {
            ...(item.combos || {}),
            id: item?.combos?.id || catalogCombo?.combo_id,
            nombre: fallbackComboName,
          },
        };
      }

      const catalogProduct = productCatalogLookup.get(
        item.product_id || '',
      );
      const existingName = String(
        item?.products?.name || '',
      ).trim();
      const fallbackName = String(
        catalogProduct?.name || '',
      ).trim();

      if (existingName || !fallbackName) return item;

      return {
        ...item,
        products: {
          ...(item.products || {}),
          id: item?.products?.id || catalogProduct?.product_id,
          name: fallbackName,
          code:
            item?.products?.code ||
            catalogProduct?.code ||
            undefined,
          category:
            item?.products?.category ||
            catalogProduct?.category ||
            undefined,
        },
      };
    });

    if (itemsParaCocinaConNombre.length === 0) {
      Alert.alert(
        'Impresion de cocina',
        'No hay productos que requieran preparación en cocina.',
      );
      return;
    }

    const btReady = await ensureBluetoothEnabled();
    if (!btReady) {
      Alert.alert(
        'Bluetooth desactivado',
        BLUETOOTH_PRINT_REQUIRED_MESSAGE,
      );
      return;
    }

    if (!beginPrintFlow()) {
      Alert.alert(
        'Impresion de cocina',
        'Ya hay una impresión en curso. Espera a que finalice.',
      );
      return;
    }

    try {
      const mesaLabel =
        selectedMesa.table_number ??
        selectedMesa.name ??
        '-';

      const savedPrinter = await getSavedPrinter();
      if (savedPrinter) {
        const paperWidthMm = await getThermalPaperWidthMm();
        const escposData = buildKitchenEscPos({
          mesaNumber: mesaLabel,
          items: itemsParaCocinaConNombre.map((item) => ({
            name:
              item?.products?.name ||
              item?.combos?.nombre ||
              'Item',
            quantity: Number(item?.quantity || 0),
          })),
          paperWidthMm,
        });
        const ok = await printBytes(
          savedPrinter.address,
          escposData,
        );
        if (ok) {
          Alert.alert(
            'Impresion de cocina',
            'Orden enviada a la impresora.',
          );
          return;
        }
        Alert.alert(
          'Impresion de cocina',
          'No se pudo enviar a la impresora. Verifica la conexion Bluetooth.',
        );
        return;
      }

      const html = buildKitchenOrderHtml({
        mesaNumber: mesaLabel,
        mesaStatus: selectedMesa.status,
        items: itemsParaCocinaConNombre,
        createdAt: new Date(),
      });
      if (__DEV__)
        console.log(
          '[Print] Kitchen: calling Print.printAsync for mesa ' +
            mesaLabel,
        );
      await Print.printAsync({ html });
      if (__DEV__)
        console.log(
          '[Print] Kitchen: Print.printAsync resolved',
        );
    } catch (err) {
      console.error(
        '[Print] Kitchen: Print.printAsync error',
        err,
      );
      Alert.alert(
        'Impresion de cocina',
        err instanceof Error
          ? err.message
          : 'No se pudo imprimir la orden.',
      );
    } finally {
      endPrintFlow();
    }
  }, [
    beginPrintFlow,
    catalogItemsRef,
    endPrintFlow,
    orderItems,
    selectedMesa,
  ]);

  return {
    closeAuxiliaryOrderModals,
    closeOrderModal,
    releaseEmptyOrderAndClose,
    flushPendingQuantityUpdates,
    scheduleQuantitySync,
    handleAddCatalogItem,
    handleUpdateOrderItemQuantity,
    handleRemoveOrderItem,
    handleSaveOrder,
    openOrderModal,
    handleCloseOrder,
    handlePayAllTogether,
    askReceiptPrintConfirmation,
    processPaymentAndClose,
    processSplitPaymentAndClose,
    handlePrintKitchen,
  };
}

export type UseMesaOrderMutationsReturn = ReturnType<
  typeof useMesaOrderMutations
>;
