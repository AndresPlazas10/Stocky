import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ensureBluetoothEnabled, BLUETOOTH_PRINT_REQUIRED_MESSAGE } from '../../../utils/bluetooth';
import { getSavedPrinter, connectPrintDisconnect } from '../../../services/bluetoothPrinterService';
import { getThermalPaperWidthMm, isAutoCutEnabled } from '../../../utils/printer';
import { buildKitchenEscPos } from '../../../services/escposService';
import { buildReceiptLabels } from '../../../utils/receiptLabels';
import { useBusinessConfig } from '../../../contexts/BusinessConfigContext';
import {
  calculateOrderTotal,
  listOrderItems,
  reconcileOrderItemsFromServer,
  setOrderItemsCacheSnapshot,
  sumOrderItemsQuantity,
  type MesaOrderCatalogItem,
  type MesaOrderItem,
} from '../../../services/mesaOrderService';
import { type PaymentMethod, type SplitSubAccount } from '../../../services/mesaCheckoutService';
import {
  compareMesaTableIdentifiers,
  openCloseMesa,
  resolveMesaSyncVersion,
  type MesaRecord,
} from '../../../services/mesasService';
import { resetOrderFlow } from '../utils/mesaHelpers';

type UseMesaOrderStateSnapshot = {
  showOrderModal: boolean;
  setShowOrderModal: (v: boolean) => void;
  selectedMesa: MesaRecord | null;
  setSelectedMesa: (v: MesaRecord | null) => void;
  orderItems: MesaOrderItem[];
  setOrderItems: (v: MesaOrderItem[] | ((prev: MesaOrderItem[]) => MesaOrderItem[])) => void;
  loadingOrder: boolean;
  setLoadingOrder: (v: boolean) => void;
  orderModalError: string | null;
  setOrderModalError: (v: string | null) => void;
  searchCatalog: string;
  setSearchCatalog: (v: string) => void;
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
  hasPendingChanges: boolean;
  setHasPendingChanges: (v: boolean) => void;

  quantityFlushQueueRef: React.MutableRefObject<Promise<void>>;
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

  auth: {
    businessId: string | null | undefined;
    source?: string | null;
    session: { access_token: string | null; user: { id: string } };
  };

  lockOps: {
    heldMesaLockRef: React.MutableRefObject<{
      businessId: string;
      tableId: string;
      lockToken: string | null;
    } | null>;
    acquireMesaLockForEdition: (mesa: MesaRecord) => Promise<boolean>;
    releaseHeldMesaLock: (
      lockSnapshot?: {
        businessId: string;
        tableId: string;
        lockToken: string | null;
      } | null,
    ) => Promise<void>;
  };

  broadcastOps: {
    publishMesaStateBroadcast: (
      mesa: MesaRecord,
      options?: {
        previousOrderId?: string | null;
        mode?: 'optimistic' | 'confirmed' | 'rollback';
        orderUnits?: number | null;
      },
    ) => void;
    bumpMesaActionVersion: (mesaId: string) => number;
    isMesaActionVersionCurrent: (mesaId: string, version: number) => boolean;
    beginPendingEmptyRelease: (mesaId: string, syncVersion: number) => void;
    endPendingEmptyRelease: (mesaId: string) => void;
    isPendingEmptyRelease: (mesaId: string) => boolean;
  };

  orderServices: {
    loadOpenOrderSnapshot: (
      orderId: string,
      options?: { forceRefresh?: boolean },
    ) => Promise<{ items: MesaOrderItem[]; total: number }>;
    syncOrderItemQuantity: (params: {
      orderId: string;
      itemId: string;
      quantity: number;
      price: number;
      total: number;
    }) => Promise<void>;
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
      changeBreakdown: { denomination: number; count: number }[];
      orderItems: MesaOrderItem[];
    }) => Promise<{ saleId?: string | null }>;
    closeOrderAsSplit: (params: {
      businessId: string;
      orderId: string;
      tableId: string;
      subAccounts: SplitSubAccount[];
    }) => Promise<{ saleIds?: string[] | null }>;
  };

  dataLoader: {
    patchMesaOrderTotal: (mesaId: string, orderId: string, total: number) => void;
    publishRealtimeOrderSummary: (
      mesa: MesaRecord | null | undefined,
      orderId: string,
      total: number,
      units: number,
      mode?: 'optimistic' | 'confirmed' | 'rollback',
    ) => void;
    loadData: () => Promise<void>;
  };

  globalSetters: {
    setError: (v: string | null) => void;
    setMesas: (v: MesaRecord[] | ((prev: MesaRecord[]) => MesaRecord[])) => void;
    markMesaAsAvailableAfterSale: (mesaId: string) => void;
  };

  printOps: {
    beginPrintFlow: () => boolean;
    endPrintFlow: () => void;
    buildCashBreakdown: (change: number) => {
      denomination: number;
      count: number;
    }[];
  };

  callbacks?: {
    onOrderSaved?: () => void;
    onOrderClosed?: (mesaLabel: string, total: number) => void;
    onKitchenPrinted?: () => void;
    onNoKitchenItems?: () => void;
    onNoPrinterConnected?: () => void;
    onPrintError?: (error: string) => void;
  };
};

export function useMesaOrderMutations({
  order,
  auth,
  lockOps,
  broadcastOps,
  orderServices,
  dataLoader,
  globalSetters,
  printOps,
  callbacks,
}: UseMesaOrderMutationsParams) {
  const { businessId, source, session } = auth;
  const { heldMesaLockRef, acquireMesaLockForEdition, releaseHeldMesaLock } = lockOps;
  const { publishMesaStateBroadcast, bumpMesaActionVersion, isMesaActionVersionCurrent, beginPendingEmptyRelease, endPendingEmptyRelease, isPendingEmptyRelease } = broadcastOps;
  const { loadOpenOrderSnapshot, syncOrderItemQuantity, persistOrderSnapshot, closeOrderSingle, closeOrderAsSplit } = orderServices;
  const { patchMesaOrderTotal, publishRealtimeOrderSummary, loadData } = dataLoader;
  const { setError, setMesas, markMesaAsAvailableAfterSale } = globalSetters;
  const { beginPrintFlow, endPrintFlow, buildCashBreakdown } = printOps;
  const { onOrderSaved, onOrderClosed, onKitchenPrinted, onNoKitchenItems, onNoPrinterConnected, onPrintError } = callbacks ?? {};
  const { t } = useTranslation('mesas');
  const { timezone } = useBusinessConfig();
  const {
    showOrderModal: _showOrderModal,
    setShowOrderModal,
    selectedMesa,
    setSelectedMesa,
    orderItems,
    setOrderItems,
    loadingOrder,
    setLoadingOrder,
    orderModalError: _orderModalError,
    setOrderModalError,
    searchCatalog: _searchCatalog,
    setSearchCatalog,
    releasingEmptyOrder,
    setReleasingEmptyOrder,
    isSavingOrder,
    setIsSavingOrder,
    showCloseOrderChoiceModal: _showCloseOrderChoiceModal,
    setShowCloseOrderChoiceModal,
    showPaymentModal: _showPaymentModal,
    setShowPaymentModal,
    showSplitBillModal: _showSplitBillModal,
    setShowSplitBillModal,
    showPaymentMethodMenu: _showPaymentMethodMenu,
    setShowPaymentMethodMenu,
    isClosingOrder,
    setIsClosingOrder,
    paymentMethod,
    setPaymentMethod,
    amountReceived: _amountReceived,
    setAmountReceived,
    hasPendingChanges: _hasPendingChanges,
    setHasPendingChanges,

    quantityFlushQueueRef,
    latestOrderItemsRef,
    orderItemsCacheRef,
    catalogItemsRef,
    pendingQuantityUpdatesRef,
    orderModalOpenIntentRef,

    orderTotal,
    cashChangeData,
    getStockValidationMessage,
    ensureCatalogLoaded,
  } = order;

  const closeOrderModal = useCallback(() => {
    const held = heldMesaLockRef.current;
    if (held) {
      void releaseHeldMesaLock(held);
    }
    orderModalOpenIntentRef.current = false;
    resetOrderFlow(order);
  }, [
    heldMesaLockRef,
    releaseHeldMesaLock,
    orderModalOpenIntentRef,
    order,
  ]);

  const releaseEmptyOrderAndClose = useCallback(async () => {
    if (!selectedMesa?.id) {
      closeOrderModal();
      return;
    }

    if (!session.access_token) {
      setOrderModalError('No hay token de sesión activo para liberar la mesa.');
      return;
    }

    const mesaSnapshot = selectedMesa;
    const mesaId = selectedMesa.id;
    const closeActionVersion = bumpMesaActionVersion(mesaId);
    const orderId = String(selectedMesa.current_order_id || '').trim() || null;
    let optimisticSyncVersion = resolveMesaSyncVersion(mesaSnapshot) + 1;

    setReleasingEmptyOrder(true);
    setOrderModalError(null);
    setMesas((prev: MesaRecord[]) => {
      const currentRow = prev.find((row) => row.id === mesaId) || null;
      optimisticSyncVersion =
        Math.max(resolveMesaSyncVersion(mesaSnapshot), resolveMesaSyncVersion(currentRow)) + 1;
      beginPendingEmptyRelease(mesaId, optimisticSyncVersion);
      return prev
        .map((row) =>
          row.id === mesaId
            ? {
                ...row,
                status: 'available',
                current_order_id: null,
                orders: null,
                sync_version: optimisticSyncVersion,
              }
            : row,
        )
        .sort(compareMesaTableIdentifiers);
    });

    const optimisticMesa: MesaRecord = {
      ...mesaSnapshot,
      status: 'available',
      current_order_id: null,
      orders: null,
      sync_version: optimisticSyncVersion,
    };

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
        endPendingEmptyRelease(mesaId);
        return;
      }

      const confirmedSyncVersion =
        updatedMesa.sync_version !== undefined
          ? Math.max(Number(updatedMesa.sync_version) || 0, optimisticSyncVersion)
          : optimisticSyncVersion;

      const mergedMesa: MesaRecord = {
        ...mesaSnapshot,
        ...updatedMesa,
        status: 'available',
        current_order_id: null,
        orders: null,
        sync_version: confirmedSyncVersion,
        table_number: mesaSnapshot.table_number ?? null,
        table_name: mesaSnapshot.table_name ?? null,
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
      endPendingEmptyRelease(mesaId);
    } catch (err) {
      if (!isMesaActionVersionCurrent(mesaId, closeActionVersion)) {
        endPendingEmptyRelease(mesaId);
        return;
      }
      endPendingEmptyRelease(mesaId);
      setMesas((prev: MesaRecord[]) =>
        prev
          .map((row) => (row.id === mesaSnapshot.id ? mesaSnapshot : row))
          .sort(compareMesaTableIdentifiers),
      );
      publishMesaStateBroadcast(mesaSnapshot, {
        previousOrderId: orderId,
        mode: 'rollback',
      });
      setError(err instanceof Error ? err.message : 'No se pudo liberar la mesa.');
    } finally {
      setReleasingEmptyOrder(false);
    }
  }, [
    beginPendingEmptyRelease,
    bumpMesaActionVersion,
    closeOrderModal,
    endPendingEmptyRelease,
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

  const flushPendingQuantityUpdates = useCallback((): Promise<void> => {
    // Los items temporales (tmp-) aún no existen en la DB: se crean con la
    // cantidad final en persistOrderSnapshot al guardar.
    const pendingUpdates = Array.from(pendingQuantityUpdatesRef.current.values()).filter(
      (update) => !String(update?.itemId || '').startsWith('tmp-'),
    );
    if (pendingUpdates.length === 0) return Promise.resolve();
    pendingQuantityUpdatesRef.current.clear();

    const flushPromise = quantityFlushQueueRef.current
      .then(async () => {
        for (const update of pendingUpdates) {
          await syncOrderItemQuantity(update);
        }
      })
      .catch(async (err) => {
        const fallbackMessage = 'No se pudo actualizar la cantidad.';
        const message =
          err instanceof Error
            ? err.message
            : String((err as { message?: string } | null)?.message || fallbackMessage);
        setOrderModalError(message || fallbackMessage);

        const latestUpdate = pendingUpdates[pendingUpdates.length - 1];
        if (!latestUpdate) return;

        try {
          const freshItems = await listOrderItems(latestUpdate.orderId);
          setOrderItems(freshItems);
        } catch (err: unknown) {
          if (__DEV__) console.warn('[mesas] refresh_order_items_failed', (err as Error)?.message || err);
        }
      });

    quantityFlushQueueRef.current = flushPromise;
    return flushPromise;
  }, [
    quantityFlushQueueRef,
    pendingQuantityUpdatesRef,
    setOrderItems,
    setOrderModalError,
    syncOrderItemQuantity,
  ]);

  const accumulateQuantityUpdate = useCallback(
    (payload: {
      orderId: string;
      itemId: string;
      quantity: number;
      price: number;
      total: number;
    }) => {
      // Solo se acumula en local: las cantidades se persisten al presionar
      // "Guardar" (flushPendingQuantityUpdates en handleSaveOrder).
      pendingQuantityUpdatesRef.current.set(payload.itemId, payload);
    },
    [pendingQuantityUpdatesRef],
  );

  const handleAddCatalogItem = useCallback(
    async (catalogItem: MesaOrderCatalogItem) => {
      if (!selectedMesa?.current_order_id) {
        setOrderModalError('No hay una orden activa para agregar items.');
        return;
      }
      if (isClosingOrder || loadingOrder || releasingEmptyOrder) return;

      setSearchCatalog('');
      const orderId = selectedMesa.current_order_id;
      let optimisticItems: MesaOrderItem[] = [];
      setOrderItems((prev: MesaOrderItem[]) => {
        const existing = prev.find((item) => {
          if (catalogItem.item_type === 'combo') {
            return String(item.combo_id || '') === String(catalogItem.combo_id || '');
          }
          return String(item.product_id || '') === String(catalogItem.product_id || '');
        });

        if (existing) {
          optimisticItems = prev.map((item) => {
            if (item.id !== existing.id) return item;
            const nextQuantity = Number(item.quantity || 0) + 1;
            const unitPrice = Number(item.price || catalogItem.sale_price || 0);
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
              product_id: catalogItem.item_type === 'product' ? catalogItem.product_id : null,
              combo_id: catalogItem.item_type === 'combo' ? catalogItem.combo_id : null,
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
      patchMesaOrderTotal(selectedMesa.id, orderId, optimisticTotal);
      publishRealtimeOrderSummary(
        selectedMesa,
        orderId,
        optimisticTotal,
        optimisticUnits,
        'optimistic',
      );
      setOrderModalError(null);
      setHasPendingChanges(true);

      const addedQuantity = optimisticItems.reduce((sum, item) => {
        if (catalogItem.item_type === 'combo') {
          return sum + (String(item.combo_id || '') === String(catalogItem.combo_id || '') ? Number(item.quantity || 0) : 0);
        }
        return sum + (String(item.product_id || '') === String(catalogItem.product_id || '') ? Number(item.quantity || 0) : 0);
      }, 0);
      if (catalogItem.item_type === 'product' && catalogItem.manage_stock) {
        if (Number(catalogItem.stock) < addedQuantity) {
          setOrderModalError(
            `Stock insuficiente para ${catalogItem.name}. Disponible: ${catalogItem.stock}.`,
          );
        }
      }
    },
    [
      isClosingOrder,
      loadingOrder,
      patchMesaOrderTotal,
      publishRealtimeOrderSummary,
      releasingEmptyOrder,
      selectedMesa,
      setOrderItems,
      setOrderModalError,
      setSearchCatalog,
      setHasPendingChanges,
    ],
  );

  const handleUpdateOrderItemQuantity = useCallback(
    (item: MesaOrderItem, delta: number) => {
      if (!selectedMesa?.current_order_id) {
        setOrderModalError('No hay una orden activa para actualizar.');
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

        resolvedQuantity = Math.max(0, Number(currentRow.quantity || 0) + delta);
        if (resolvedQuantity <= 0) {
          optimisticItems = prev.filter((row) => row.id !== item.id);
          return optimisticItems;
        }

        optimisticItems = prev.map((row) =>
          row.id === item.id
            ? {
                ...row,
                quantity: resolvedQuantity,
                subtotal: resolvedQuantity * Number(row.price || 0),
              }
            : row,
        );

        return optimisticItems;
      });

      const optimisticTotal = calculateOrderTotal(optimisticItems);
      const optimisticUnits = sumOrderItemsQuantity(optimisticItems);
      patchMesaOrderTotal(selectedMesa.id, orderId, optimisticTotal);
      publishRealtimeOrderSummary(
        selectedMesa,
        orderId,
        optimisticTotal,
        optimisticUnits,
        'optimistic',
      );
      setOrderModalError(null);
      setHasPendingChanges(true);

      accumulateQuantityUpdate({
        orderId,
        itemId: item.id,
        quantity: resolvedQuantity,
        price: itemPrice,
        total: optimisticTotal,
      });
    },
    [
      patchMesaOrderTotal,
      publishRealtimeOrderSummary,
      accumulateQuantityUpdate,
      selectedMesa,
      setOrderItems,
      setOrderModalError,
      setHasPendingChanges,
    ],
  );

  const handleSaveOrder = useCallback(async () => {
    if (releasingEmptyOrder || isClosingOrder || isSavingOrder || loadingOrder) return;

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
      // Flush pending quantity updates to server before saving
      await flushPendingQuantityUpdates();
      pendingQuantityUpdatesRef.current.clear();

      // Esperar a que terminen las mutaciones de catálogo pendientes antes de
      // guardar, pero con un timeout de seguridad para no bloquear la UI si
      // alguna operación previa se quedó colgada.
      await Promise.race([
        quantityFlushQueueRef.current,
        new Promise<void>((resolve) => setTimeout(resolve, 5_000)),
      ]);

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
      orderItemsCacheRef.current.set(selectedMesa.current_order_id, persisted.items);
      setOrderItemsCacheSnapshot(selectedMesa.current_order_id, persisted.items);
      const persistedUnits = sumOrderItemsQuantity(persisted.items);
      patchMesaOrderTotal(selectedMesa.id, selectedMesa.current_order_id, persisted.total);
      publishRealtimeOrderSummary(
        selectedMesa,
        selectedMesa.current_order_id,
        persisted.total,
        persistedUnits,
        'confirmed',
      );
      closeOrderModal();
      onOrderSaved?.();
      setHasPendingChanges(false);
    } catch (err) {
      const fallbackMessage = 'No se pudo guardar la orden.';
      const message =
        err instanceof Error
          ? err.message
          : String(
              (err as { message?: string; details?: string } | null)?.message ||
                (err as { details?: string } | null)?.details ||
                fallbackMessage,
            );
      setOrderModalError(message || fallbackMessage);
    } finally {
      setIsSavingOrder(false);
    }
  }, [
    quantityFlushQueueRef,
    closeOrderModal,
    isClosingOrder,
    isSavingOrder,
    flushPendingQuantityUpdates,
    latestOrderItemsRef,
    loadingOrder,
    onOrderSaved,
    orderItemsCacheRef,
    patchMesaOrderTotal,
    pendingQuantityUpdatesRef,
    persistOrderSnapshot,
    publishRealtimeOrderSummary,
    releaseEmptyOrderAndClose,
    releasingEmptyOrder,
    selectedMesa,
    setIsSavingOrder,
    setOrderItems,
    setOrderModalError,
    setHasPendingChanges,
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
        setError('No se encontro el negocio activo para cargar el catalogo.');
        return false;
      }

      const orderId = String(mesa.current_order_id || '').trim();
      const providedItems = Array.isArray(options?.initialItems) ? options.initialItems : null;
      const inMemoryCache = orderId ? orderItemsCacheRef.current.get(orderId) : null;
      const cachedItems = providedItems || inMemoryCache || null;
      const hasCachedItems = Array.isArray(cachedItems) && cachedItems.length > 0;
      const skipOrderItemsFetch = options?.skipOrderItemsFetch === true;

      setSelectedMesa(mesa);
      setShowOrderModal(true);
      setLoadingOrder(true);
      setOrderModalError(null);
      setHasPendingChanges(false);

      if (hasCachedItems) {
        setOrderItems(cachedItems);
        if (orderId) {
          orderItemsCacheRef.current.set(orderId, cachedItems);
        }
        patchMesaOrderTotal(mesa.id, orderId, calculateOrderTotal(cachedItems));
      } else if (providedItems) {
        setOrderItems(providedItems);
        if (orderId) {
          orderItemsCacheRef.current.set(orderId, providedItems);
        }
      }

      const skipLockAcquire = options?.skipLockAcquire === true;

      void ensureCatalogLoaded(businessId).catch((err) => {
        if (__DEV__) {
          console.warn('[mesas] ensure_catalog_failed', err?.message || err);
        }
      });

      if (skipOrderItemsFetch) {
        if (!hasCachedItems && !providedItems) {
          setOrderItems([]);
          orderItemsCacheRef.current.set(orderId, []);
        }
        if (!skipLockAcquire) {
          acquireMesaLockForEdition(mesa).then((granted) => {
            if (!granted) {
              setLoadingOrder(false);
              setShowOrderModal(false);
              setSelectedMesa(null);
              setOrderItems([]);
              setError('Alguien esta usando esta mesa.');
            }
          });
        }
        setLoadingOrder(false);
        return true;
      }

      if (!skipLockAcquire) {
        const lockPromise = acquireMesaLockForEdition(mesa);
        const snapshotPromise = loadOpenOrderSnapshot(orderId, {
          forceRefresh: hasCachedItems,
        });

        Promise.all([lockPromise, snapshotPromise])
          .then(([lockGranted, snapshot]) => {
            if (!lockGranted) {
              setLoadingOrder(false);
              setShowOrderModal(false);
              setSelectedMesa(null);
              setOrderItems([]);
              setSearchCatalog('');
              setError('Alguien esta usando esta mesa.');
              return;
            }

            if (isPendingEmptyRelease(mesa.id) || !orderModalOpenIntentRef.current) {
              setLoadingOrder(false);
              return;
            }

            if (snapshot) {
              const previousItems = hasCachedItems
                ? cachedItems
                : orderItemsCacheRef.current.get(orderId) || [];
              const mergedItems = reconcileOrderItemsFromServer(previousItems, snapshot.items);
              setOrderItems(mergedItems);
              orderItemsCacheRef.current.set(orderId, mergedItems);
              setOrderItemsCacheSnapshot(orderId, mergedItems);
              if (mergedItems.length > 0) {
                patchMesaOrderTotal(mesa.id, orderId, calculateOrderTotal(mergedItems));
              }
            }

            setLoadingOrder(false);
          })
          .catch((err) => {
            if (!hasCachedItems) {
              setOrderModalError(
                err instanceof Error ? err.message : 'No se pudo cargar la orden.',
              );
            }
            setLoadingOrder(false);
          });

        return true;
      }

      try {
        if (isPendingEmptyRelease(mesa.id) || !orderModalOpenIntentRef.current) {
          return true;
        }
        const snapshot = await loadOpenOrderSnapshot(orderId, {
          forceRefresh: hasCachedItems,
        });
        if (isPendingEmptyRelease(mesa.id) || !orderModalOpenIntentRef.current) {
          return true;
        }
        const previousItems = hasCachedItems
          ? cachedItems
          : orderItemsCacheRef.current.get(orderId) || [];
        const mergedItems = reconcileOrderItemsFromServer(previousItems, snapshot.items);
        setOrderItems(mergedItems);
        orderItemsCacheRef.current.set(orderId, mergedItems);
        setOrderItemsCacheSnapshot(orderId, mergedItems);
        if (mergedItems.length > 0) {
          patchMesaOrderTotal(mesa.id, orderId, calculateOrderTotal(mergedItems));
        }
      } catch (err) {
        if (!hasCachedItems) {
          setOrderModalError(err instanceof Error ? err.message : 'No se pudo cargar la orden.');
        }
      } finally {
        setLoadingOrder(false);
      }
      return true;
    },
    [
      acquireMesaLockForEdition,
      businessId,
      ensureCatalogLoaded,
      isPendingEmptyRelease,
      loadOpenOrderSnapshot,
      orderItemsCacheRef,
      orderModalOpenIntentRef,
      patchMesaOrderTotal,
      setError,
      setLoadingOrder,
      setOrderItems,
      setOrderModalError,
      setSearchCatalog,
      setSelectedMesa,
      setShowOrderModal,
    ],
  );

  const handleCloseOrder = useCallback(() => {
    if (orderItems.length === 0) {
      setOrderModalError('No hay productos en la orden para cerrar.');
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

  const processPaymentAndClose = useCallback(async () => {
    if (!businessId || !selectedMesa?.id || !selectedMesa.current_order_id) {
      setOrderModalError('No se encontro una orden activa para cerrar.');
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
        paymentMethod === 'cash' ? Number(cashChangeData?.paid || 0) : null;
      const resolvedChangeBreakdown =
        paymentMethod === 'cash' ? buildCashBreakdown(Number(cashChangeData?.change || 0)) : [];

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

      const mesaLabel = selectedMesa.table_number ?? selectedMesa.table_name ?? '-';
      onOrderClosed?.(String(mesaLabel), Number(orderTotal || 0));

      void loadData();
    } catch (err) {
      setOrderModalError(err instanceof Error ? err.message : 'No se pudo cerrar la orden.');
    } finally {
      setIsClosingOrder(false);
    }
  }, [
    buildCashBreakdown,
    businessId,
    cashChangeData,
    closeOrderModal,
    closeOrderSingle,
    getStockValidationMessage,
    loadData,
    markMesaAsAvailableAfterSale,
    onOrderClosed,
    orderItems,
    paymentMethod,
    selectedMesa,
    setIsClosingOrder,
    setOrderModalError,
  ]);

  const processSplitPaymentAndClose = useCallback(
    async ({ subAccounts }: { subAccounts: SplitSubAccount[] }) => {
      if (!businessId || !selectedMesa?.id || !selectedMesa.current_order_id) {
        setOrderModalError('No se encontro una orden activa para cerrar.');
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

        const mesaLabel = selectedMesa.table_number ?? selectedMesa.table_name ?? '-';
        onOrderClosed?.(String(mesaLabel), Number(orderTotal || 0));

        void loadData();
      } catch (err) {
        setOrderModalError(
          err instanceof Error ? err.message : 'No se pudo cerrar la orden dividida.',
        );
      } finally {
        setIsClosingOrder(false);
      }
    },
    [
      businessId,
      closeOrderAsSplit,
      closeOrderModal,
      getStockValidationMessage,
      loadData,
      markMesaAsAvailableAfterSale,
      onOrderClosed,
      selectedMesa,
      setIsClosingOrder,
      setOrderModalError,
    ],
  );

  const handlePrintKitchen = useCallback(async () => {
    if (!selectedMesa) {
      setOrderModalError('No hay una mesa seleccionada.');
      return;
    }

    if (!Array.isArray(orderItems) || orderItems.length === 0) {
      setOrderModalError('No hay productos en la orden para imprimir.');
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

    const categoriasParaCocina = new Set(['plato', 'platos', 'cocina', 'comida']);
    const itemsParaCocina = orderItems.filter((item) => {
      if (item.combo_id) return true;
      const catalogCategory = productCatalogLookup.get(item.product_id || '')?.category;
      const category = normalizeCategory(
        item.category ?? item.products?.category ?? catalogCategory,
      );
      return (
        categoriasParaCocina.has(category) ||
        category.startsWith('plato') ||
        category.includes('plato')
      );
    });

    const itemsParaCocinaConNombre = itemsParaCocina.map((item) => {
      if (item.combo_id) {
        const catalogCombo = comboCatalogLookup.get(item.combo_id || '');
        const existingComboName = String(item?.combos?.nombre || '').trim();
        const fallbackComboName = String(catalogCombo?.name || '').trim();

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

      const catalogProduct = productCatalogLookup.get(item.product_id || '');
      const existingName = String(item?.products?.name || '').trim();
      const fallbackName = String(catalogProduct?.name || '').trim();

      if (existingName || !fallbackName) return item;

      return {
        ...item,
        products: {
          ...(item.products || {}),
          id: item?.products?.id || catalogProduct?.product_id,
          name: fallbackName,
          code: item?.products?.code || catalogProduct?.code || undefined,
          category: item?.products?.category || catalogProduct?.category || undefined,
        },
      };
    });

    if (itemsParaCocinaConNombre.length === 0) {
      onNoKitchenItems?.();
      closeOrderModal();
      return;
    }

    const btReady = await ensureBluetoothEnabled();
    if (!btReady) {
      setOrderModalError(BLUETOOTH_PRINT_REQUIRED_MESSAGE);
      closeOrderModal();
      return;
    }

    const savedPrinter = await getSavedPrinter();
    if (!savedPrinter) {
      onNoPrinterConnected?.();
      closeOrderModal();
      return;
    }

    if (!beginPrintFlow()) {
      setOrderModalError('Ya hay una impresión en curso. Espera a que finalice.');
      return;
    }

    try {
      const mesaLabel = selectedMesa.table_number ?? selectedMesa.table_name ?? '-';
      const receiptLabels = buildReceiptLabels(t);

      const paperWidthMm = await getThermalPaperWidthMm();
      const autoCut = await isAutoCutEnabled();
      const escposData = buildKitchenEscPos({
        mesaNumber: mesaLabel,
        items: itemsParaCocinaConNombre.map((item) => ({
          name: item?.products?.name || item?.combos?.nombre || 'Item',
          quantity: Number(item?.quantity || 0),
        })),
        paperWidthMm,
        autoCut,
        timezone,
        labels: receiptLabels,
      });
      const result = await connectPrintDisconnect(savedPrinter.address, escposData);
      if (result.ok) {
        onKitchenPrinted?.();
        closeOrderModal();
        return;
      }
      onPrintError?.('error' in result ? result.error : receiptLabels.printerError);
      closeOrderModal();
    } catch (err) {
      if (__DEV__) console.error('[Print] Kitchen: print error', err);
      onPrintError?.(err instanceof Error ? err.message : 'No se pudo imprimir la orden.');
      closeOrderModal();
    } finally {
      endPrintFlow();
    }
  }, [
    beginPrintFlow,
    catalogItemsRef,
    closeOrderModal,
    endPrintFlow,
    onKitchenPrinted,
    onNoKitchenItems,
    onNoPrinterConnected,
    onPrintError,
    orderItems,
    selectedMesa,
    setOrderModalError,
    t,
  ]);

  return {
    closeOrderModal,
    releaseEmptyOrderAndClose,
    handleAddCatalogItem,
    handleUpdateOrderItemQuantity,
    handleSaveOrder,
    openOrderModal,
    handleCloseOrder,
    handlePayAllTogether,
    processPaymentAndClose,
    processSplitPaymentAndClose,
    handlePrintKitchen,
  };
}

export type UseMesaOrderMutationsReturn = ReturnType<typeof useMesaOrderMutations>;
