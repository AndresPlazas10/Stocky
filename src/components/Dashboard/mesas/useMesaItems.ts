import { useCallback } from 'react';
import { getOrderItemsByOrderId } from '@/data/queries/ordersQueries';
import {
  deleteOrderItemById,
  insertOrderItem,
  persistOrderItemQuantities,
  updateOrderItemQuantityById,
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
  optimisticTempItemQuantitiesRef: React.MutableRefObject<Record<string, number>>;
  pendingOrderItemOpsRef: React.MutableRefObject<number>;
  pendingRemoteOrderTotalsRef: React.MutableRefObject<Record<string, number>>;
  lastSyncedOrderTotalsRef: React.MutableRefObject<Record<string, number>>;
  orderTotalSyncQueueRef: React.MutableRefObject<Record<string, Promise<void>>>;
  markOrderItemOpStarted: () => void;
  markOrderItemOpFinished: () => void;
  enqueueOrderItemWrite: (itemId: string, writeFn: () => Promise<unknown>) => Promise<void>;
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
  optimisticTempItemQuantitiesRef,
  pendingOrderItemOpsRef,
  pendingRemoteOrderTotalsRef,
  lastSyncedOrderTotalsRef,
  orderTotalSyncQueueRef,
  markOrderItemOpStarted,
  markOrderItemOpFinished,
  enqueueOrderItemWrite,
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

        await updateOrderTotalById(normalizedOrderId, total, units, {
          businessId,
        });

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
        await updateOrderTotalById(orderId, total, 0, { businessId });
        lastSyncedOrderTotalsRef.current[orderId] = roundTotal;
        delete pendingRemoteOrderTotalsRef.current[orderId];
      } catch (err) {
        logger.warn('mesas:flush_pending_totals failed', err);
      }
    }
  }, [businessId, pendingRemoteOrderTotalsRef, lastSyncedOrderTotalsRef]);

  const persistPendingQuantityUpdates = useCallback(async (orderId: string, { refreshItems = true }: { refreshItems?: boolean } = {}) => {
    const pendingMap = pendingQuantityUpdatesRef.current || {};
    const entries = Object.entries(pendingMap).filter(([key]) => !String(key || '').startsWith('tmp-'));

    if (entries.length === 0) {
      setPendingQuantityUpdatesSafe({});
      return;
    }

    try {
      await persistOrderItemQuantities(entries, { businessId, orderId });

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
  }, [setPendingQuantityUpdatesSafe, businessId, pendingQuantityUpdatesRef, setOrderItems]);

  const removeItem = useCallback(async (itemId: string) => {
    if (pendingOrderItemOpsRef.current > 0) {
      showError('Error', t('mesas:errors.syncingChanges'));
      return;
    }

    const currentOrderId = String(selectedMesa?.current_order_id || '');
    const isLocalOnlyOrder =
      String(selectedMesa?.orders?.__localOnly || '').toLowerCase() === 'true' ||
      currentOrderId.startsWith('offline-order-');
    const shouldUseLocalRemove = isLocalOnlyOrder || isOfflineFirstRuntime || isOfflineMode();

    if (shouldUseLocalRemove) {
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
      delete optimisticTempItemQuantitiesRef.current[itemId];
      updateOrderTotal(selectedMesa?.current_order_id, nextOrderItems, { skipMesaState: true }).catch(
        (err) => logger.warn('mesas:order_operations:update_total_local_remove failed', err)
      );
      return;
    }

    markOrderItemOpStarted();
    try {
      await deleteOrderItemById(itemId, { businessId, orderId: selectedMesa?.current_order_id || null });
      const currentOrderItems = Array.isArray(orderItemsRef.current) ? orderItemsRef.current : [];
      const nextOrderItems = currentOrderItems.filter((item) => item.id !== itemId);
      orderItemsDirtyRef.current = true;
      orderItemsRef.current = nextOrderItems;
      setOrderItems(nextOrderItems);
      setPendingQuantityUpdatesSafe((prev) => {
        const next = { ...prev };
        delete next[itemId];
        return next;
      });
      delete optimisticTempItemQuantitiesRef.current[itemId];
      updateOrderTotal(selectedMesa?.current_order_id, nextOrderItems, { skipMesaState: true }).catch(
        (err) => logger.warn('mesas:order_operations:update_total_remote_remove failed', err)
      );
    } catch {
      showError('Error', t('mesas:errors.deleteItemFailed'));
      try {
        const freshItems = await getOrderItemsByOrderId({
          orderId: selectedMesa?.current_order_id,
          selectSql: ORDER_ITEMS_SELECT,
        });
        if (freshItems?.length) {
          setOrderItems((prevItems) =>
            mergeOrderItemsPreservingPosition(prevItems, applyPendingQuantities(freshItems, pendingQuantityUpdatesRef.current))
          );
        }
      } catch (err) {
        logger.warn('mesas:order_operations:remove_item_recover_items failed', err);
      }
    } finally {
      markOrderItemOpFinished();
    }
  }, [
    selectedMesa,
    isOfflineFirstRuntime,
    updateOrderTotal,
    setPendingQuantityUpdatesSafe,
    businessId,
    markOrderItemOpStarted,
    markOrderItemOpFinished,
    pendingOrderItemOpsRef,
    optimisticTempItemQuantitiesRef,
    showError,
    setOrderItems,
    orderItemsRef,
    orderItemsDirtyRef,
    pendingQuantityUpdatesRef,
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
      const itemDebugTag = (stage: string, err: unknown = null) => {
        const msg = String((err as Error)?.message || err || '').replace(/\s+/g, ' ').slice(0, 80);
        return `MESA_ITEM_DBG|stage=${stage}|order=${currentOrderId || 'na'}|localFlow=${shouldUseLocalItemFlow ? '1' : '0'}|msg=${msg || 'na'}`;
      };

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
        const isOptimisticExistingItem = String(existingItem?.id || '').startsWith('tmp-');
        nextOrderItems = currentOrderItems.map((item) =>
          item.id === existingItem.id
            ? { ...item, quantity: nextQuantity, subtotal: nextQuantity * Number(item.price || 0) }
            : item
        );
        orderItemsDirtyRef.current = true;
        orderItemsRef.current = nextOrderItems;
        setOrderItems(nextOrderItems);
        orderItemsChanged = true;
        if (isOptimisticExistingItem || shouldUseLocalItemFlow) {
          optimisticTempItemQuantitiesRef.current[existingItem.id] = nextQuantity;
          setPendingQuantityUpdatesSafe((prev) => ({ ...(prev || {}), [existingItem.id]: nextQuantity }));
          if (shouldUseLocalItemFlow) {
            setPendingQuantityUpdatesSafe((prev) => {
              const next = { ...(prev || {}) };
              delete next[existingItem.id];
              return next;
            });
          }
        } else {
          markOrderItemOpStarted();
          enqueueOrderItemWrite(existingItem.id, () =>
            updateOrderItemQuantityById({ itemId: existingItem.id, quantity: nextQuantity, businessId, orderId: selectedMesa.current_order_id })
          )
            .catch(async () => {
              showError('Error', t('mesas:errors.addItemFailed'));
              try {
                const freshItems = await getOrderItemsByOrderId({ orderId: selectedMesa.current_order_id, selectSql: ORDER_ITEMS_SELECT });
                if (Array.isArray(freshItems)) {
                  setOrderItems((prevItems) => mergeOrderItemsPreservingPosition(prevItems, applyPendingQuantities(freshItems, pendingQuantityUpdatesRef.current)));
                }
              } catch (err) {
                logger.warn('mesas:order_operations:quantity_sync_refresh_items failed', err);
              }
            })
            .finally(() => markOrderItemOpFinished());
          setPendingQuantityUpdatesSafe((prev) => {
            const next = { ...prev };
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
          optimisticTempItemQuantitiesRef.current[tempId] = optimisticQuantity;
          nextOrderItems = [optimisticItem, ...currentOrderItems];
          orderItemsDirtyRef.current = true;
          orderItemsRef.current = nextOrderItems;
          setOrderItems(nextOrderItems);
          orderItemsChanged = true;
          markOrderItemOpStarted();
          insertOrderItem({
            row: { order_id: selectedMesa.current_order_id, product_id: isCombo ? null : itemId, combo_id: isCombo ? itemId : null, quantity: qty, price: parseFloat(String(precio)) },
            selectSql: 'id',
            businessId,
          })
            .then((newItem: any) => {
              if (!newItem?.id) { delete optimisticTempItemQuantitiesRef.current[tempId]; return; }
              const latestTempItem = (Array.isArray(orderItemsRef.current) ? orderItemsRef.current : []).find((item) => item.id === tempId);
              const trackedTempQuantity = toFiniteNumber(optimisticTempItemQuantitiesRef.current?.[tempId], NaN);
              const resolvedQuantity = Number.isFinite(trackedTempQuantity) && trackedTempQuantity > 0 ? trackedTempQuantity : toFiniteNumber(latestTempItem?.quantity, optimisticQuantity);
              const resolvedPrice = toFiniteNumber(latestTempItem?.price, optimisticPrice);
              const pendingTempQuantity = toFiniteNumber(pendingQuantityUpdatesRef.current?.[tempId], NaN);
              const quantityToPersist = Number.isFinite(pendingTempQuantity) && pendingTempQuantity > 0 ? pendingTempQuantity : resolvedQuantity;
              const shouldPersistResolvedQuantity = Math.abs(quantityToPersist - optimisticQuantity) > 0.0001;
              setOrderItems((prevItems) => prevItems.map((item) => (item.id === tempId ? { ...item, id: newItem.id!, quantity: resolvedQuantity, subtotal: resolvedQuantity * resolvedPrice } : item)));
              setPendingQuantityUpdatesSafe((prev) => {
                const next = { ...(prev || {}) };
                delete next[tempId];
                if (shouldPersistResolvedQuantity) next[newItem.id!] = quantityToPersist;
                else delete next[newItem.id!];
                return next;
              });
              delete optimisticTempItemQuantitiesRef.current[tempId];
              if (!shouldPersistResolvedQuantity) return;
              markOrderItemOpStarted();
              enqueueOrderItemWrite(newItem.id!, () => updateOrderItemQuantityById({ itemId: newItem.id!, quantity: quantityToPersist, businessId, orderId: selectedMesa.current_order_id }))
                .then(() => setPendingQuantityUpdatesSafe((prev) => { const next = { ...(prev || {}) }; delete next[newItem.id!]; return next; }))
                .catch(async () => {
                  showError('Error', `${t('mesas:errors.addItemFailed')} [${itemDebugTag('quantity-sync-failed')}]`);
                  try {
                    const freshItems = await getOrderItemsByOrderId({ orderId: selectedMesa.current_order_id, selectSql: ORDER_ITEMS_SELECT });
                    if (Array.isArray(freshItems)) setOrderItems((prevItems) => mergeOrderItemsPreservingPosition(prevItems, applyPendingQuantities(freshItems, pendingQuantityUpdatesRef.current)));
                  } catch (err) { logger.warn('mesas:order_operations:remove_item_refresh failed', err); }
                })
                .finally(() => markOrderItemOpFinished());
            })
            .catch(async (err) => {
              logger.warn('mesas:order_operations:insert_item_catch failed', err);
              showError('Error', `${t('mesas:errors.addItemFailed')} [${itemDebugTag('insert-catch')}]`);
              delete optimisticTempItemQuantitiesRef.current[tempId];
              setOrderItems((prevItems) => prevItems.filter((item) => item.id !== tempId));
              setPendingQuantityUpdatesSafe((prev) => { const next = { ...(prev || {}) }; delete next[tempId]; return next; });
              try {
                const freshItems = await getOrderItemsByOrderId({ orderId: selectedMesa.current_order_id, selectSql: ORDER_ITEMS_SELECT });
                if (Array.isArray(freshItems)) setOrderItems((prevItems) => mergeOrderItemsPreservingPosition(prevItems, applyPendingQuantities(freshItems, pendingQuantityUpdatesRef.current)));
              } catch (recoverErr) { logger.warn('mesas:order_operations:insert_item_recover_items failed', recoverErr); }
            })
            .finally(() => markOrderItemOpFinished());
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
    selectedMesa, quantityToAdd, updateOrderTotal, setPendingQuantityUpdatesSafe, businessId, isOfflineFirstRuntime,
    markOrderItemOpStarted, markOrderItemOpFinished, enqueueOrderItemWrite, showError, setOrderItems,
    setSearchProduct, setQuantityToAdd, pendingQuantityUpdatesRef, optimisticTempItemQuantitiesRef,
    pendingOrderItemOpsRef, orderItemsRef, orderItemsDirtyRef, t,
  ]);

  const updateItemQuantity = useCallback(async (itemId: string, newQuantity: number) => {
    try {
      if (pendingOrderItemOpsRef.current > 0) {
        showError('Error', t('mesas:errors.syncingChanges'));
        return;
      }
      const normalizedQuantity = toFiniteNumber(newQuantity, NaN);
      if (!Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) {
        if (String(itemId || '').startsWith('tmp-')) delete optimisticTempItemQuantitiesRef.current[itemId];
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
      if (String(itemId || '').startsWith('tmp-')) optimisticTempItemQuantitiesRef.current[itemId] = normalizedQuantity;
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
  }, [selectedMesa, isOfflineFirstRuntime, removeItem, setPendingQuantityUpdatesSafe, pendingOrderItemOpsRef, optimisticTempItemQuantitiesRef, showError, setOrderItems, pendingQuantityUpdatesRef, orderItemsRef, orderItemsDirtyRef, t]);

  return {
    updateOrderTotal,
    flushPendingRemoteOrderTotals,
    persistPendingQuantityUpdates,
    removeItem,
    addCatalogItemToOrder,
    updateItemQuantity,
  };
}
