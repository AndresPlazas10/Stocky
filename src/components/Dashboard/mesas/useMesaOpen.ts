import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  createOrderAndOccupyTable,
} from '../../../data/commands/ordersCommands';
import {
  getOrderForRealtimeById,
  getOrderWithItemsById,
  getTablesWithCurrentOrderByBusiness
} from '../../../data/queries/ordersQueries';
import {
  getAuthenticatedUser as getAuthenticatedUserFromOrders
} from '../../../data/queries/authQueries';
import {
  getMesaInUseMessage,
  ORDER_ITEMS_SELECT,
  normalizeEntityId,
  applyPendingQuantities,
  mergeOrderItemsPreservingPosition,
  sanitizeMesaOrderAssociation,
  buildDiagnosticAlertMessage,
} from './mesaHelpers';
import { isConnectivityError } from '../../../utils/connectivity';
import { normalizeTableRecord } from '../../../utils/tableStatus';
import {
  isOfflineMode,
  isOfflinePersistenceEnabled,
} from '../../../utils/offlineSnapshot.js';
import { logger } from '@/utils/logger';
import type { MesaRecord, MesaLockState, MesaBroadcastState, MesaLockResult } from '@/types/mesas';

type SetState<T> = React.Dispatch<React.SetStateAction<T>>;

interface UseMesaOpenParams {
  businessId: string;
  currentUser: { id: string } | null;
  getCurrentUser: () => Promise<{ id: string } | null>;
  setMesas: SetState<any[]>;
  setSelectedMesa: SetState<any>;
  orderItemsDirtyRef: React.MutableRefObject<boolean>;
  orderItemsRef: React.MutableRefObject<any[]>;
  setOrderItems: SetState<any[]>;
  setPendingQuantityUpdatesSafe: SetState<any>;
  setModalOpenIntent: SetState<boolean>;
  setShowOrderDetails: SetState<boolean>;
  isOfflineFirstRuntime: boolean;
  setMesaOpenDebugStage: (stage: string) => void;
  buildMesaOpenDebugTag: (error: unknown, mesa: any) => string;
  isOpeningTableRef: React.MutableRefObject<boolean>;
  orderDetailsRequestRef: React.MutableRefObject<number>;
  pendingQuantityUpdatesRef: React.MutableRefObject<Record<string, number>>;
  getMesaLockState: (tableId: string) => MesaLockState | null;
  activeMesaBroadcastRef: React.MutableRefObject<MesaBroadcastState | null>;
  publishMesaLockBroadcast: (params: { tableId: string; locked: boolean; mode: string; lockToken: string | null; lockOwnerName?: string | null }) => void;
  mesaSyncClientIdRef: React.MutableRefObject<string>;
  acquireMesaEditLockWeb: (params: { targetBusinessId: string; tableId: string; lockToken: string; lockOwnerName?: string | null }) => Promise<MesaLockResult>;
  resolveWebUserName: () => Promise<string>;
  heldMesaLockRef: React.MutableRefObject<{ businessId: string; tableId: string; lockToken: string } | null>;
  ensureCatalogWarmup: () => Promise<void>;
  showError: (title: string, message?: string) => void;
  loadMesas: () => Promise<void>;
}

export function useMesaOpen({
  businessId,
  currentUser,
  getCurrentUser,
  setMesas,
  setSelectedMesa,
  orderItemsDirtyRef,
  orderItemsRef,
  setOrderItems,
  setPendingQuantityUpdatesSafe,
  setModalOpenIntent,
  setShowOrderDetails,
  isOfflineFirstRuntime,
  setMesaOpenDebugStage,
  buildMesaOpenDebugTag,
  isOpeningTableRef,
  orderDetailsRequestRef,
  pendingQuantityUpdatesRef,
  getMesaLockState,
  activeMesaBroadcastRef,
  publishMesaLockBroadcast,
  mesaSyncClientIdRef,
  acquireMesaEditLockWeb,
  resolveWebUserName,
  heldMesaLockRef,
  ensureCatalogWarmup,
  showError,
  loadMesas,
}: UseMesaOpenParams) {
  const { t } = useTranslation(['mesas']);

  const ensureCurrentUser = useCallback(async () => {
    const user = await getCurrentUser();
    return user?.id || currentUser?.id || null;
  }, [getCurrentUser, currentUser?.id]);

  const createNewOrder = useCallback(async (mesa: any, options?: { resolvedUserId?: string | null }) => {
    const openLocalOfflineOrder = () => {
      const localOrderId = `offline-order-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const localNow = new Date().toISOString();
      const localOrder: any = {
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
      setMesaOpenDebugStage('create:start');

      if (isOfflineFirstRuntime) {
        setMesaOpenDebugStage('create:offline-runtime-local');
        openLocalOfflineOrder();
        return;
      }

      let effectiveUserId = options?.resolvedUserId || currentUser?.id || null;
      if (!effectiveUserId) {
        try {
          const authUser = await getAuthenticatedUserFromOrders();
          effectiveUserId = (authUser as { id?: string })?.id || null;
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
      setTimeout(() => { isOpeningTableRef.current = false; }, 50);
    } catch (error: unknown) {
      setTimeout(() => { isOpeningTableRef.current = false; }, 50);
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
      } catch (err: unknown) {
        logger.warn('mesas:order_operations:recover_order_state failed', err);
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
      showError('Error',`${t('mesas:errors.openTableFailed')}: ${(error as Error)?.message || t('mesas:defaults.unknownError')} [${buildMesaOpenDebugTag(error, mesa)}]`);
    }
  }, [buildMesaOpenDebugTag, businessId, currentUser, isOfflineFirstRuntime, loadMesas, setMesaOpenDebugStage, setPendingQuantityUpdatesSafe, setMesas, setSelectedMesa, setOrderItems, setShowOrderDetails, setModalOpenIntent, showError, orderItemsDirtyRef, orderItemsRef, pendingQuantityUpdatesRef, t]);

  const loadOrderDetails = useCallback(async (mesa: any, { requestId = null }: { requestId?: number | null } = {}) => {
    const normalizedRequestId = Number(requestId);
    const hasRequestId = Number.isFinite(normalizedRequestId) && normalizedRequestId > 0;
    const isStaleRequest = () => (
      hasRequestId && orderDetailsRequestRef.current !== normalizedRequestId
    );
    const openWithMesaSnapshot = (mesaSnapshot: any) => {
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
    } catch (error: unknown) {
      if (isStaleRequest()) return;
      const hasMesaSnapshotContext = Boolean(
        normalizeEntityId(mesa?.current_order_id)
        || (Array.isArray(mesa?.orders?.order_items) && mesa.orders.order_items.length >= 0)
      );

      if (hasMesaSnapshotContext) {
        openWithMesaSnapshot(mesa);
        return;
      }

      showError('Error',buildDiagnosticAlertMessage(error, t));
    }
  }, [setPendingQuantityUpdatesSafe, setSelectedMesa, setOrderItems, setShowOrderDetails, setModalOpenIntent, showError, orderDetailsRequestRef, orderItemsDirtyRef, pendingQuantityUpdatesRef, t]);

  const handleOpenTable = useCallback(async (mesa: any) => {
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
        showError('Error', getMesaInUseMessage(t, lockState?.lockOwnerName));
        return;
      }
    }

    const resolvedUserId = await ensureCurrentUser();
    if (!resolvedUserId) {
      setMesaOpenDebugStage('open:user-missing');
      showError('Error', t('mesas:errors.sessionFailed'));
      return;
    }

    if (!isOfflineFirstRuntime && normalizedMesa?.id && businessId) {
      setMesaOpenDebugStage('open:lock-acquire');
      const nextMesaId = normalizeEntityId(normalizedMesa.id);
      if (nextMesaId) {
        const resolvedLockOwnerName = await resolveWebUserName();
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
          lockToken,
          lockOwnerName: resolvedLockOwnerName,
        });
        activeMesaBroadcastRef.current = { tableId: nextMesaId, lockToken, locked: true, mode: 'optimistic' };
        const result = await acquireMesaEditLockWeb({
          targetBusinessId: businessId,
          tableId: nextMesaId,
          lockToken,
          lockOwnerName: resolvedLockOwnerName,
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
            lockToken: result.lockToken || lockToken,
            lockOwnerName: result.lockOwnerName || resolvedLockOwnerName,
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
          showError('Error', getMesaInUseMessage(t, result?.lockOwnerName));
          return;
        }
      }
    }

    isOpeningTableRef.current = true;
    setSelectedMesa(normalizedMesa);
    setModalOpenIntent(true);
    setShowOrderDetails(true);
    ensureCatalogWarmup().catch((err: unknown) => { logger.warn('mesas:order_operations:ensure_catalog_warmup failed', err); });

    if (normalizedMesa.status === 'occupied' && normalizedMesa.current_order_id) {
      setMesaOpenDebugStage('open:load-existing');
      const initialOrderItems = applyPendingQuantities(
        preloadedOrderItems,
        pendingQuantityUpdatesRef.current
      );
      orderItemsRef.current = initialOrderItems;
      setOrderItems(initialOrderItems);
      loadOrderDetails(normalizedMesa, { requestId }).catch((err: unknown) => { logger.warn('mesas:order_operations:load_order_details failed', err); });
    } else {
      setMesaOpenDebugStage('open:create-new-order');
      orderItemsRef.current = [];
      setOrderItems([]);
      await createNewOrder(normalizedMesa, { resolvedUserId });
    }
  }, [
    ensureCurrentUser,
    businessId,
    isOfflineFirstRuntime,
    acquireMesaEditLockWeb,
    resolveWebUserName,
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
    showError,
    orderDetailsRequestRef,
    orderItemsDirtyRef,
    orderItemsRef,
    pendingQuantityUpdatesRef,
    activeMesaBroadcastRef,
    mesaSyncClientIdRef,
    heldMesaLockRef,
    getMesaLockState,
    t
  ]);

  return {
    loadOrderDetails,
    handleOpenTable,
  };
}
