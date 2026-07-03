import { useCallback, useRef, useEffect } from 'react';
import { useRealtimeSubscription } from '../../../hooks/useRealtime.js';
import {
  getOrderForRealtimeById,
  getOrderItemsByOrderId
} from '../../../data/queries/ordersQueries';
import { normalizeTableRecord } from '../../../utils/tableStatus';
import {
  normalizeEntityId,
  mergeOrderItemsPreservingPosition,
  applyPendingQuantities,
  normalizeOrderItemNumericFields,
  ORDER_ITEMS_SELECT,
  toFiniteNumber,
  getTotalProductUnits,
  calculateOrderItemsTotal,
  compareTableIdentifiers
} from './mesaHelpers.js';
import { logger } from '@/utils/logger';

export function useMesaRealtime({
  businessId,
  setMesas,
  enqueueRealtimeUpdate,
  setSelectedMesa,
  selectedMesaRef,
  orderItemsRef,
  setOrderItems,
  pendingQuantityUpdatesRef,
  pendingOrderItemOps,
  productCatalogByIdRef,
  orderItemsDirtyRef,
  lastSyncedOrderTotalsRef,
  justCompletedSaleRef,
  setShowOrderDetails,
  setModalOpenIntent,
  pendingRemoteOrderTotalsRef,
  loadCombos,
  comboCatalogByIdRef,
  isOpeningTableRef,
}) {
  const orderRealtimeRefreshTimersRef = useRef({});

  const handleTableInsert = useCallback((newTable) => {
    const normalizedTable = normalizeTableRecord(newTable);
    setMesas(prev => {
      const exists = prev.some(m => m.id === normalizedTable.id);
      if (exists) {
        return prev;
      }
      return [...prev, normalizedTable].sort(compareTableIdentifiers);
    });
  }, [setMesas]);

  const handleTableUpdate = useCallback((updatedTable) => {
    const normalizedTable = normalizeTableRecord(updatedTable);
    if (justCompletedSaleRef.current) {
      return;
    }

    setMesas((prev) => prev.map((mesa) => {
      if (mesa.id !== normalizedTable.id) return mesa;
      const resolvedOrders = normalizedTable.current_order_id
        ? (normalizedTable.orders ?? mesa.orders)
        : null;
      return normalizeTableRecord({
        ...mesa,
        ...normalizedTable,
        orders: resolvedOrders
      });
    }));

    setSelectedMesa(prev => {
      if (prev?.id === normalizedTable.id) {
        if (normalizedTable.status === 'available' && !normalizedTable.current_order_id && !isOpeningTableRef?.current) {
          setShowOrderDetails(false);
          setModalOpenIntent(false);
          return null;
        }
        return normalizeTableRecord({
          ...prev,
          ...normalizedTable,
          orders: normalizedTable.current_order_id
            ? (normalizedTable.orders ?? prev.orders)
            : null
        });
      }
      return prev;
    });
  }, [justCompletedSaleRef, setMesas, setSelectedMesa, setShowOrderDetails, setModalOpenIntent, isOpeningTableRef]);

  const handleTableDelete = useCallback((deletedTable) => {
    setMesas(prev => {
      const filtered = prev.filter(m => m.id !== deletedTable.id);
      return filtered;
    });
    setSelectedMesa(prev => {
      if (prev?.id === deletedTable.id) {
        setShowOrderDetails(false);
        setModalOpenIntent(false);
        return null;
      }
      return prev;
    });
  }, [setMesas, setSelectedMesa, setShowOrderDetails, setModalOpenIntent]);

  const hydrateRealtimeOrderItem = useCallback((rawItem = {}, previousItem = null) => {
    const mergedItem = {
      ...(previousItem && typeof previousItem === 'object' ? previousItem : {}),
      ...(rawItem && typeof rawItem === 'object' ? rawItem : {})
    };
    const normalizedItem = normalizeOrderItemNumericFields(mergedItem);
    const productId = normalizeEntityId(normalizedItem?.product_id || normalizedItem?.products?.id);
    const comboId = normalizeEntityId(normalizedItem?.combo_id || normalizedItem?.combos?.id);

    if (productId) {
      const catalogProduct = productCatalogByIdRef.current.get(productId);
      normalizedItem.products = catalogProduct
        ? {
          id: catalogProduct.id,
          name: catalogProduct.name || normalizedItem?.products?.name || 'Producto',
          code: catalogProduct.code || normalizedItem?.products?.code || '',
          category: catalogProduct.category || normalizedItem?.products?.category || null
        }
        : (normalizedItem.products || previousItem?.products || null);
    }

    if (comboId) {
      const catalogCombo = comboCatalogByIdRef.current.get(comboId);
      normalizedItem.combos = catalogCombo
        ? {
          id: catalogCombo.id,
          nombre: catalogCombo.nombre || normalizedItem?.combos?.nombre || 'Combo',
          descripcion: catalogCombo.descripcion || normalizedItem?.combos?.descripcion || null
        }
        : (normalizedItem.combos || previousItem?.combos || null);
    }

    return normalizedItem;
  }, [productCatalogByIdRef, comboCatalogByIdRef]);

  const applyRealtimeOrderItemChange = useCallback((previousItems = [], rawItem, eventType = 'UPDATE') => {
    const safePreviousItems = Array.isArray(previousItems) ? previousItems : [];
    const normalizedType = String(eventType || 'UPDATE').trim().toUpperCase();
    const itemId = normalizeEntityId(rawItem?.id);

    if (normalizedType === 'DELETE') {
      if (itemId) {
        return safePreviousItems.filter((item) => normalizeEntityId(item?.id) !== itemId);
      }

      const targetProductId = normalizeEntityId(rawItem?.product_id);
      const targetComboId = normalizeEntityId(rawItem?.combo_id);
      if (!targetProductId && !targetComboId) return safePreviousItems;

      return safePreviousItems.filter((item) => {
        const sameProduct = targetProductId && normalizeEntityId(item?.product_id) === targetProductId;
        const sameCombo = targetComboId && normalizeEntityId(item?.combo_id) === targetComboId;
        return !(sameProduct || sameCombo);
      });
    }

    if (!itemId) return safePreviousItems;

    const existingIndex = safePreviousItems.findIndex((item) => normalizeEntityId(item?.id) === itemId);
    const previousItem = existingIndex >= 0 ? safePreviousItems[existingIndex] : null;
    const hydratedItem = hydrateRealtimeOrderItem(rawItem, previousItem);

    if (existingIndex >= 0) {
      return safePreviousItems.map((item, index) => (index === existingIndex ? hydratedItem : item));
    }

    const hydratedProductId = normalizeEntityId(hydratedItem?.product_id);
    const hydratedComboId = normalizeEntityId(hydratedItem?.combo_id);
    const tempDuplicateIndex = safePreviousItems.findIndex((item) => {
      const isTemp = String(item?.id || '').startsWith('tmp-');
      if (!isTemp) return false;

      const sameProduct = hydratedProductId && normalizeEntityId(item?.product_id) === hydratedProductId;
      const sameCombo = hydratedComboId && normalizeEntityId(item?.combo_id) === hydratedComboId;
      return Boolean(sameProduct || sameCombo);
    });

    if (tempDuplicateIndex >= 0) {
      return safePreviousItems.map((item, index) => (
        index === tempDuplicateIndex ? { ...item, ...hydratedItem } : item
      ));
    }

    return [hydratedItem, ...safePreviousItems];
  }, [hydrateRealtimeOrderItem]);

  const scheduleOrderRealtimeRefresh = useCallback((orderId, mesaId) => {
    if (!orderId || !mesaId) return;
    if (justCompletedSaleRef.current) return;
    if (normalizeEntityId(selectedMesaRef.current?.current_order_id) === normalizeEntityId(orderId)
      && orderItemsDirtyRef.current) {
      return;
    }

    const timers = orderRealtimeRefreshTimersRef.current;
    if (timers[orderId]) {
      clearTimeout(timers[orderId]);
    }

    timers[orderId] = setTimeout(async () => {
      delete timers[orderId];
      if (justCompletedSaleRef.current) return;

      try {
        const updatedOrder = await getOrderForRealtimeById({
          orderId,
          selectSql: ORDER_ITEMS_SELECT
        });
        if (!updatedOrder || justCompletedSaleRef.current) return;

        const normalizedOrderStatus = String(updatedOrder?.status || '').trim().toLowerCase();
        const shouldRetryItemsFetch = (
          normalizedOrderStatus === 'open'
          && toFiniteNumber(updatedOrder?.total, 0) > 0
        );

        const joinedOrderItems = applyPendingQuantities(
          Array.isArray(updatedOrder?.order_items) ? updatedOrder.order_items : [],
          pendingQuantityUpdatesRef.current
        );
        let incomingOrderItems = joinedOrderItems;

        if (normalizedOrderStatus === 'open') {
          try {
            const directItems = await getOrderItemsByOrderId({
              orderId,
              selectSql: ORDER_ITEMS_SELECT
            });
            const normalizedDirectItems = applyPendingQuantities(
              Array.isArray(directItems) ? directItems : [],
              pendingQuantityUpdatesRef.current
            );
            if (normalizedDirectItems.length > 0 || joinedOrderItems.length === 0) {
              incomingOrderItems = normalizedDirectItems;
            }
          } catch (err) {
            logger.warn('mesas:realtime:fetch_order_items_direct failed', err);
          }
        }

        if (incomingOrderItems.length === 0 && shouldRetryItemsFetch) {
          try {
            const retryItems = await getOrderItemsByOrderId({
              orderId,
              selectSql: ORDER_ITEMS_SELECT
            });
            const normalizedRetryItems = applyPendingQuantities(
              Array.isArray(retryItems) ? retryItems : [],
              pendingQuantityUpdatesRef.current
            );
            if (normalizedRetryItems.length > 0) {
              incomingOrderItems = normalizedRetryItems;
            }
          } catch (err) {
            logger.warn('mesas:realtime:fetch_order_items_retry failed', err);
          }
        }

        const resolvedUpdatedOrder = incomingOrderItems.length > 0
          ? { ...updatedOrder, order_items: incomingOrderItems }
          : updatedOrder;
        const shouldProtectFromTransientEmpty = (
          incomingOrderItems.length === 0
          && (
            orderItemsDirtyRef.current
            || (normalizedOrderStatus === 'open' && toFiniteNumber(updatedOrder?.total, 0) > 0)
          )
        );
        const incomingOrderTotal = toFiniteNumber(updatedOrder?.total, NaN);
        const pendingRemoteTotal = toFiniteNumber(
          pendingRemoteOrderTotalsRef.current?.[orderId],
          NaN
        );

        enqueueRealtimeUpdate(() => {
          setMesas((prev) => prev.map((mesa) => {
            if (mesa.id !== mesaId) return mesa;

            const previousOrderItems = Array.isArray(mesa?.orders?.order_items)
              ? mesa.orders.order_items
              : [];
            const nextOrderItems = shouldProtectFromTransientEmpty
              ? previousOrderItems
              : incomingOrderItems;
            const nextOrderTotal = nextOrderItems.length > 0
              ? calculateOrderItemsTotal(nextOrderItems)
              : (
                Number.isFinite(pendingRemoteTotal)
                  ? pendingRemoteTotal
                  : (
                    Number.isFinite(incomingOrderTotal)
                      ? incomingOrderTotal
                      : toFiniteNumber(mesa?.orders?.total, 0)
                  )
              );
            const nextOrder = normalizedOrderStatus === 'open'
              ? {
                ...updatedOrder,
                order_items: nextOrderItems,
                total: nextOrderTotal,
                local_units: getTotalProductUnits(nextOrderItems)
              }
              : resolvedUpdatedOrder;

            return {
              ...mesa,
              orders: nextOrder
            };
          }));

          setSelectedMesa((prevSelected) => {
            if (prevSelected?.id !== mesaId) return prevSelected;
            setOrderItems((prevItems) =>
              (shouldProtectFromTransientEmpty && prevItems.length > 0)
                ? prevItems
                : mergeOrderItemsPreservingPosition(prevItems, incomingOrderItems)
            );

            const previousSelectedItems = Array.isArray(prevSelected?.orders?.order_items)
              ? prevSelected.orders.order_items
              : [];
            const nextSelectedItems = shouldProtectFromTransientEmpty
              ? previousSelectedItems
              : incomingOrderItems;
            const nextSelectedTotal = nextSelectedItems.length > 0
              ? calculateOrderItemsTotal(nextSelectedItems)
              : (
                Number.isFinite(pendingRemoteTotal)
                  ? pendingRemoteTotal
                  : (
                    Number.isFinite(incomingOrderTotal)
                      ? incomingOrderTotal
                      : toFiniteNumber(prevSelected?.orders?.total, 0)
                  )
              );
            const nextSelectedOrder = normalizedOrderStatus === 'open'
              ? {
                ...updatedOrder,
                order_items: nextSelectedItems,
                total: nextSelectedTotal,
                local_units: getTotalProductUnits(nextSelectedItems)
              }
              : resolvedUpdatedOrder;

            return {
              ...prevSelected,
              orders: nextSelectedOrder
            };
          });
        });
      } catch (err) {
        logger.warn('mesas:realtime:refresh_order_after_realtime failed', err);
      }
    }, 100);
  }, [
    justCompletedSaleRef,
    selectedMesaRef,
    orderItemsDirtyRef,
    pendingQuantityUpdatesRef,
    pendingRemoteOrderTotalsRef,
    enqueueRealtimeUpdate,
    setMesas,
    setSelectedMesa,
    setOrderItems
  ]);

  const handleOrderItemChange = useCallback((item, eventType = 'UPDATE') => {
    const orderId = normalizeEntityId(item?.order_id);
    if (!orderId) return;
    if (justCompletedSaleRef.current) return;

    const isSelectedOrder = normalizeEntityId(selectedMesaRef.current?.current_order_id) === orderId;
    const isEditingSelectedOrder = isSelectedOrder && orderItemsDirtyRef.current;
    let mesaAfectadaId = null;

    if (!isEditingSelectedOrder) {
      setMesas((prevMesas) => {
        const mesaAfectada = prevMesas.find((mesa) => normalizeEntityId(mesa?.current_order_id) === orderId);
        if (!mesaAfectada) return prevMesas;

        mesaAfectadaId = mesaAfectada.id;
        const previousOrderItems = Array.isArray(mesaAfectada?.orders?.order_items)
          ? mesaAfectada.orders.order_items
          : [];
        const nextOrderItems = applyRealtimeOrderItemChange(previousOrderItems, item, eventType);
        const nextOrderTotal = calculateOrderItemsTotal(nextOrderItems);
        const nextLocalUnits = getTotalProductUnits(nextOrderItems);

        return prevMesas.map((mesa) => (
          mesa.id === mesaAfectada.id
            ? {
              ...mesa,
              orders: {
                ...(mesa.orders || {}),
                id: normalizeEntityId(mesa?.orders?.id) || orderId,
                order_items: nextOrderItems,
                total: nextOrderTotal,
                local_units: nextLocalUnits
              }
            }
            : mesa
        ));
      });
    } else if (isSelectedOrder) {
      mesaAfectadaId = selectedMesaRef.current?.id || null;
    }

    if (isSelectedOrder && !isEditingSelectedOrder) {
      setOrderItems((prevItems) => {
        const nextItems = applyRealtimeOrderItemChange(prevItems, item, eventType);
        orderItemsRef.current = nextItems;
        return nextItems;
      });

      setSelectedMesa((prevSelected) => {
        if (normalizeEntityId(prevSelected?.current_order_id) !== orderId) return prevSelected;
        const previousSelectedItems = Array.isArray(prevSelected?.orders?.order_items)
          ? prevSelected.orders.order_items
          : [];
        const nextSelectedItems = applyRealtimeOrderItemChange(previousSelectedItems, item, eventType);

        return {
          ...prevSelected,
          orders: {
            ...(prevSelected.orders || {}),
            id: normalizeEntityId(prevSelected?.orders?.id) || orderId,
            order_items: nextSelectedItems,
            total: calculateOrderItemsTotal(nextSelectedItems),
            local_units: getTotalProductUnits(nextSelectedItems)
          }
        };
      });
    }

    if (mesaAfectadaId && !isEditingSelectedOrder) {
      scheduleOrderRealtimeRefresh(orderId, mesaAfectadaId);
    }
  }, [
    justCompletedSaleRef,
    selectedMesaRef,
    orderItemsDirtyRef,
    orderItemsRef,
    setMesas,
    setOrderItems,
    setSelectedMesa,
    applyRealtimeOrderItemChange,
    scheduleOrderRealtimeRefresh
  ]);

  // 🔥 TIEMPO REAL: Suscripción a cambios en mesas
  useRealtimeSubscription('tables', {
    filter: { business_id: businessId },
    enabled: !!businessId,
    onInsert: (newTable) => enqueueRealtimeUpdate(() => handleTableInsert(newTable)),
    onUpdate: (updatedTable) => enqueueRealtimeUpdate(() => handleTableUpdate(updatedTable)),
    onDelete: (deletedTable) => enqueueRealtimeUpdate(() => handleTableDelete(deletedTable))
  });

  // 🔥 TIEMPO REAL: Suscripción a cambios en órdenes
  useRealtimeSubscription('orders', {
    filter: { business_id: businessId },
    enabled: !!businessId,
    onUpdate: (updatedOrder) => {
      enqueueRealtimeUpdate(() => {
        if (justCompletedSaleRef.current) {
          return;
        }

        const normalizedOrderId = normalizeEntityId(updatedOrder?.id);
        if (!normalizedOrderId) return;

        const normalizedOrderStatus = String(updatedOrder?.status || '').trim().toLowerCase();
        const incomingOrderTotal = toFiniteNumber(updatedOrder?.total, NaN);
        const pendingRemoteTotal = toFiniteNumber(
          pendingRemoteOrderTotalsRef.current?.[normalizedOrderId],
          NaN
        );
        let affectedMesaId = null;

        const isSelectedOrder = normalizeEntityId(selectedMesaRef.current?.current_order_id) === normalizedOrderId;
        const isEditingSelectedOrder = (
          isSelectedOrder
          && orderItemsDirtyRef.current
          && normalizedOrderStatus === 'open'
        );

        if (!isEditingSelectedOrder) {
          setMesas((prev) => prev.map((mesa) => {
            if (normalizeEntityId(mesa?.current_order_id) !== normalizedOrderId) return mesa;
            affectedMesaId = mesa.id;

            const previousOrderItems = Array.isArray(mesa?.orders?.order_items)
              ? mesa.orders.order_items
              : [];
            const stableOpenTotal = previousOrderItems.length > 0
              ? calculateOrderItemsTotal(previousOrderItems)
              : (
                Number.isFinite(pendingRemoteTotal)
                  ? pendingRemoteTotal
                  : (
                    Number.isFinite(incomingOrderTotal)
                      ? incomingOrderTotal
                      : toFiniteNumber(mesa?.orders?.total, 0)
                  )
              );
            const nextOrder = normalizedOrderStatus === 'open'
              ? {
                ...(mesa.orders || {}),
                ...updatedOrder,
                order_items: previousOrderItems,
                total: stableOpenTotal,
                local_units: previousOrderItems.length > 0
                  ? getTotalProductUnits(previousOrderItems)
                  : toFiniteNumber(mesa?.orders?.local_units, 0)
              }
              : { ...(mesa.orders || {}), ...updatedOrder };
            const nextMesa = {
              ...mesa,
              orders: nextOrder
            };

            if (normalizedOrderStatus === 'closed') {
              return normalizeTableRecord({
                ...nextMesa,
                current_order_id: null,
                status: 'available'
              });
            }
            return normalizeTableRecord(nextMesa);
          }));
        }

        setSelectedMesa((prevSelected) => {
          if (normalizeEntityId(prevSelected?.current_order_id) !== normalizedOrderId) return prevSelected;
          if (normalizedOrderStatus !== 'open') return prevSelected;
          if (isEditingSelectedOrder) return prevSelected;

          const previousSelectedItems = Array.isArray(prevSelected?.orders?.order_items)
            ? prevSelected.orders.order_items
            : [];
          const stableSelectedTotal = previousSelectedItems.length > 0
            ? calculateOrderItemsTotal(previousSelectedItems)
            : (
              Number.isFinite(pendingRemoteTotal)
                ? pendingRemoteTotal
                : (
                  Number.isFinite(incomingOrderTotal)
                    ? incomingOrderTotal
                    : toFiniteNumber(prevSelected?.orders?.total, 0)
                )
            );

          return {
            ...prevSelected,
            orders: {
              ...(prevSelected.orders || {}),
              ...updatedOrder,
              order_items: previousSelectedItems,
              total: stableSelectedTotal,
              local_units: previousSelectedItems.length > 0
                ? getTotalProductUnits(previousSelectedItems)
                : toFiniteNumber(prevSelected?.orders?.local_units, 0)
            }
          };
        });

        if (normalizedOrderStatus === 'open' && affectedMesaId && !isEditingSelectedOrder) {
          scheduleOrderRealtimeRefresh(normalizedOrderId, affectedMesaId);
        }
      });
    }
  });

  // 🔥 TIEMPO REAL: Suscripción a cambios en items de orden (NIVEL NEGOCIO)
  useRealtimeSubscription('order_items', {
    enabled: !!businessId,
    filter: {},
    onInsert: (newItem) => enqueueRealtimeUpdate(() => handleOrderItemChange(newItem, 'INSERT')),
    onUpdate: (updatedItem) => enqueueRealtimeUpdate(() => handleOrderItemChange(updatedItem, 'UPDATE')),
    onDelete: (deletedItem) => enqueueRealtimeUpdate(() => handleOrderItemChange(deletedItem, 'DELETE'))
  });

  // 🔥 TIEMPO REAL: Suscripción a cambios en combos
  useRealtimeSubscription('combos', {
    filter: { business_id: businessId },
    enabled: !!businessId,
    onInsert: () => { loadCombos().catch((err) => { logger.warn('mesas:realtime:load_combos_on_insert failed', err); }); },
    onUpdate: () => { loadCombos().catch((err) => { logger.warn('mesas:realtime:load_combos_on_update failed', err); }); },
    onDelete: () => { loadCombos().catch((err) => { logger.warn('mesas:realtime:load_combos_on_delete failed', err); }); }
  });

  useEffect(() => () => {
    const timers = orderRealtimeRefreshTimersRef.current || {};
    Object.values(timers).forEach((timerId) => clearTimeout(timerId));
  }, []);

  return { orderRealtimeRefreshTimersRef };
}
