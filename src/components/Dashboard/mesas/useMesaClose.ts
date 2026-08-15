import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  deleteOrderAndReleaseTable,
} from '../../../data/commands/ordersCommands';
import {
  getOrderForRealtimeById,
  getOrderWithItemsById,
} from '../../../data/queries/ordersQueries';
import {
  ORDER_ITEMS_SELECT,
  toFiniteNumber,
  getTotalProductUnits,
  calculateOrderItemsTotal,
  normalizeEntityId,
  applyPendingQuantities,
} from './mesaHelpers';
import { closeModalImmediate } from '../../../utils/closeModalImmediate';
import { normalizeTableRecord } from '../../../utils/tableStatus';
import { resolveErrorMessage } from '../../../utils/rpcErrorUtils';
import { logger } from '@/utils/logger';

type SetState<T> = React.Dispatch<React.SetStateAction<T>>;

// Datos dinámicos de Supabase/realtime que requieren acceso a propiedades y spread
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DynamicRow = Record<string, any>;

interface MesaSnapshot {
  id?: string;
  current_order_id?: string;
  table_number?: number;
  orders?: {
    id?: string;
    total?: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    order_items?: any[];
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
}

interface UseMesaCloseParams {
  businessId: string;
  selectedMesa: MesaSnapshot | null;
  currentUser: { id: string } | null;
  emptyReleaseInProgressRef: React.MutableRefObject<string | null>;
  pendingRemoteOrderTotalsRef: React.MutableRefObject<Record<string, number>>;
  lastSyncedOrderTotalsRef: React.MutableRefObject<Record<string, number>>;
  pendingQuantityUpdatesRef: React.MutableRefObject<Record<string, number>>;
  orderItemsRef: React.MutableRefObject<DynamicRow[]>;
  orderItemsDirtyRef: React.MutableRefObject<boolean>;
  setMesas: SetState<DynamicRow[]>;
  setShowOrderDetails: SetState<boolean>;
  setModalOpenIntent: SetState<boolean>;
  setSelectedMesa: SetState<MesaSnapshot | null>;
  setOrderItems: SetState<DynamicRow[]>;
  setSearchProduct: SetState<string>;
  setPendingQuantityUpdatesSafe: SetState<Record<string, number>>;
  showError: (title: string, message?: string) => void;
  showSuccess: (title: string, message?: string) => void;
  updateOrderTotal: (orderId: string | null | undefined, itemsSnapshot?: DynamicRow[], options?: { skipMesaState?: boolean }) => Promise<void>;
  loadMesas: () => Promise<void>;
  clearClosedMesaCache: (params?: { tableId?: string | null; orderId?: string | null }) => Promise<void>;
  persistPendingQuantityUpdates: (orderId: string, options?: { refreshItems?: boolean; items?: DynamicRow[] }) => Promise<void>;
}

export function useMesaClose({
  businessId,
  selectedMesa,
  currentUser,
  emptyReleaseInProgressRef,
  pendingRemoteOrderTotalsRef,
  lastSyncedOrderTotalsRef,
  pendingQuantityUpdatesRef,
  orderItemsRef,
  orderItemsDirtyRef,
  setMesas,
  setShowOrderDetails,
  setModalOpenIntent,
  setSelectedMesa,
  setOrderItems,
  setSearchProduct,
  setPendingQuantityUpdatesSafe,
  showError,
  showSuccess,
  updateOrderTotal,
  loadMesas,
  clearClosedMesaCache,
  persistPendingQuantityUpdates,
}: UseMesaCloseParams) {
  const { t } = useTranslation(['mesas']);

  const releaseEmptyOrderAndCloseModal = useCallback((mesaSnapshot: MesaSnapshot | null) => {
    const normalizedTableId = normalizeEntityId(mesaSnapshot?.id);
    const normalizedOrderId = normalizeEntityId(mesaSnapshot?.current_order_id);

    if (normalizedTableId) {
      emptyReleaseInProgressRef.current = normalizedTableId;
    }

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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any)
          : mesa
      )));
    }

    clearClosedMesaCache({
      tableId: normalizedTableId || null,
      orderId: normalizedOrderId || null
    }).catch((err: unknown) => { logger.warn('mesas:order_operations:clear_closed_mesa_cache failed', err); });

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
      if (!normalizedOrderId || !normalizedTableId) {
        emptyReleaseInProgressRef.current = null;
        return;
      }
      try {
        await deleteOrderAndReleaseTable({
          orderId: normalizedOrderId,
          tableId: normalizedTableId,
          businessId,
          userId: currentUser?.id || null
        });
      } catch {
        try { await loadMesas(); } catch (err: unknown) { logger.warn('mesas:order_operations:load_mesas_recovery failed', err); }
      } finally {
        emptyReleaseInProgressRef.current = null;
      }
    });
  }, [businessId, clearClosedMesaCache, currentUser?.id, emptyReleaseInProgressRef, loadMesas, setPendingQuantityUpdatesSafe, setMesas, setShowOrderDetails, setModalOpenIntent, setSelectedMesa, setOrderItems, setSearchProduct, pendingRemoteOrderTotalsRef, lastSyncedOrderTotalsRef, orderItemsDirtyRef, orderItemsRef]);

  const handleRefreshOrder = useCallback(async () => {
    if (!selectedMesa) return;
    
    try {
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
      } catch (err: unknown) {
        logger.warn('mesas:order_operations:remove_item_refresh failed', err);
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
          showError('Error',t('mesas:errors.orderSyncDetected'));
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
      
      // El dirty se mantiene true hasta que termine el persist: así los eventos
      // realtime de los items recién guardados no se aplican por encima del
      // estado optimista mientras el snapshot aún no resolvió.
      setShowOrderDetails(false);
      setModalOpenIntent(false);
      setSelectedMesa(null);
      orderItemsRef.current = [];
      setOrderItems([]);
      setSearchProduct('');

      if (!hasLocalEdits) {
        orderItemsDirtyRef.current = false;
        showSuccess(t('mesas:success.tableUpdated'), `${t('mesas:labels.table')} #${mesaSnapshot.table_number}`);
        return;
      }

      void (async () => {
        try {
          // Solo persistir si esta sesión editó la orden: evita que un estado
          // cacheado/incompleto borre items agregados por otro dispositivo.
          const hasTempItems = (Array.isArray(effectiveOrderItemsSnapshot) ? effectiveOrderItemsSnapshot : []).some(
            (item) => String(item?.id || '').startsWith('tmp-')
          );
          await persistPendingQuantityUpdates(mesaSnapshot.current_order_id!, { refreshItems: false, items: effectiveOrderItemsSnapshot });
          // Si hubo items tmp-, el snapshot RPC ya persiste orders.total
          // (e invalida cache + outbox): no escribir el total dos veces.
          if (!hasTempItems) {
            await updateOrderTotal(mesaSnapshot.current_order_id, effectiveOrderItemsSnapshot, { skipMesaState: true });
          }
          showSuccess(t('mesas:success.tableUpdated'), `${t('mesas:labels.table')} #${mesaSnapshot.table_number}`);
        } catch (err) {
          // El persist falló: el estado optimista queda en UI, pero el usuario
          // debe saber que la DB no guardó (el poll de 5s reconciliará).
          const message = resolveErrorMessage(err, '');
          showError(
            t('mesas:errors.saveOrderFailed'),
            message ? `${t('mesas:labels.table')} #${mesaSnapshot.table_number}: ${message}` : undefined
          );
          logger.warn('mesas:save_persist failed', err);
        } finally {
          orderItemsDirtyRef.current = false;
        }
      })();
    } catch {
      showError('Error',t('mesas:errors.saveOrderFailed'));
    }
  }, [
    selectedMesa,
    updateOrderTotal,
    persistPendingQuantityUpdates,
    loadMesas,
    releaseEmptyOrderAndCloseModal,
    setMesas,
    setShowOrderDetails,
    setModalOpenIntent,
    setSelectedMesa,
    setOrderItems,
    setSearchProduct,
    showError,
    showSuccess,
    orderItemsRef,
    orderItemsDirtyRef,
    pendingQuantityUpdatesRef,
    pendingRemoteOrderTotalsRef,
    t
  ]);

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
    const normalizedSnapshotOrderId = normalizeEntityId(mesaSnapshot?.current_order_id);
    const snapshotOrderTotal = toFiniteNumber(mesaSnapshot?.orders?.total, 0);
    const pendingSnapshotTotal = normalizedSnapshotOrderId
      ? toFiniteNumber(pendingRemoteOrderTotalsRef.current?.[normalizedSnapshotOrderId], 0)
      : 0;
    const hasOrderTotalSignal = snapshotOrderTotal > 0.0001 || pendingSnapshotTotal > 0.0001;

    if (effectiveItemsSnapshot.length === 0) {
      if (hasOrderTotalSignal) {
        showError('Error', t('mesas:errors.orderSyncDetected'));
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

    // X = descartar cambios: no se persiste nada en la DB. La cocina solo se
    // entera cuando el mesero presiona "Guardar" (handleRefreshOrder).
    closeModalImmediate(() => {
      orderItemsDirtyRef.current = false;
      setShowOrderDetails(false);
      setModalOpenIntent(false);
      setSelectedMesa(null);
      orderItemsRef.current = [];
      setOrderItems([]);
      setPendingQuantityUpdatesSafe({});
    });
  }, [
    selectedMesa,
    releaseEmptyOrderAndCloseModal,
    setMesas,
    setShowOrderDetails,
    setModalOpenIntent,
    setSelectedMesa,
    setOrderItems,
    setPendingQuantityUpdatesSafe,
    showError,
    orderItemsRef,
    orderItemsDirtyRef,
    pendingRemoteOrderTotalsRef,
    t
  ]);

  return {
    releaseEmptyOrderAndCloseModal,
    handleRefreshOrder,
    handleCloseModal,
  };
}
