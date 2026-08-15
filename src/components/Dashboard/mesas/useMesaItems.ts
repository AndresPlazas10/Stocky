import { useCallback } from 'react';
import { getOrderItemsByOrderId } from '@/data/queries/ordersQueries';
import {
  persistOrderItemQuantities,
  persistOrderSnapshotWeb,
  updateOrderTotalById,
} from '@/data/commands/ordersCommands';
import {
  ORDER_ITEMS_SELECT,
  ORDER_ITEM_TYPE,
  toFiniteNumber,
  calculateOrderItemsTotal,
  mergeOrderItemsPreservingPosition,
  applyPendingQuantities,
  normalizeEntityId,
} from './mesaHelpers';
import { isOfflineMode } from '@/utils/offlineSnapshot';
import { logger } from '@/utils/logger';

interface UseMesaItemsParams {
  businessId: string;
  selectedMesa: any;
  orderItems: any[];
  setOrderItems: React.Dispatch<React.SetStateAction<any[]>>;
  setPendingQuantityUpdatesSafe: React.Dispatch<React.SetStateAction<any>>;
  pendingQuantityUpdatesRef: React.MutableRefObject<Record<string, number>>;
  orderItemsRef: React.MutableRefObject<any[]>;
  orderItemsDirtyRef: React.MutableRefObject<boolean>;
  pendingRemoteOrderTotalsRef: React.MutableRefObject<Record<string, number>>;
  lastSyncedOrderTotalsRef: React.MutableRefObject<Record<string, number>>;
  orderTotalSyncQueueRef: React.MutableRefObject<Record<string, Promise<void>>>;
  showError: (title: string, message?: string) => void;
  t: (key: string, options?: any) => string;
  isOfflineFirstRuntime: boolean;
  quantityToAdd: number;
  setSearchProduct: React.Dispatch<React.SetStateAction<string>>;
  setQuantityToAdd: React.Dispatch<React.SetStateAction<number>>;
  setMesas: React.Dispatch<React.SetStateAction<any[]>>;
}

export function useMesaItems({
  businessId,
  selectedMesa,
  orderItems,
  setOrderItems,
  setPendingQuantityUpdatesSafe,
  pendingQuantityUpdatesRef,
  orderItemsRef,
  orderItemsDirtyRef,
  pendingRemoteOrderTotalsRef,
  lastSyncedOrderTotalsRef,
  orderTotalSyncQueueRef,
  showError,
  t,
  isOfflineFirstRuntime,
  quantityToAdd,
  setSearchProduct,
  setQuantityToAdd,
  setMesas,
}: UseMesaItemsParams) {
  const updateOrderTotal = useCallback(async (orderId: string | null | undefined, itemsSnapshot: any[] = orderItems, options: { skipMesaState?: boolean } = {}) => {
    const normalizedOrderId = normalizeEntityId(orderId);
    if (!normalizedOrderId || !businessId) return;

    const safeItems = Array.isArray(itemsSnapshot) ? itemsSnapshot : [];
    const total = calculateOrderItemsTotal(safeItems);
    const units = safeItems.reduce((sum, item) => sum + toFiniteNumber(item?.quantity, 0), 0);

    const queueId = String(businessId);

    const pending = orderTotalSyncQueueRef.current?.[queueId] ?? Promise.resolve();
    const next = pending.then(async () => {
      try {
        const isLocalOnlyOrder = (
          !!normalizedOrderId && normalizedOrderId.startsWith('offline-order-')
        );
        if (isLocalOnlyOrder) {
          pendingRemoteOrderTotalsRef.current[normalizedOrderId] = Math.round(total * 100);
          lastSyncedOrderTotalsRef.current[normalizedOrderId] = Math.round(total * 100);
          return;
        }

        await updateOrderTotalById({ orderId: normalizedOrderId, total, businessId });

        lastSyncedOrderTotalsRef.current[normalizedOrderId] = Math.round(total * 100);
        delete pendingRemoteOrderTotalsRef.current[normalizedOrderId];
      } catch (err) {
        logger.warn('mesas:order_operations:update_order_total failed', err);
        pendingRemoteOrderTotalsRef.current[normalizedOrderId] = Math.round(total * 100);
      }
    });
    orderTotalSyncQueueRef.current[queueId] = next;

    if (options?.skipMesaState !== true) {
      setMesas((prevMesas) =>
        prevMesas.map((mesa) =>
          normalizeEntityId(mesa?.current_order_id) === normalizedOrderId
            ? {
                ...mesa,
                orders: { ...(mesa.orders || {}), total, local_units: units, order_items: safeItems },
                status: 'occupied',
              }
            : mesa
        )
      );
    }
  }, [orderItems, businessId, setMesas, pendingRemoteOrderTotalsRef, lastSyncedOrderTotalsRef, orderTotalSyncQueueRef]);

  const flushPendingRemoteOrderTotals = useCallback(async () => {
    const entries = Object.entries(pendingRemoteOrderTotalsRef.current || {});
    if (entries.length === 0) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    if (isOfflineMode()) return;

    for (const [orderId, roundTotal] of entries) {
      try {
        const total = (roundTotal || 0) / 100;
        await updateOrderTotalById({ orderId, total, businessId });
        lastSyncedOrderTotalsRef.current[orderId] = roundTotal;
        delete pendingRemoteOrderTotalsRef.current[orderId];
      } catch (err) {
        logger.warn('mesas:flush_pending_totals failed', err);
      }
    }
  }, [businessId, pendingRemoteOrderTotalsRef, lastSyncedOrderTotalsRef]);

  const persistPendingQuantityUpdates = useCallback(async (orderId: string, { refreshItems = true, items }: { refreshItems?: boolean; items?: any[] } = {}) => {
    // El snapshot de items se pasa explícitamente: al "Guardar" el modal ya se
    // cerró y orderItemsRef fue reseteado a [].
    const sourceItems = Array.isArray(items) && items.length > 0
      ? items
      : (Array.isArray(orderItemsRef.current) ? orderItemsRef.current : []);
    const pendingMap = pendingQuantityUpdatesRef.current || {};
    const tmpItems = sourceItems.filter(
      (item) => String(item?.id || '').startsWith('tmp-')
    );
    const nonTmpEntries = Object.entries(pendingMap).filter(
      ([key]) => !String(key || '').startsWith('tmp-')
    );

    if (tmpItems.length === 0 && nonTmpEntries.length === 0) {
      setPendingQuantityUpdatesSafe({});
      return;
    }

    try {
      if (tmpItems.length > 0) {
        // Items temporales (tmp-) aún no existen en la DB: el snapshot los crea
        // (y reconcilia cantidades y borrados) atómicamente en un solo round-trip.
        await persistOrderSnapshotWeb({
          orderId,
          businessId,
          items: sourceItems,
        });
      } else {
        await persistOrderItemQuantities(nonTmpEntries, { businessId, orderId });
      }

      if (refreshItems) {
        try {
          const freshItems = await getOrderItemsByOrderId({
            orderId,
            selectSql: ORDER_ITEMS_SELECT,
          });
          if (freshItems?.length) {
            setOrderItems((prevItems) =>
              mergeOrderItemsPreservingPosition(
                prevItems,
                applyPendingQuantities(freshItems, pendingMap)
              )
            );
          }
        } catch (err) {
          logger.warn('mesas:persist_pending_refresh_items failed', err);
        }
      }

      setPendingQuantityUpdatesSafe({});
    } catch (err) {
      logger.warn('mesas:persist_pending_quantities failed', err);
    }
  }, [setPendingQuantityUpdatesSafe, businessId, pendingQuantityUpdatesRef, orderItemsRef, setOrderItems]);

  const removeItem = useCallback(async (itemId: string) => {
    // El borrado es local: el snapshot reconciliado al "Guardar" (persistOrderSnapshotWeb)
    // elimina los items que ya no están en el estado de la orden.
    const currentOrderItems = Array.isArray(orderItemsRef.current) ? orderItemsRef.current : [];
    const nextOrderItems = currentOrderItems.filter((item) => item.id !== itemId);
    orderItemsDirtyRef.current = true;
    orderItemsRef.current = nextOrderItems;
    setOrderItems(nextOrderItems);
    setPendingQuantityUpdatesSafe((prev) => {
      const next = { ...(prev || {}) };
      delete next[itemId];
      return next;
    });
    updateOrderTotal(selectedMesa?.current_order_id, nextOrderItems, { skipMesaState: true }).catch(
      (err) => logger.warn('mesas:order_operations:update_total_local_remove failed', err)
    );
  }, [
    selectedMesa,
    updateOrderTotal,
    setPendingQuantityUpdatesSafe,
    setOrderItems,
    orderItemsRef,
    orderItemsDirtyRef,
    t,
  ]);

  const addCatalogItemToOrder = useCallback(async (catalogItem: any) => {
    try {
      if (!selectedMesa?.current_order_id) return;

      const currentOrderId = String(selectedMesa?.current_order_id || '');
      const isLocalOnlyOrder =
        String(selectedMesa?.orders?.__localOnly || '').toLowerCase() === 'true' ||
        currentOrderId.startsWith('offline-order-');
      const shouldUseLocalItemFlow = isLocalOnlyOrder || isOfflineFirstRuntime || isOfflineMode();

      const itemType = catalogItem?.item_type || ORDER_ITEM_TYPE.PRODUCT;
      const isCombo = itemType === ORDER_ITEM_TYPE.COMBO;
      const itemId = isCombo ? catalogItem?.combo_id || catalogItem?.id : catalogItem?.product_id || catalogItem?.id;
      const itemName = catalogItem?.name || catalogItem?.nombre || 'Item';

      if (!itemId) {
        showError('Error', t('mesas:errors.itemNotIdentified'));
        return;
      }

      const precio = Number(catalogItem?.sale_price ?? catalogItem?.price ?? 0);
      if (!Number.isFinite(precio) || precio < 0) {
        showError('Error', t('mesas:errors.invalidItemPrice', { itemName }));
        return;
      }

      const qty = parseInt(String(quantityToAdd));
      if (isNaN(qty) || qty <= 0) {
        showError('Error', t('mesas:errors.quantityMustBePositive'));
        return;
      }

      if (!isCombo && catalogItem.manage_stock !== false && typeof catalogItem.stock === 'number' && qty > catalogItem.stock) {
        showError('Error', t('mesas:errors.insufficientStock', { itemName, available: catalogItem.stock }));
      }

      const currentOrderItems = Array.isArray(orderItemsRef.current) ? orderItemsRef.current : [];
      let nextOrderItems = currentOrderItems;
      let orderItemsChanged = false;

      const existingItem = currentOrderItems.find((item) => (isCombo ? item.combo_id === itemId : item.product_id === itemId));

      if (existingItem) {
        const newQuantity = toFiniteNumber(existingItem.quantity, 0) + qty;
        const nextQuantity = Number(newQuantity || 0);
        nextOrderItems = currentOrderItems.map((item) =>
          item.id === existingItem.id
            ? { ...item, quantity: nextQuantity, subtotal: nextQuantity * Number(item.price || 0) }
            : item
        );
        orderItemsDirtyRef.current = true;
        orderItemsRef.current = nextOrderItems;
        setOrderItems(nextOrderItems);
        orderItemsChanged = true;
        // La cantidad se acumula en local: se persiste recién al "Guardar"
        // (snapshot o persistOrderItemQuantities), sin escribir a la DB por cambio.
        setPendingQuantityUpdatesSafe((prev) => ({ ...(prev || {}), [existingItem.id]: nextQuantity }));
        if (shouldUseLocalItemFlow) {
          setPendingQuantityUpdatesSafe((prev) => {
            const next = { ...(prev || {}) };
            delete next[existingItem.id];
            return next;
          });
        }
      } else {
        const optimisticQuantity = Number(qty || 0);
        const optimisticPrice = Number(parseFloat(String(precio)) || 0);
        const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const optimisticItem: any = {
          id: tempId,
          order_id: selectedMesa.current_order_id,
          product_id: isCombo ? null : itemId,
          combo_id: isCombo ? itemId : null,
          quantity: optimisticQuantity,
          price: optimisticPrice,
          subtotal: optimisticQuantity * optimisticPrice,
          products: isCombo ? null : { id: itemId!, name: itemName, code: catalogItem.code },
          combos: isCombo ? { id: itemId!, nombre: itemName } : null,
        };
        if (shouldUseLocalItemFlow) {
          const localItemId = `offline-item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const localItem = { ...optimisticItem, id: localItemId, __localOnly: true, pending_sync: true };
          nextOrderItems = [localItem, ...currentOrderItems];
          orderItemsDirtyRef.current = true;
          orderItemsRef.current = nextOrderItems;
          setOrderItems(nextOrderItems);
          setPendingQuantityUpdatesSafe((prev) => {
            const next = { ...(prev || {}) };
            delete next[tempId];
            return next;
          });
          orderItemsChanged = true;
        } else {
          // Alta diferida: el item queda temporal (tmp-) y se crea en la DB
          // recién al "Guardar" (persistOrderSnapshotWeb). La cocina no recibe
          // aviso por cada alta durante la edición.
          nextOrderItems = [optimisticItem, ...currentOrderItems];
          orderItemsDirtyRef.current = true;
          orderItemsRef.current = nextOrderItems;
          setOrderItems(nextOrderItems);
          orderItemsChanged = true;
        }
      }

      if (orderItemsChanged) {
        updateOrderTotal(selectedMesa.current_order_id, nextOrderItems, { skipMesaState: true }).catch((err) =>
          logger.warn('mesas:order_operations:update_total_after_item_change failed', err)
        );
      }
      setSearchProduct('');
      setQuantityToAdd(1);
    } catch (error) {
      showError('Error', `${t('mesas:errors.addItemFailed')} [MESA_ITEM_DBG|stage=outer-catch|msg=${String((error as Error)?.message || error || 'unknown').replace(/\s+/g, ' ').slice(0, 80)}]`);
      try {
        const freshItems = await getOrderItemsByOrderId({ orderId: selectedMesa?.current_order_id, selectSql: ORDER_ITEMS_SELECT });
        if (freshItems?.length) setOrderItems((prevItems) => mergeOrderItemsPreservingPosition(prevItems, applyPendingQuantities(freshItems, pendingQuantityUpdatesRef.current)));
      } catch (err) { logger.warn('mesas:order_operations:add_catalog_item_refresh_items failed', err); }
    }
  }, [
    selectedMesa, quantityToAdd, updateOrderTotal, setPendingQuantityUpdatesSafe, isOfflineFirstRuntime,
    showError, setOrderItems,
    setSearchProduct, setQuantityToAdd, pendingQuantityUpdatesRef,
    orderItemsRef, orderItemsDirtyRef, t,
  ]);

  const updateItemQuantity = useCallback(async (itemId: string, newQuantity: number) => {
    try {
      const normalizedQuantity = toFiniteNumber(newQuantity, NaN);
      if (!Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) {
        await removeItem(itemId);
        return;
      }
      const currentOrderItems = Array.isArray(orderItemsRef.current) ? orderItemsRef.current : [];
      const nextOrderItems = currentOrderItems.map((item) => {
        if (item.id === itemId) {
          const normalizedPrice = toFiniteNumber(item.price, 0);
          return { ...item, quantity: normalizedQuantity, subtotal: normalizedQuantity * normalizedPrice };
        }
        return item;
      });
      orderItemsRef.current = nextOrderItems;
      setOrderItems(nextOrderItems);
      orderItemsDirtyRef.current = true;
      setPendingQuantityUpdatesSafe((prev) => ({ ...prev, [itemId]: normalizedQuantity }));
    } catch {
      showError('Error', t('mesas:errors.updateQuantityFailed'));
      try {
        const currentOrderId = String(selectedMesa?.current_order_id || '');
        const isLocalOnlyOrder = String(selectedMesa?.orders?.__localOnly || '').toLowerCase() === 'true' || currentOrderId.startsWith('offline-order-');
        if (!(isLocalOnlyOrder || isOfflineFirstRuntime || isOfflineMode())) {
          const freshItems = await getOrderItemsByOrderId({ orderId: selectedMesa?.current_order_id, selectSql: ORDER_ITEMS_SELECT });
          if (freshItems?.length) setOrderItems((prevItems) => mergeOrderItemsPreservingPosition(prevItems, applyPendingQuantities(freshItems, pendingQuantityUpdatesRef.current)));
        }
      } catch (err) { logger.warn('mesas:order_operations:update_item_quantity_recover_items failed', err); }
      setPendingQuantityUpdatesSafe({});
    }
  }, [selectedMesa, isOfflineFirstRuntime, removeItem, setPendingQuantityUpdatesSafe, showError, setOrderItems, pendingQuantityUpdatesRef, orderItemsRef, orderItemsDirtyRef, t]);

  return {
    updateOrderTotal,
    flushPendingRemoteOrderTotals,
    persistPendingQuantityUpdates,
    addCatalogItemToOrder,
    updateItemQuantity,
  };
}
