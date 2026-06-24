import { useCallback } from 'react';
import {
  createOrderAndOccupyTable,
  createTable,
  deleteOrderAndReleaseTable,
  deleteOrderItemById,
  insertOrderItem,
  persistOrderItemQuantities,
  updateOrderItemQuantityById,
  updateOrderTotalById
} from '../../../data/commands/ordersCommands';
import {
  getOrderForRealtimeById,
  getOrderItemsByOrderId,
  getOrderWithItemsById,
  getTablesWithCurrentOrderByBusiness
} from '../../../data/queries/ordersQueries';
import {
  getAuthenticatedUser as getAuthenticatedUserFromOrders
} from '../../../data/queries/authQueries';
import {
  MESA_IN_USE_MESSAGE,
  ORDER_ITEMS_SELECT,
  ORDER_ITEM_TYPE,
  toFiniteNumber,
  getTotalProductUnits,
  calculateOrderItemsTotal,
  isConnectivityError,
  normalizeEntityId,
  mergeOrderItemsPreservingPosition,
  normalizeTableIdentifier,
  compareTableIdentifiers,
  applyPendingQuantities,
  buildDiagnosticAlertMessage,
  sanitizeMesaOrderAssociation,
  reconcileTablesWithOpenOrders,
  reconcileClosedOrdersFromOutbox
} from './mesaHelpers.js';
import { normalizeTableRecord } from '../../../utils/tableStatus';
import {
  isOfflineMode,
  isOfflinePersistenceEnabled,
  readOfflineSnapshot,
  saveOfflineSnapshot
} from '../../../utils/offlineSnapshot.js';
import { invalidateOrderCache } from '../../../data/adapters/cacheInvalidation.js';
import { closeModalImmediate } from '../../../utils/closeModalImmediate';

export function useMesaOrderOperations({
  businessId,
  _userRole,
  _mesas,
  setMesas,
  selectedMesa,
  setSelectedMesa,
  _showOrderDetails,
  setShowOrderDetails,
  orderItems,
  setOrderItems,
  setPendingQuantityUpdatesSafe,
  _productos,
  _combos,
  _catalogItems,
  _productCatalogByIdRef,
  _comboCatalogByIdRef,
  pendingQuantityUpdatesRef,
  orderItemsDirtyRef,
  orderItemsRef,
  _selectedMesaRef,
  orderDetailsRequestRef,
  pendingRemoteOrderTotalsRef,
  orderTotalSyncQueueRef,
  lastSyncedOrderTotalsRef,
  optimisticTempItemQuantitiesRef,
  pendingOrderItemOpsRef,
  _orderItemWriteQueueRef,
  markOrderItemOpStarted,
  markOrderItemOpFinished,
  waitForPendingOrderItemOps,
  enqueueOrderItemWrite,
  acquireMesaEditLockWeb,
  _releaseMesaEditLockWeb,
  _sendMesaSyncBroadcast,
  publishMesaLockBroadcast,
  ensureCatalogWarmup,
  isOfflineFirstRuntime,
  setMesaOpenDebugStage,
  buildMesaOpenDebugTag,
  setError,
  setSuccess,
  setSuccessTitle,
  setSuccessDetails,
  setAlertType,
  isCreatingTable,
  setIsCreatingTable,
  newTableNumber,
  setNewTableNumber,
  _modalOpenIntent,
  setModalOpenIntent,
  _canShowOrderModal,
  setCanShowOrderModal,
  _searchProduct,
  setSearchProduct,
  quantityToAdd,
  setQuantityToAdd,
  getCurrentUser,
  currentUser,
  canManageTables,
  isEmployee,
  activeMesaBroadcastRef,
  mesaSyncClientIdRef,
  heldMesaLockRef,
  getMesaLockState,
  showAddForm,
  setShowAddForm
}) {
  const pendingOrderItemOpsCountRef = pendingOrderItemOpsRef;

  const ensureCurrentUser = useCallback(async () => {
    const user = await getCurrentUser();
    return user?.id || currentUser?.id || null;
  }, [getCurrentUser, currentUser?.id]);

  const loadMesas = useCallback(async () => {
    const offline = isOfflineMode();
    const offlineSnapshotKey = `mesas.list:${businessId}`;
    const offlineSnapshot = readOfflineSnapshot(offlineSnapshotKey, []);

    if (offline && Array.isArray(offlineSnapshot) && offlineSnapshot.length > 0) {
      const normalizedOfflineSnapshot = offlineSnapshot.map(normalizeTableRecord).sort(compareTableIdentifiers);
      const withOpenOrders = await reconcileTablesWithOpenOrders({
        mesas: normalizedOfflineSnapshot,
        businessId
      });
      const reconciledSnapshot = await reconcileClosedOrdersFromOutbox(withOpenOrders);
      const finalSnapshot = reconciledSnapshot.map(normalizeTableRecord).sort(compareTableIdentifiers);
      const sanitizedSnapshot = finalSnapshot.map(sanitizeMesaOrderAssociation).sort(compareTableIdentifiers);
      setMesas(sanitizedSnapshot);
      saveOfflineSnapshot(offlineSnapshotKey, sanitizedSnapshot);
      return;
    }

    try {
      const data = await getTablesWithCurrentOrderByBusiness(businessId);
      const normalized = (Array.isArray(data) ? data : []).map(normalizeTableRecord).sort(compareTableIdentifiers);
      const withOpenOrders = offline
        ? await reconcileTablesWithOpenOrders({ mesas: normalized, businessId })
        : normalized;
      const reconciledMesas = offline ? await reconcileClosedOrdersFromOutbox(withOpenOrders) : withOpenOrders;
      const finalMesas = reconciledMesas.map(normalizeTableRecord).sort(compareTableIdentifiers);
      const sanitizedMesas = finalMesas.map(sanitizeMesaOrderAssociation).sort(compareTableIdentifiers);
      const hasLocalData = normalized.length > 0;

      if (offline && !hasLocalData && Array.isArray(offlineSnapshot) && offlineSnapshot.length > 0) {
        const normalizedOfflineSnapshot = offlineSnapshot.map(normalizeTableRecord).sort(compareTableIdentifiers);
        const withOpenOrdersFromSnapshot = await reconcileTablesWithOpenOrders({
          mesas: normalizedOfflineSnapshot,
          businessId
        });
        const reconciledSnapshot = await reconcileClosedOrdersFromOutbox(withOpenOrdersFromSnapshot);
        const finalSnapshot = reconciledSnapshot.map(normalizeTableRecord).sort(compareTableIdentifiers);
        const sanitizedSnapshot = finalSnapshot.map(sanitizeMesaOrderAssociation).sort(compareTableIdentifiers);
        setMesas(sanitizedSnapshot);
        saveOfflineSnapshot(offlineSnapshotKey, sanitizedSnapshot);
        return;
      }

      setMesas(sanitizedMesas);
      if (!offline || hasLocalData) {
        saveOfflineSnapshot(offlineSnapshotKey, sanitizedMesas);
      }
    } catch {
      const cached = readOfflineSnapshot(offlineSnapshotKey, []);
      if (Array.isArray(cached) && cached.length > 0) {
        const normalizedCached = cached.map(normalizeTableRecord).sort(compareTableIdentifiers);
        const withOpenOrdersCached = await reconcileTablesWithOpenOrders({
          mesas: normalizedCached,
          businessId
        });
        const reconciledCached = await reconcileClosedOrdersFromOutbox(withOpenOrdersCached);
        const finalCached = reconciledCached.map(normalizeTableRecord).sort(compareTableIdentifiers);
        const sanitizedCached = finalCached.map(sanitizeMesaOrderAssociation).sort(compareTableIdentifiers);
        setMesas(sanitizedCached);
        saveOfflineSnapshot(offlineSnapshotKey, sanitizedCached);
        return;
      }

      if (offline) {
        setMesas([]);
      } else {
        setError('No se pudo cargar las mesas. Revisa tu conexión e intenta de nuevo.');
      }
    }
  }, [businessId, setMesas, setError]);

  const clearClosedMesaCache = useCallback(async ({ tableId, orderId = null } = {}) => {
    const normalizedTableId = normalizeEntityId(tableId);
    if (!businessId || !normalizedTableId) return;

    const snapshotKey = `mesas.list:${businessId}`;
    const cachedMesas = readOfflineSnapshot(snapshotKey, []);
    if (Array.isArray(cachedMesas) && cachedMesas.length > 0) {
      const sanitized = cachedMesas.map((mesa) => {
        if (normalizeEntityId(mesa?.id) !== normalizedTableId) return mesa;
        return normalizeTableRecord({
          ...mesa,
          status: 'available',
          current_order_id: null,
          orders: null
        });
      });
      saveOfflineSnapshot(snapshotKey, sanitized);
    }

    invalidateOrderCache({ businessId, orderId }).catch(() => {});
  }, [businessId]);

  const handleCreateTable = useCallback(async (e) => {
    e.preventDefault();

    if (!canManageTables || isEmployee) {
      setShowAddForm(false);
      setError('Solo el administrador puede crear mesas.');
      return;
    }
    
    if (isCreatingTable) return;
    
    setIsCreatingTable(true);
    setError(null);
    setSuccess(null);
    
    try {
      const tableIdentifier = normalizeTableIdentifier(newTableNumber);
      if (!tableIdentifier) {
        throw new Error('Ingresa un identificador de mesa válido');
      }

      try {
        const createdTable = await createTable({
          businessId,
          tableNumber: tableIdentifier
        });

        if (createdTable?.id) {
          const normalizedTable = normalizeTableRecord(createdTable);
          setMesas((prev) => {
            const exists = prev.some((table) => table.id === normalizedTable.id);
            if (exists) return prev;
            return [...prev, normalizedTable].sort(compareTableIdentifiers);
          });
        }

        if (!createdTable?.__localOnly) {
          await loadMesas();
        }
      } catch (error) {
        if (error?.code === '23505') {
          throw new Error('Este identificador de mesa ya existe');
        }
        throw error;
      }

      setAlertType('success');
      setSuccessTitle('Mesa Creada');
      setSuccessDetails([
        { label: 'Mesa', value: `#${tableIdentifier}` }
      ]);
      setSuccess(true);
      setNewTableNumber('');
      setShowAddForm(false);
      
    } catch (error) {
      setError(error?.message || 'No se pudo crear la mesa. Por favor, intenta de nuevo.');
    } finally {
      setIsCreatingTable(false);
    }
  }, [canManageTables, isEmployee, isCreatingTable, newTableNumber, businessId, loadMesas, setMesas, setError, setSuccess, setSuccessTitle, setSuccessDetails, setAlertType, setNewTableNumber, setShowAddForm, setIsCreatingTable]);

  const createNewOrder = useCallback(async (mesa) => {
    const openLocalOfflineOrder = () => {
      const localOrderId = `offline-order-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const localNow = new Date().toISOString();
      const localOrder = {
        id: localOrderId,
        business_id: businessId,
        table_id: mesa.id,
        user_id: currentUser?.id || null,
        status: 'open',
        total: 0,
        opened_at: localNow,
        updated_at: localNow,
        order_items: [],
        __localOnly: true,
        pending_sync: true
      };

      setMesas((prevMesas) =>
        prevMesas.map((item) => (
          item.id === mesa.id
            ? {
              ...item,
              status: 'occupied',
              current_order_id: localOrder.id,
              orders: localOrder
            }
            : item
        ))
      );
      setSelectedMesa(normalizeTableRecord({
        ...mesa,
        status: 'occupied',
        current_order_id: localOrder.id,
        orders: localOrder
      }));
      orderItemsDirtyRef.current = false;
      orderItemsRef.current = [];
      setOrderItems([]);
      setPendingQuantityUpdatesSafe({});
      setModalOpenIntent(true);
      setShowOrderDetails(true);
    };

    try {
      setError(null);
      setMesaOpenDebugStage('create:start');

      if (isOfflineFirstRuntime) {
        setMesaOpenDebugStage('create:offline-runtime-local');
        openLocalOfflineOrder();
        return;
      }

      let effectiveUserId = currentUser?.id || null;
      if (!effectiveUserId) {
        try {
          const authUser = await getAuthenticatedUserFromOrders();
          effectiveUserId = authUser?.id || null;
        } catch {
          effectiveUserId = null;
        }
      }

      const newOrder = await createOrderAndOccupyTable({
        businessId,
        tableId: mesa.id,
        userId: effectiveUserId
      });
      setMesaOpenDebugStage('create:remote-ok');

      setMesas((prevMesas) =>
        prevMesas.map((item) => (
          item.id === mesa.id
            ? {
              ...item,
              status: 'occupied',
              current_order_id: newOrder.id,
              orders: {
                id: newOrder.id,
                status: 'open',
                total: Number(newOrder?.total || 0),
                order_items: []
              }
            }
            : item
        ))
      );
      setSelectedMesa(normalizeTableRecord({
        ...mesa,
        status: 'occupied',
        current_order_id: newOrder.id,
        orders: newOrder
      }));
      orderItemsDirtyRef.current = false;
      orderItemsRef.current = [];
      setOrderItems([]);
      setPendingQuantityUpdatesSafe({});
      setModalOpenIntent(true);
      setShowOrderDetails(true);
      if (!newOrder?.__localOnly) {
        await loadMesas();
      }
    } catch (error) {
      setMesaOpenDebugStage('create:catch');
      if (isOfflinePersistenceEnabled()) {
        setMesaOpenDebugStage('create:catch-local-fallback-1');
        openLocalOfflineOrder();
        return;
      }

      if (isConnectivityError(error)) {
        setMesaOpenDebugStage('create:connectivity-fallback');
        openLocalOfflineOrder();
        return;
      }

      try {
        const latestTables = await getTablesWithCurrentOrderByBusiness(businessId);
        const latestMesa = (latestTables || []).find((item) => item?.id === mesa?.id);
        const normalizedLatestMesa = latestMesa ? normalizeTableRecord(latestMesa) : null;
        const recoveredOrderId = normalizedLatestMesa?.current_order_id || null;

        if (recoveredOrderId) {
          let recoveredOrder = null;
          try {
            recoveredOrder = await getOrderForRealtimeById({
              orderId: recoveredOrderId,
              selectSql: ORDER_ITEMS_SELECT
            });
          } catch {
            recoveredOrder = await getOrderWithItemsById({
              orderId: recoveredOrderId,
              selectSql: ORDER_ITEMS_SELECT
            });
          }

          setSelectedMesa(normalizeTableRecord({
            ...normalizedLatestMesa,
            orders: recoveredOrder || normalizedLatestMesa?.orders || null
          }));
          orderItemsDirtyRef.current = false;
          {
            const recoveredItems = applyPendingQuantities(
              Array.isArray(recoveredOrder?.order_items)
                ? recoveredOrder.order_items
                : (Array.isArray(normalizedLatestMesa?.orders?.order_items)
                  ? normalizedLatestMesa.orders.order_items
                  : []),
              pendingQuantityUpdatesRef.current
            );
            orderItemsRef.current = recoveredItems;
            setOrderItems(recoveredItems);
          }
          setPendingQuantityUpdatesSafe({});
          setModalOpenIntent(true);
          setShowOrderDetails(true);
          return;
        }
      } catch {
        // Si falla recuperación, caer a error visible para diagnóstico.
      }

      if (isOfflinePersistenceEnabled()) {
        try {
          setMesaOpenDebugStage('create:last-local-fallback');
          openLocalOfflineOrder();
          return;
        } catch {
          setMesaOpenDebugStage('create:last-local-fallback-failed');
        }
      }

      setShowOrderDetails(false);
      setModalOpenIntent(false);
      setSelectedMesa(null);
      setError(`No se pudo abrir la mesa: ${error?.message || 'Error desconocido'} [${buildMesaOpenDebugTag(error, mesa)}]`);
    }
  }, [buildMesaOpenDebugTag, businessId, currentUser, isOfflineFirstRuntime, loadMesas, setMesaOpenDebugStage, setPendingQuantityUpdatesSafe, setMesas, setSelectedMesa, setOrderItems, setShowOrderDetails, setModalOpenIntent, setError, orderItemsDirtyRef, orderItemsRef, pendingQuantityUpdatesRef]);

  const loadOrderDetails = useCallback(async (mesa, { requestId = null } = {}) => {
    const normalizedRequestId = Number(requestId);
    const hasRequestId = Number.isFinite(normalizedRequestId) && normalizedRequestId > 0;
    const isStaleRequest = () => (
      hasRequestId && orderDetailsRequestRef.current !== normalizedRequestId
    );
    const openWithMesaSnapshot = (mesaSnapshot) => {
      const mesaOrderItems = Array.isArray(mesaSnapshot?.orders?.order_items)
        ? mesaSnapshot.orders.order_items
        : [];
      const fallbackOrder = mesaSnapshot?.orders || {
        id: mesaSnapshot?.current_order_id || null,
        order_items: mesaOrderItems
      };
      const sanitizedMesa = sanitizeMesaOrderAssociation({
        ...mesaSnapshot,
        orders: fallbackOrder
      });

      setSelectedMesa(sanitizedMesa);
      orderItemsDirtyRef.current = false;
      setOrderItems((prevItems) =>
        mergeOrderItemsPreservingPosition(
          prevItems,
          applyPendingQuantities(mesaOrderItems, pendingQuantityUpdatesRef.current)
        )
      );
      setPendingQuantityUpdatesSafe({});
      setModalOpenIntent(true);
      setShowOrderDetails(true);
    };

    try {
      const normalizedOrderId = normalizeEntityId(mesa?.current_order_id);
      if (!normalizedOrderId) {
        if (isStaleRequest()) return;
        openWithMesaSnapshot(mesa);
        return;
      }

      if (isOfflineMode()) {
        const mesaOrderItems = Array.isArray(mesa?.orders?.order_items) ? mesa.orders.order_items : [];
        let cachedOrder = null;
        if (mesaOrderItems.length === 0 && normalizedOrderId) {
          try {
            cachedOrder = await getOrderWithItemsById({
              orderId: normalizedOrderId,
              selectSql: ORDER_ITEMS_SELECT
            });
          } catch {
            cachedOrder = null;
          }
        }

        const resolvedOrderItems = Array.isArray(cachedOrder?.order_items)
          ? cachedOrder.order_items
          : mesaOrderItems;
        const safeCachedOrder = (
          cachedOrder
          && normalizeEntityId(cachedOrder?.id) === normalizeEntityId(mesa?.current_order_id)
          && (
            !normalizeEntityId(cachedOrder?.table_id)
            || normalizeEntityId(cachedOrder?.table_id) === normalizeEntityId(mesa?.id)
          )
        ) ? cachedOrder : null;
        const fallbackOrder = safeCachedOrder || mesa?.orders || {
          id: mesa?.current_order_id || null,
          order_items: resolvedOrderItems
        };

        const sanitizedMesa = sanitizeMesaOrderAssociation({
          ...mesa,
          orders: fallbackOrder
        });
        if (isStaleRequest()) return;
        setSelectedMesa(sanitizedMesa);
        orderItemsDirtyRef.current = false;
        setOrderItems((prevItems) =>
          mergeOrderItemsPreservingPosition(
            prevItems,
            applyPendingQuantities(resolvedOrderItems, pendingQuantityUpdatesRef.current)
          )
        );
        setPendingQuantityUpdatesSafe({});
        setModalOpenIntent(true);
        setShowOrderDetails(true);
        return;
      }

      let order = null;
      try {
        order = await getOrderForRealtimeById({
          orderId: normalizedOrderId,
          selectSql: ORDER_ITEMS_SELECT
        });
      } catch {
        order = await getOrderWithItemsById({
          orderId: normalizedOrderId,
          selectSql: ORDER_ITEMS_SELECT
        });
      }
      if (isStaleRequest()) return;

      const mesaOrderItems = Array.isArray(mesa?.orders?.order_items) ? mesa.orders.order_items : [];
      const resolvedOrder = order || mesa?.orders || null;
      const resolvedOrderItems = Array.isArray(order?.order_items)
        ? order.order_items
        : mesaOrderItems;

      setSelectedMesa(normalizeTableRecord({ ...mesa, orders: resolvedOrder }));
      orderItemsDirtyRef.current = false;
      setOrderItems((prevItems) =>
        mergeOrderItemsPreservingPosition(
          prevItems,
          applyPendingQuantities(
            resolvedOrderItems,
            pendingQuantityUpdatesRef.current
          )
        )
      );
      setPendingQuantityUpdatesSafe({});
      setModalOpenIntent(true);
      setShowOrderDetails(true);
    } catch (error) {
      if (isStaleRequest()) return;
      const hasMesaSnapshotContext = Boolean(
        normalizeEntityId(mesa?.current_order_id)
        || (Array.isArray(mesa?.orders?.order_items) && mesa.orders.order_items.length >= 0)
      );

      if (hasMesaSnapshotContext) {
        openWithMesaSnapshot(mesa);
        return;
      }

      setError(buildDiagnosticAlertMessage(
        error,
        'No se pudieron cargar los detalles de la orden. Por favor, intenta de nuevo.'
      ));
    }
  }, [setPendingQuantityUpdatesSafe, setSelectedMesa, setOrderItems, setShowOrderDetails, setModalOpenIntent, setError, orderDetailsRequestRef, orderItemsDirtyRef, pendingQuantityUpdatesRef]);

  const handleOpenTable = useCallback(async (mesa) => {
    setMesaOpenDebugStage('open:start');
    const requestId = orderDetailsRequestRef.current + 1;
    orderDetailsRequestRef.current = requestId;

    orderItemsDirtyRef.current = false;
    setPendingQuantityUpdatesSafe({});

    const normalizedMesa = normalizeTableRecord(mesa);
    const preloadedOrderItems = Array.isArray(normalizedMesa?.orders?.order_items)
      ? normalizedMesa.orders.order_items
      : [];

    if (!isOfflineFirstRuntime) {
      setMesaOpenDebugStage('open:lock-check');
      const lockState = getMesaLockState(normalizedMesa?.id);
      if (lockState?.lockedByOther) {
        setMesaOpenDebugStage('open:lock-blocked');
        setError(MESA_IN_USE_MESSAGE);
        return;
      }
    }

    const resolvedUserId = await ensureCurrentUser();
    if (!resolvedUserId) {
      setMesaOpenDebugStage('open:user-missing');
      setError('No se pudo validar tu sesión. Cierra sesión e inténtalo de nuevo.');
      return;
    }

    if (!isOfflineFirstRuntime && normalizedMesa?.id && businessId) {
      setMesaOpenDebugStage('open:lock-acquire');
      const nextMesaId = normalizeEntityId(normalizedMesa.id);
      if (nextMesaId) {
        const previousActive = activeMesaBroadcastRef.current;
        if (previousActive?.tableId && previousActive.tableId !== nextMesaId) {
          publishMesaLockBroadcast({
            tableId: previousActive.tableId,
            locked: false,
            mode: 'rollback',
            lockToken: previousActive.lockToken || null
          });
        }
        const lockToken = `broadcast-${mesaSyncClientIdRef.current}-${Date.now()}`;
        publishMesaLockBroadcast({
          tableId: nextMesaId,
          locked: true,
          mode: 'optimistic',
          lockToken
        });
        activeMesaBroadcastRef.current = { tableId: nextMesaId, lockToken };
        const result = await acquireMesaEditLockWeb({
          targetBusinessId: businessId,
          tableId: nextMesaId,
          lockToken
        });

        if (result?.unsupported) {
          heldMesaLockRef.current = { businessId, tableId: nextMesaId, lockToken };
        } else if (result?.ok) {
          heldMesaLockRef.current = {
            businessId,
            tableId: nextMesaId,
            lockToken: result.lockToken || lockToken
          };
          publishMesaLockBroadcast({
            tableId: nextMesaId,
            locked: true,
            mode: 'confirmed',
            lockToken: result.lockToken || lockToken
          });
        } else {
          setMesaOpenDebugStage('open:lock-rejected');
          publishMesaLockBroadcast({
            tableId: nextMesaId,
            locked: false,
            mode: 'rollback',
            lockToken
          });
          activeMesaBroadcastRef.current = null;
          heldMesaLockRef.current = null;
          setError(MESA_IN_USE_MESSAGE);
          return;
        }
      }
    }

    setSelectedMesa(normalizedMesa);
    setModalOpenIntent(true);
    setShowOrderDetails(true);
    ensureCatalogWarmup().catch(() => {});

    if (normalizedMesa.status === 'occupied' && normalizedMesa.current_order_id) {
      setMesaOpenDebugStage('open:load-existing');
      const initialOrderItems = applyPendingQuantities(
        preloadedOrderItems,
        pendingQuantityUpdatesRef.current
      );
      orderItemsRef.current = initialOrderItems;
      setOrderItems(initialOrderItems);
      loadOrderDetails(normalizedMesa, { requestId }).catch(() => {});
    } else {
      setMesaOpenDebugStage('open:create-new-order');
      orderItemsRef.current = [];
      setOrderItems([]);
      await createNewOrder(normalizedMesa);
    }
  }, [
    ensureCurrentUser,
    businessId,
    isOfflineFirstRuntime,
    acquireMesaEditLockWeb,
    createNewOrder,
    ensureCatalogWarmup,
    loadOrderDetails,
    publishMesaLockBroadcast,
    setMesaOpenDebugStage,
    setPendingQuantityUpdatesSafe,
    setSelectedMesa,
    setModalOpenIntent,
    setShowOrderDetails,
    setOrderItems,
    setError,
    orderDetailsRequestRef,
    orderItemsDirtyRef,
    orderItemsRef,
    pendingQuantityUpdatesRef,
    activeMesaBroadcastRef,
    mesaSyncClientIdRef,
    heldMesaLockRef,
    getMesaLockState
  ]);

  const updateOrderTotal = useCallback(async (orderId, itemsSnapshot = orderItems, options = {}) => {
    try {
      const normalizedOrderId = normalizeEntityId(orderId);
      if (!normalizedOrderId) return;

      const total = calculateOrderItemsTotal(itemsSnapshot);
      const hasPendingRemoteSync = Object.prototype.hasOwnProperty.call(
        pendingRemoteOrderTotalsRef.current,
        normalizedOrderId
      );
      const previousTotal = Number(lastSyncedOrderTotalsRef.current[normalizedOrderId]);
      const alreadySynced = Number.isFinite(previousTotal) && Math.abs(previousTotal - total) < 0.0001;
      if (alreadySynced && !hasPendingRemoteSync) return;

      const { skipMesaState = false } = options || {};

      if (!skipMesaState) {
        setMesas(prevMesas =>
          prevMesas.map(mesa =>
            normalizeEntityId(mesa?.current_order_id) === normalizedOrderId
              ? { ...mesa, orders: { ...mesa.orders, total } }
              : mesa
          )
        );
      }

      const writeQueueByOrderId = orderTotalSyncQueueRef.current;
      const previousWrite = writeQueueByOrderId[normalizedOrderId] || Promise.resolve();
      const nextWrite = previousWrite
        .catch(() => {})
        .then(async () => {
          const updateResult = await updateOrderTotalById({ orderId: normalizedOrderId, total, businessId });
          if (updateResult?.__localOnly) {
            pendingRemoteOrderTotalsRef.current[normalizedOrderId] = total;
            return;
          }
          delete pendingRemoteOrderTotalsRef.current[normalizedOrderId];
          lastSyncedOrderTotalsRef.current[normalizedOrderId] = total;
        });

      writeQueueByOrderId[normalizedOrderId] = nextWrite;
      await nextWrite;

      if (writeQueueByOrderId[normalizedOrderId] === nextWrite) {
        delete writeQueueByOrderId[normalizedOrderId];
      }
    } catch {
      // Error silencioso
    }
  }, [orderItems, businessId, setMesas, pendingRemoteOrderTotalsRef, lastSyncedOrderTotalsRef, orderTotalSyncQueueRef]);

  const flushPendingRemoteOrderTotals = useCallback(async () => {
    if (!businessId) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

    const pendingEntries = Object.entries(pendingRemoteOrderTotalsRef.current || {});
    if (pendingEntries.length === 0) return;

    for (const [orderId, totalValue] of pendingEntries) {
      const normalizedOrderId = normalizeEntityId(orderId);
      if (!normalizedOrderId) {
        delete pendingRemoteOrderTotalsRef.current[orderId];
        continue;
      }
      const normalizedTotal = toFiniteNumber(totalValue, 0);

      try {
        const writeQueueByOrderId = orderTotalSyncQueueRef.current;
        const previousWrite = writeQueueByOrderId[normalizedOrderId] || Promise.resolve();
        const nextWrite = previousWrite
          .catch(() => {})
          .then(async () => {
            const updateResult = await updateOrderTotalById({
              orderId: normalizedOrderId,
              total: normalizedTotal,
              businessId
            });
            if (updateResult?.__localOnly) return;
            delete pendingRemoteOrderTotalsRef.current[normalizedOrderId];
            lastSyncedOrderTotalsRef.current[normalizedOrderId] = normalizedTotal;
          });

        writeQueueByOrderId[normalizedOrderId] = nextWrite;
        await nextWrite;

        if (writeQueueByOrderId[normalizedOrderId] === nextWrite) {
          delete writeQueueByOrderId[normalizedOrderId];
        }
      } catch {
        // Mantener pendiente para próximo intento.
      }
    }
  }, [businessId, pendingRemoteOrderTotalsRef, lastSyncedOrderTotalsRef, orderTotalSyncQueueRef]);

  const persistPendingQuantityUpdates = useCallback(async (orderId, { refreshItems = true } = {}) => {
    const pendingEntries = Object.entries(pendingQuantityUpdatesRef.current || {});
    if (!orderId || pendingEntries.length === 0) return;

    const persistableEntries = pendingEntries.filter(([itemId, quantity]) => {
      const normalizedItemId = String(itemId || '').trim();
      const normalizedQuantity = toFiniteNumber(quantity, NaN);
      return (
        normalizedItemId
        && !normalizedItemId.startsWith('tmp-')
        && Number.isFinite(normalizedQuantity)
        && normalizedQuantity > 0
      );
    });
    if (persistableEntries.length === 0) return;

    const persistResult = await persistOrderItemQuantities(persistableEntries, { businessId, orderId });
    setPendingQuantityUpdatesSafe((prev) => {
      const next = { ...(prev || {}) };
      persistableEntries.forEach(([itemId]) => {
        delete next[itemId];
      });
      return next;
    });
    if (persistResult?.__localOnly) {
      return;
    }

    if (!refreshItems) return;

    const freshItems = await getOrderItemsByOrderId({
      orderId,
      selectSql: ORDER_ITEMS_SELECT
    });

    if (!freshItems?.length) return;

    setOrderItems((prevItems) =>
      mergeOrderItemsPreservingPosition(
        prevItems,
        applyPendingQuantities(freshItems, pendingQuantityUpdatesRef.current)
      )
    );
  }, [setPendingQuantityUpdatesSafe, businessId, pendingQuantityUpdatesRef, setOrderItems]);

  const releaseEmptyOrderAndCloseModal = useCallback((mesaSnapshot) => {
    const normalizedTableId = normalizeEntityId(mesaSnapshot?.id);
    const normalizedOrderId = normalizeEntityId(mesaSnapshot?.current_order_id);
    if (normalizedOrderId) {
      delete pendingRemoteOrderTotalsRef.current[normalizedOrderId];
      delete lastSyncedOrderTotalsRef.current[normalizedOrderId];
    }

    if (normalizedTableId) {
      setMesas((prevMesas) => prevMesas.map((mesa) => (
        normalizeEntityId(mesa?.id) === normalizedTableId
          ? normalizeTableRecord({
            ...mesa,
            status: 'available',
            current_order_id: null,
            orders: null
          })
          : mesa
      )));
    }

    clearClosedMesaCache({
      tableId: normalizedTableId || null,
      orderId: normalizedOrderId || null
    }).catch(() => {});

    closeModalImmediate(() => {
      orderItemsDirtyRef.current = false;
      setShowOrderDetails(false);
      setModalOpenIntent(false);
      setSelectedMesa(null);
      orderItemsRef.current = [];
      setOrderItems([]);
      setPendingQuantityUpdatesSafe({});
      setSearchProduct('');
    }, async () => {
      if (!normalizedOrderId || !normalizedTableId) return;
      try {
        const releaseResult = await deleteOrderAndReleaseTable({
          orderId: normalizedOrderId,
          tableId: normalizedTableId,
          businessId,
          userId: currentUser?.id || null
        });
        if (!releaseResult?.__localOnly) {
          await loadMesas();
        }
      } catch {
        try { await loadMesas(); } catch { /* no-op */ }
      }
    });
  }, [businessId, clearClosedMesaCache, currentUser?.id, loadMesas, setPendingQuantityUpdatesSafe, setMesas, setShowOrderDetails, setModalOpenIntent, setSelectedMesa, setOrderItems, setSearchProduct, pendingRemoteOrderTotalsRef, lastSyncedOrderTotalsRef, orderItemsDirtyRef, orderItemsRef]);

  const removeItem = useCallback(async (itemId) => {
    if (pendingOrderItemOpsRef.current > 0) {
      setError('Espera un momento. Estamos sincronizando los cambios de la orden.');
      return;
    }

    const currentOrderId = String(selectedMesa?.current_order_id || '');
    const isLocalOnlyOrder = (
      String(selectedMesa?.orders?.__localOnly || '').toLowerCase() === 'true'
      || currentOrderId.startsWith('offline-order-')
    );
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
      updateOrderTotal(selectedMesa?.current_order_id, nextOrderItems, { skipMesaState: true }).catch(() => {});
      return;
    }

    markOrderItemOpStarted();
    try {
      await deleteOrderItemById(itemId, {
        businessId,
        orderId: selectedMesa?.current_order_id || null
      });

      const currentOrderItems = Array.isArray(orderItemsRef.current) ? orderItemsRef.current : [];
      const nextOrderItems = currentOrderItems.filter(item => item.id !== itemId);
      orderItemsDirtyRef.current = true;
      orderItemsRef.current = nextOrderItems;
      setOrderItems(nextOrderItems);
      setPendingQuantityUpdatesSafe(prev => {
        const next = { ...prev };
        delete next[itemId];
        return next;
      });
      delete optimisticTempItemQuantitiesRef.current[itemId];

      updateOrderTotal(selectedMesa.current_order_id, nextOrderItems, { skipMesaState: true }).catch(() => {});
    } catch (_error) {
      setError('No se pudo eliminar el producto. Por favor, intenta de nuevo.');
      try {
        const freshItems = await getOrderItemsByOrderId({
          orderId: selectedMesa.current_order_id,
          selectSql: ORDER_ITEMS_SELECT
        });
        if (freshItems?.length) {
          setOrderItems((prevItems) =>
            mergeOrderItemsPreservingPosition(
              prevItems,
              applyPendingQuantities(freshItems, pendingQuantityUpdatesRef.current)
            )
          );
        }
      } catch {
        // no-op
      }
    } finally {
      markOrderItemOpFinished();
    }
  }, [selectedMesa, isOfflineFirstRuntime, updateOrderTotal, setPendingQuantityUpdatesSafe, businessId, markOrderItemOpStarted, markOrderItemOpFinished, pendingOrderItemOpsRef, optimisticTempItemQuantitiesRef, setError, setOrderItems, orderItemsRef, orderItemsDirtyRef, pendingQuantityUpdatesRef]);

  const handleRefreshOrder = useCallback(async () => {
    if (!selectedMesa) return;
    
    try {
      const hasSettledPendingOps = await waitForPendingOrderItemOps();
      if (!hasSettledPendingOps) {
        setError('Espera un momento. Aun estamos aplicando el ultimo cambio en la orden.');
        return;
      }

      const mesaSnapshot = { ...selectedMesa };
      const orderItemsSnapshot = Array.isArray(orderItemsRef.current) ? [...orderItemsRef.current] : [];
      const mesaItemsSnapshot = Array.isArray(mesaSnapshot?.orders?.order_items)
        ? mesaSnapshot.orders.order_items
        : [];
      const hasLocalEdits = orderItemsDirtyRef.current;
      let effectiveOrderItemsSnapshot = hasLocalEdits
        ? orderItemsSnapshot
        : (orderItemsSnapshot.length > 0 ? orderItemsSnapshot : mesaItemsSnapshot);

      if (effectiveOrderItemsSnapshot.length === 0 && mesaSnapshot?.current_order_id) {
        try {
          let latestOrder = null;
          try {
            latestOrder = await getOrderForRealtimeById({
              orderId: mesaSnapshot.current_order_id,
              selectSql: ORDER_ITEMS_SELECT
            });
          } catch {
            latestOrder = await getOrderWithItemsById({
              orderId: mesaSnapshot.current_order_id,
              selectSql: ORDER_ITEMS_SELECT
            });
          }

          const latestOrderItems = applyPendingQuantities(
            Array.isArray(latestOrder?.order_items) ? latestOrder.order_items : [],
            pendingQuantityUpdatesRef.current
          );
          if (latestOrderItems.length > 0) {
            effectiveOrderItemsSnapshot = latestOrderItems;
          }
        } catch {
          // no-op
        }
      }

      const hasSavedItems = effectiveOrderItemsSnapshot.length > 0;
      const localOrderTotal = calculateOrderItemsTotal(effectiveOrderItemsSnapshot);
      const normalizedSnapshotOrderId = normalizeEntityId(mesaSnapshot?.current_order_id);
      const snapshotOrderTotal = toFiniteNumber(mesaSnapshot?.orders?.total, 0);
      const pendingSnapshotTotal = normalizedSnapshotOrderId
        ? toFiniteNumber(pendingRemoteOrderTotalsRef.current?.[normalizedSnapshotOrderId], 0)
        : 0;
      const hasOrderTotalSignal = !hasLocalEdits && (
        snapshotOrderTotal > 0.0001 || pendingSnapshotTotal > 0.0001
      );

      if (!hasSavedItems) {
        if (hasOrderTotalSignal) {
          setError('Detectamos una orden en sincronizacion. No se libero la mesa automaticamente.');
          orderItemsDirtyRef.current = false;
          setShowOrderDetails(false);
          setModalOpenIntent(false);
          setSelectedMesa(null);
          orderItemsRef.current = [];
          setOrderItems([]);
          setSearchProduct('');
          return;
        }
        releaseEmptyOrderAndCloseModal(mesaSnapshot);
        return;
      }
      
      setMesas(prevMesas => 
        prevMesas.map(m => 
          m.id === mesaSnapshot.id 
            ? {
              ...m,
              status: 'occupied',
              current_order_id: mesaSnapshot.current_order_id,
              orders: {
                ...(m.orders || {}),
                id: mesaSnapshot.current_order_id,
                total: localOrderTotal,
                local_units: getTotalProductUnits(effectiveOrderItemsSnapshot),
                order_items: effectiveOrderItemsSnapshot
              }
            }
            : m
        )
      );
      
      orderItemsDirtyRef.current = false;
      setShowOrderDetails(false);
      setModalOpenIntent(false);
      setSelectedMesa(null);
      orderItemsRef.current = [];
      setOrderItems([]);
      setSearchProduct('');
      
      setSuccessTitle('Mesa Actualizada');
      setSuccessDetails([
        { label: 'Mesa', value: `#${mesaSnapshot.table_number}` },
        { label: 'Estado', value: 'Actualizada' }
      ]);
      setAlertType('update');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);

      (async () => {
        try {
          await persistPendingQuantityUpdates(mesaSnapshot.current_order_id, { refreshItems: false });
          await updateOrderTotal(mesaSnapshot.current_order_id, effectiveOrderItemsSnapshot, { skipMesaState: true });

          if (typeof navigator === 'undefined' || navigator.onLine) {
            loadMesas().catch(() => {});
          }
        } catch {
          try { await loadMesas(); } catch { /* no-op */ }
        }
      })();
    } catch {
      setError('No se pudo guardar la orden');
    }
  }, [
    selectedMesa,
    updateOrderTotal,
    persistPendingQuantityUpdates,
    loadMesas,
    releaseEmptyOrderAndCloseModal,
    waitForPendingOrderItemOps,
    setMesas,
    setShowOrderDetails,
    setModalOpenIntent,
    setSelectedMesa,
    setOrderItems,
    setSearchProduct,
    setSuccessTitle,
    setSuccessDetails,
    setAlertType,
    setSuccess,
    setError,
    orderItemsRef,
    orderItemsDirtyRef,
    pendingQuantityUpdatesRef,
    pendingRemoteOrderTotalsRef
  ]);

  const addCatalogItemToOrder = useCallback(async (catalogItem) => {
    try {
      if (!selectedMesa?.current_order_id) return;

      const currentOrderId = String(selectedMesa?.current_order_id || '');
      const isLocalOnlyOrder = (
        String(selectedMesa?.orders?.__localOnly || '').toLowerCase() === 'true'
        || currentOrderId.startsWith('offline-order-')
      );
      const shouldUseLocalItemFlow = isLocalOnlyOrder || isOfflineFirstRuntime || isOfflineMode();
      const itemDebugTag = (stage, err = null) => {
        const msg = String(err?.message || err || '').replace(/\s+/g, ' ').slice(0, 80);
        return `MESA_ITEM_DBG|stage=${stage}|order=${currentOrderId || 'na'}|localFlow=${shouldUseLocalItemFlow ? '1' : '0'}|msg=${msg || 'na'}`;
      };

      const itemType = catalogItem?.item_type || ORDER_ITEM_TYPE.PRODUCT;
      const isCombo = itemType === ORDER_ITEM_TYPE.COMBO;
      const itemId = isCombo
        ? (catalogItem?.combo_id || catalogItem?.id)
        : (catalogItem?.product_id || catalogItem?.id);
      const itemName = catalogItem?.name || catalogItem?.nombre || 'Item';

      if (!itemId) {
        setError('No se pudo identificar el item seleccionado.');
        return;
      }

      const precio = Number(catalogItem?.sale_price ?? catalogItem?.price ?? 0);
      if (!Number.isFinite(precio) || precio < 0) {
        setError(`El item "${itemName}" no tiene un precio válido`);
        return;
      }

      const qty = parseInt(quantityToAdd);
      if (isNaN(qty) || qty <= 0) {
        setError('La cantidad debe ser mayor a 0');
        return;
      }

      if (
        !isCombo
        && catalogItem.manage_stock !== false
        && typeof catalogItem.stock === 'number'
        && qty > catalogItem.stock
      ) {
        setError(`Stock insuficiente para ${itemName}. Disponibles: ${catalogItem.stock}. Considera crear una compra.`);
      }

      const currentOrderItems = Array.isArray(orderItemsRef.current) ? orderItemsRef.current : [];
      let nextOrderItems = currentOrderItems;
      let orderItemsChanged = false;

      const existingItem = currentOrderItems.find((item) => (
        isCombo ? item.combo_id === itemId : item.product_id === itemId
      ));

      if (existingItem) {
        const newQuantity = toFiniteNumber(existingItem.quantity, 0) + qty;
        const nextQuantity = Number(newQuantity || 0);
        const isOptimisticExistingItem = String(existingItem?.id || '').startsWith('tmp-');
        nextOrderItems = currentOrderItems.map((item) => (
          item.id === existingItem.id
            ? {
              ...item,
              quantity: nextQuantity,
              subtotal: nextQuantity * Number(item.price || 0)
            }
            : item
        ));
        orderItemsDirtyRef.current = true;
        orderItemsRef.current = nextOrderItems;
        setOrderItems(nextOrderItems);
        orderItemsChanged = true;
        if (isOptimisticExistingItem || shouldUseLocalItemFlow) {
          optimisticTempItemQuantitiesRef.current[existingItem.id] = nextQuantity;
          setPendingQuantityUpdatesSafe((prev) => ({
            ...(prev || {}),
            [existingItem.id]: nextQuantity
          }));
          if (shouldUseLocalItemFlow) {
            setPendingQuantityUpdatesSafe((prev) => {
              const next = { ...(prev || {}) };
              delete next[existingItem.id];
              return next;
            });
          }
        } else {
          markOrderItemOpStarted();
          enqueueOrderItemWrite(existingItem.id, () => (
            updateOrderItemQuantityById({
              itemId: existingItem.id,
              quantity: nextQuantity,
              businessId,
              orderId: selectedMesa.current_order_id
            })
          )).catch(async () => {
            setError('No se pudo agregar el item. Por favor, intenta de nuevo.');
            try {
              const freshItems = await getOrderItemsByOrderId({
                orderId: selectedMesa.current_order_id,
                selectSql: ORDER_ITEMS_SELECT
              });
              if (Array.isArray(freshItems)) {
                setOrderItems((prevItems) =>
                  mergeOrderItemsPreservingPosition(
                    prevItems,
                    applyPendingQuantities(freshItems, pendingQuantityUpdatesRef.current)
                  )
                );
              }
            } catch {
              // no-op
            }
          }).finally(() => {
            markOrderItemOpFinished();
          });
          setPendingQuantityUpdatesSafe(prev => {
            const next = { ...prev };
            delete next[existingItem.id];
            return next;
          });
        }
      } else {
        const optimisticQuantity = Number(qty || 0);
        const optimisticPrice = Number(parseFloat(precio) || 0);
        const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const optimisticItem = {
          id: tempId,
          order_id: selectedMesa.current_order_id,
          product_id: isCombo ? null : itemId,
          combo_id: isCombo ? itemId : null,
          quantity: optimisticQuantity,
          price: optimisticPrice,
          subtotal: optimisticQuantity * optimisticPrice,
          products: isCombo ? null : {
            id: itemId,
            name: itemName,
            code: catalogItem.code
          },
          combos: isCombo ? {
            id: itemId,
            nombre: itemName
          } : null
        };
        if (shouldUseLocalItemFlow) {
          const localItemId = `offline-item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const localItem = {
            ...optimisticItem,
            id: localItemId,
            __localOnly: true,
            pending_sync: true
          };
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
            row: {
              order_id: selectedMesa.current_order_id,
              product_id: isCombo ? null : itemId,
              combo_id: isCombo ? itemId : null,
              quantity: qty,
              price: parseFloat(precio)
            },
            selectSql: 'id',
            businessId
          }).then((newItem) => {
            if (!newItem?.id) {
              delete optimisticTempItemQuantitiesRef.current[tempId];
              return;
            }

            const latestTempItem = (Array.isArray(orderItemsRef.current) ? orderItemsRef.current : [])
              .find((item) => item.id === tempId);
            const trackedTempQuantity = toFiniteNumber(
              optimisticTempItemQuantitiesRef.current?.[tempId],
              NaN
            );
            const resolvedQuantity = (
              Number.isFinite(trackedTempQuantity) && trackedTempQuantity > 0
            )
              ? trackedTempQuantity
              : toFiniteNumber(latestTempItem?.quantity, optimisticQuantity);
            const resolvedPrice = toFiniteNumber(latestTempItem?.price, optimisticPrice);
            const pendingTempQuantity = toFiniteNumber(
              pendingQuantityUpdatesRef.current?.[tempId],
              NaN
            );
            const quantityToPersist = (
              Number.isFinite(pendingTempQuantity) && pendingTempQuantity > 0
            ) ? pendingTempQuantity : resolvedQuantity;
            const shouldPersistResolvedQuantity = Math.abs(quantityToPersist - optimisticQuantity) > 0.0001;

            setOrderItems((prevItems) => prevItems.map((item) => (
              item.id === tempId
                ? {
                  ...item,
                  id: newItem.id,
                  quantity: resolvedQuantity,
                  subtotal: resolvedQuantity * resolvedPrice
                }
                : item
            )));

            setPendingQuantityUpdatesSafe((prev) => {
              const next = { ...(prev || {}) };
              delete next[tempId];
              if (shouldPersistResolvedQuantity) {
                next[newItem.id] = quantityToPersist;
              } else {
                delete next[newItem.id];
              }
              return next;
            });
            delete optimisticTempItemQuantitiesRef.current[tempId];

            if (!shouldPersistResolvedQuantity) return;

            markOrderItemOpStarted();
            enqueueOrderItemWrite(newItem.id, () => (
              updateOrderItemQuantityById({
                itemId: newItem.id,
                quantity: quantityToPersist,
                businessId,
                orderId: selectedMesa.current_order_id
              })
            )).then(() => {
              setPendingQuantityUpdatesSafe((prev) => {
                const next = { ...(prev || {}) };
                delete next[newItem.id];
                return next;
              });
            }).catch(async () => {
              setError(`No se pudo sincronizar la cantidad del item. Por favor, intenta guardar la orden. [${itemDebugTag('quantity-sync-failed')}]`);
              try {
                const freshItems = await getOrderItemsByOrderId({
                  orderId: selectedMesa.current_order_id,
                  selectSql: ORDER_ITEMS_SELECT
                });
                if (Array.isArray(freshItems)) {
                  setOrderItems((prevItems) =>
                    mergeOrderItemsPreservingPosition(
                      prevItems,
                      applyPendingQuantities(freshItems, pendingQuantityUpdatesRef.current)
                    )
                  );
                }
              } catch {
                // no-op
              }
            }).finally(() => {
              markOrderItemOpFinished();
            });
          }).catch(async () => {
            setError(`No se pudo agregar el item. Por favor, intenta de nuevo. [${itemDebugTag('insert-catch')}]`);
            delete optimisticTempItemQuantitiesRef.current[tempId];
            setOrderItems((prevItems) => prevItems.filter((item) => item.id !== tempId));
            setPendingQuantityUpdatesSafe((prev) => {
              const next = { ...(prev || {}) };
              delete next[tempId];
              return next;
            });
            try {
              const freshItems = await getOrderItemsByOrderId({
                orderId: selectedMesa.current_order_id,
                selectSql: ORDER_ITEMS_SELECT
              });
              if (Array.isArray(freshItems)) {
                setOrderItems((prevItems) =>
                  mergeOrderItemsPreservingPosition(
                    prevItems,
                    applyPendingQuantities(freshItems, pendingQuantityUpdatesRef.current)
                  )
                );
              }
            } catch {
              // no-op
            }
          }).finally(() => {
            markOrderItemOpFinished();
          });
        }
      }

      if (orderItemsChanged) {
        updateOrderTotal(selectedMesa.current_order_id, nextOrderItems, { skipMesaState: true }).catch(() => {});
      }
      setSearchProduct('');
      setQuantityToAdd(1);
    } catch (error) {
      setError(`No se pudo agregar el item. Por favor, intenta de nuevo. [MESA_ITEM_DBG|stage=outer-catch|msg=${String(error?.message || error || 'unknown').replace(/\s+/g, ' ').slice(0, 80)}]`);
      try {
        const freshItems = await getOrderItemsByOrderId({
          orderId: selectedMesa.current_order_id,
          selectSql: ORDER_ITEMS_SELECT
        });
        if (freshItems?.length) {
          setOrderItems((prevItems) =>
            mergeOrderItemsPreservingPosition(
              prevItems,
              applyPendingQuantities(freshItems, pendingQuantityUpdatesRef.current)
            )
          );
        }
      } catch {
        // no-op
      }
    }
  }, [selectedMesa, quantityToAdd, updateOrderTotal, setPendingQuantityUpdatesSafe, businessId, isOfflineFirstRuntime, markOrderItemOpStarted, markOrderItemOpFinished, enqueueOrderItemWrite, setError, setOrderItems, setSearchProduct, setQuantityToAdd, pendingQuantityUpdatesRef, optimisticTempItemQuantitiesRef, pendingOrderItemOpsRef, orderItemsRef, orderItemsDirtyRef]);

  const updateItemQuantity = useCallback(async (itemId, newQuantity) => {
    try {
      if (pendingOrderItemOpsRef.current > 0) {
        setError('Espera un momento. Estamos sincronizando los cambios de la orden.');
        return;
      }

      const normalizedQuantity = toFiniteNumber(newQuantity, NaN);
      if (!Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) {
        if (String(itemId || '').startsWith('tmp-')) {
          delete optimisticTempItemQuantitiesRef.current[itemId];
        }
        await removeItem(itemId);
        return;
      }

      const currentOrderItems = Array.isArray(orderItemsRef.current) ? orderItemsRef.current : [];
      const nextOrderItems = currentOrderItems.map(item => {
          if (item.id === itemId) {
            const normalizedPrice = toFiniteNumber(item.price, 0);
            const newSubtotal = normalizedQuantity * normalizedPrice;
            return { ...item, quantity: normalizedQuantity, subtotal: newSubtotal };
          }
          return item;
        });
      orderItemsRef.current = nextOrderItems;
      setOrderItems(nextOrderItems);
      orderItemsDirtyRef.current = true;

      setPendingQuantityUpdatesSafe(prev => ({ ...prev, [itemId]: normalizedQuantity }));
      if (String(itemId || '').startsWith('tmp-')) {
        optimisticTempItemQuantitiesRef.current[itemId] = normalizedQuantity;
      }
    } catch {
      setError('No se pudo actualizar la cantidad. Por favor, intenta de nuevo.');
      try {
        const currentOrderId = String(selectedMesa?.current_order_id || '');
        const isLocalOnlyOrder = (
          String(selectedMesa?.orders?.__localOnly || '').toLowerCase() === 'true'
          || currentOrderId.startsWith('offline-order-')
        );
        const shouldSkipRemoteRefresh = isLocalOnlyOrder || isOfflineFirstRuntime || isOfflineMode();

        if (!shouldSkipRemoteRefresh) {
          const freshItems = await getOrderItemsByOrderId({
            orderId: selectedMesa.current_order_id,
            selectSql: ORDER_ITEMS_SELECT
          });
          if (freshItems?.length) {
            setOrderItems((prevItems) =>
              mergeOrderItemsPreservingPosition(
                prevItems,
                applyPendingQuantities(freshItems, pendingQuantityUpdatesRef.current)
              )
            );
          }
        }
      } catch {
        // no-op
      }
      setPendingQuantityUpdatesSafe({});
    }
  }, [selectedMesa, isOfflineFirstRuntime, removeItem, setPendingQuantityUpdatesSafe, pendingOrderItemOpsRef, optimisticTempItemQuantitiesRef, setError, setOrderItems, pendingQuantityUpdatesRef, orderItemsRef, orderItemsDirtyRef]);

  const handleCloseModal = useCallback(() => {
    const mesaSnapshot = selectedMesa ? { ...selectedMesa } : null;
    const itemsSnapshot = Array.isArray(orderItemsRef.current) ? [...orderItemsRef.current] : [];
    const mesaItemsSnapshot = Array.isArray(mesaSnapshot?.orders?.order_items)
      ? mesaSnapshot.orders.order_items
      : [];
    const hasLocalEdits = orderItemsDirtyRef.current;
    const effectiveItemsSnapshot = hasLocalEdits
      ? itemsSnapshot
      : (itemsSnapshot.length > 0 ? itemsSnapshot : mesaItemsSnapshot);
    const pendingEntriesSnapshot = Object.entries(pendingQuantityUpdatesRef.current || {});
    const normalizedSnapshotOrderId = normalizeEntityId(mesaSnapshot?.current_order_id);
    const snapshotOrderTotal = toFiniteNumber(mesaSnapshot?.orders?.total, 0);
    const pendingSnapshotTotal = normalizedSnapshotOrderId
      ? toFiniteNumber(pendingRemoteOrderTotalsRef.current?.[normalizedSnapshotOrderId], 0)
      : 0;
    const hasOrderTotalSignal = snapshotOrderTotal > 0.0001 || pendingSnapshotTotal > 0.0001;

    if (effectiveItemsSnapshot.length === 0) {
      if (hasOrderTotalSignal) {
        setError('Detectamos una orden en sincronizacion. No se libero la mesa automaticamente.');
        closeModalImmediate(() => {
          orderItemsDirtyRef.current = false;
          setShowOrderDetails(false);
          setModalOpenIntent(false);
          setSelectedMesa(null);
          orderItemsRef.current = [];
          setOrderItems([]);
          setPendingQuantityUpdatesSafe({});
        });
        return;
      }
      releaseEmptyOrderAndCloseModal(mesaSnapshot);
      return;
    }

    const backgroundWork = async () => {
      if (!mesaSnapshot) return;
      try {
        if (!mesaSnapshot.current_order_id) return;

        if (pendingEntriesSnapshot.length > 0) {
          await persistOrderItemQuantities(pendingEntriesSnapshot, {
            businessId,
            orderId: mesaSnapshot.current_order_id
          });
        }

        await updateOrderTotal(mesaSnapshot.current_order_id, effectiveItemsSnapshot, { skipMesaState: true });
      } catch {
        try { await loadMesas(); } catch { /* no-op */ }
      }
    };

    if (mesaSnapshot && effectiveItemsSnapshot.length > 0) {
      const localOrderTotal = calculateOrderItemsTotal(effectiveItemsSnapshot);
      const localUnits = getTotalProductUnits(effectiveItemsSnapshot);

      setMesas(prevMesas =>
        prevMesas.map(m =>
          m.id === mesaSnapshot.id
            ? {
              ...m,
              status: 'occupied',
              current_order_id: mesaSnapshot.current_order_id,
              orders: {
                ...(m.orders || {}),
                id: mesaSnapshot.current_order_id,
                total: localOrderTotal,
                local_units: localUnits,
                order_items: effectiveItemsSnapshot
              }
            }
            : m
        )
      );

      setSuccessTitle('Mesa Actualizada');
      setSuccessDetails([
        { label: 'Mesa', value: `#${mesaSnapshot.table_number}` },
        { label: 'Estado', value: 'Actualizada' }
      ]);
      setAlertType('update');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    }

    closeModalImmediate(() => {
      orderItemsDirtyRef.current = false;
      setShowOrderDetails(false);
      setModalOpenIntent(false);
      setSelectedMesa(null);
      orderItemsRef.current = [];
      setOrderItems([]);
      setPendingQuantityUpdatesSafe({});
    }, backgroundWork);
  }, [
    selectedMesa,
    loadMesas,
    updateOrderTotal,
    releaseEmptyOrderAndCloseModal,
    setMesas,
    setShowOrderDetails,
    setModalOpenIntent,
    setSelectedMesa,
    setOrderItems,
    setPendingQuantityUpdatesSafe,
    setSuccessTitle,
    setSuccessDetails,
    setAlertType,
    setSuccess,
    setError,
    orderItemsRef,
    orderItemsDirtyRef,
    pendingQuantityUpdatesRef,
    pendingRemoteOrderTotalsRef,
    businessId,
    persistPendingQuantityUpdates
  ]);

  return {
    handleCreateTable,
    loadOrderDetails,
    handleOpenTable,
    addCatalogItemToOrder,
    updateItemQuantity,
    removeItem,
    handleRefreshOrder,
    handleCloseModal,
    updateOrderTotal,
    flushPendingRemoteOrderTotals,
    createNewOrder,
    releaseEmptyOrderAndCloseModal,
    loadMesas
  };
}
