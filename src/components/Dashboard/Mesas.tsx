import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Layers, Plus, ChefHat } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { resolveCallEvents } from '@stocky/shared';
import { deleteTableCascadeOrders, updateOrderNotesById, clearTableCallRequested } from '../../data/commands/ordersCommands';
import type { SplitBillOrderItem, OrderItem, MesaRecord } from '../../types/components';
import { calcularCambio } from '../../utils/cambio';
import { Button } from '../ui/button';
import { AsyncStateWrapper } from '../../ui/system/async-state/index.js';
import { useAppToast, TOAST_DEFAULT_DURATION } from '../../hooks/useAppToast';
import { playNewOrderBeep } from '../../utils/notificationSound';
import { getTotalProductUnits, getOrderItemRenderKey, getOrderItemName } from './mesas/mesaHelpers';
import MesasGrid from './mesas/MesasGrid';
import { useMesaEditLocks } from './mesas/useMesaEditLocks.js';
import { useMesaRealtime } from './mesas/useMesaRealtime.js';
import { useMesaOrderOperations } from './mesas/useMesaOrderOperations';
import { useMesaPayment } from './mesas/useMesaPayment.js';
import { useMesasState } from './mesas/useMesasState.js';
import { useMesasRefs } from './mesas/useMesasRefs.js';
import { useMesasEffects } from './mesas/useMesasEffects.js';
import { useMesasCatalog } from './mesas/useMesasCatalog.js';
import { useMesaCatalog } from '../../hooks/useMesaCatalog.js';
import { useRafBatchedQueue } from '../../hooks/useRafBatchedQueue.js';
import { useCloseOrderLocks } from '../../hooks/useCloseOrderLocks.js';
import { useBusinessConfig } from '../../hooks/useBusinessConfig';
import { logger } from '@/utils/logger';
import { MesasHeader } from './mesas/MesasHeader.jsx';
import { AddMesaForm } from './mesas/AddMesaForm.jsx';
import { OrderDetailsModal } from './mesas/OrderDetailsModal.jsx';
import { CloseOrderChoiceModal } from './mesas/CloseOrderChoiceModal.jsx';
import SplitBillModal from './SplitBillModal.jsx';
import { MesaPaymentModal } from './MesaPaymentModal.jsx';
import { MesaDeleteModal } from './MesaDeleteModal.jsx';
import { PrintReceiptConfirmModal } from '../ui/PrintReceiptConfirmModal';

function Mesas({ businessId, userRole = 'admin' }: { businessId: string; userRole?: string }) {
  const { t } = useTranslation(['mesas', 'common']);
  const config = useBusinessConfig();
  const { showError, showSuccess, showInfo, ToastComponent } = useAppToast();
  const priceConfig = { locale: config.locale, currency: config.currency, currencySymbol: config.currencySymbol, decimals: config.decimals };
  const isKitchenRole = userRole === 'kitchen' || userRole === 'cocina';
  
  const state = useMesasState(businessId, userRole);
  const refs = useMesasRefs({
    businessId,
    currentUser: state.currentUser,
  });

  const { loadCombos, ensureCatalogWarmup } = useMesaCatalog({
    businessId,
    setProducts: state.setProducts,
    setCombos: state.setCombos,
    showError,
  });

  const { acquireCloseOrderLock, releaseCloseOrderLock } = useCloseOrderLocks();
  const enqueueRealtimeUpdate = useRafBatchedQueue({ useTransition: false });

  const {
    getMesaLockState,
    acquireMesaEditLockWeb,
    releaseMesaEditLockWeb,
    refreshMesaLocks,
    applyRealtimeMesaLockBroadcast,
    refreshMesaEditLockHeartbeatWeb,
  } = useMesaEditLocks({
    businessId,
    currentUser: state.currentUser,
    isOfflineFirstRuntime: refs.isOfflineFirstRuntime,
    heldMesaLockRef: refs.heldMesaLockRef,
    mesaSyncClientIdRef: refs.mesaSyncClientIdRef,
    mesaLockHeartbeatTimerRef: refs.mesaLockHeartbeatTimerRef,
  });

  const catalog = useMesasCatalog({
    products: state.products,
    combos: state.combos,
    orderItems: state.orderItems,
    selectedMesa: state.selectedMesa,
    searchProduct: state.searchProduct,
    debouncedSearch: state.debouncedSearch,
    lowMotionMode: state.lowMotionMode,
    paymentMethod: state.paymentMethod,
    amountReceived: state.amountReceived,
  });

  const isOpeningTableRef = useRef(false);
  const dismissedCallsRef = useRef(new Map<string, number>());
  const latestMesasRef = useRef(state.mesas);
  latestMesasRef.current = state.mesas;
  const prevAutoDismissCallsRef = useRef(new Map<string, string>());
  const callBaselineSeededRef = useRef(false);
  const callAutoDismissTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const [mostRecentOrderId, setMostRecentOrderId] = useState<string | null>(null);
  const [arrivalVersion, setArrivalVersion] = useState(0);
  const arrivalTimestampsRef = useRef<Map<string, number>>(new Map());

  const handleDismissCall = useCallback(
    (mesaId: string) => {
      if (!mesaId || !businessId) return;
      dismissedCallsRef.current.set(mesaId, Date.now());
      state.setMesas((prev) =>
        (Array.isArray(prev) ? prev : []).map((mesa) =>
          String(mesa?.id || '') === String(mesaId) ? { ...mesa, call_requested_at: undefined } : mesa,
        ),
      );
      clearTableCallRequested({ tableId: mesaId, businessId }).catch((err) => {
        showError('Error', t('mesas:errors.callClearFailed'));
        logger.warn('mesas:call_clear failed', err);
      });
    },
    [businessId, state.setMesas, showError, t],
  );

  useEffect(() => {
    if (isKitchenRole) return;

    const { newEvents, baselineSeeded, seenEntries } = resolveCallEvents(
      state.mesas,
      prevAutoDismissCallsRef.current,
      callBaselineSeededRef.current,
    );
    if (baselineSeeded) {
      callBaselineSeededRef.current = true;
      // Siembra silenciosa: marca como vistos los calls previos al login.
      seenEntries.forEach(({ mesaId, raw }) => {
        prevAutoDismissCallsRef.current.set(mesaId, raw);
      });
    }

    // Calls que llegaron DURANTE la sesión: toast + beep + auto-dismiss.
    // Los calls previos al login se siembran en el baseline y solo dejan el bell.
    newEvents.forEach(({ mesaId, raw }) => {
      prevAutoDismissCallsRef.current.set(mesaId, raw);
      const mesa = (Array.isArray(state.mesas) ? state.mesas : []).find(
        (m) => String(m?.id || '').trim() === mesaId,
      );
      const mesaLabel = String(mesa?.table_number ?? '');
      playNewOrderBeep();
      showInfo(
        t('mesas:toast.orderReady.title'),
        t('mesas:toast.orderReady.message', { mesa: mesaLabel })
      );

      const existingTimer = callAutoDismissTimersRef.current.get(mesaId);
      if (existingTimer) clearTimeout(existingTimer);
      const timer = setTimeout(() => {
        callAutoDismissTimersRef.current.delete(mesaId);
        const currentMesa = latestMesasRef.current.find(
          (m) => String(m?.id || '').trim() === mesaId,
        );
        if (
          currentMesa &&
          String(currentMesa.call_requested_at || '').trim() === raw
        ) {
          handleDismissCall(mesaId);
        }
      }, TOAST_DEFAULT_DURATION);
      callAutoDismissTimersRef.current.set(mesaId, timer);
    });
  }, [state.mesas, handleDismissCall, isKitchenRole, showInfo, t]);

  useEffect(() => {
    return () => {
      callAutoDismissTimersRef.current.forEach((timer) => clearTimeout(timer));
      callAutoDismissTimersRef.current.clear();
    };
  }, []);

  const recordOrderArrival = useCallback((orderId: string) => {
    if (!orderId) return;
    arrivalTimestampsRef.current.set(orderId, Date.now());
    setArrivalVersion((v) => v + 1);
    let latestId: string | null = null;
    let latestTs = -Infinity;
    arrivalTimestampsRef.current.forEach((ts, id) => {
      if (ts > latestTs) {
        latestTs = ts;
        latestId = id;
      }
    });
    setMostRecentOrderId((prev) => (prev === latestId ? prev : latestId));
  }, []);

  // Siembra los timestamps de recencia desde datos persistidos (updated_at/opened_at)
  // para órdenes ya existentes: el orden "más reciente primero" sobrevive recargas.
  // Si el updated_at persistido es MÁS NUEVO que el arrival actual (cambio
  // detectado por poll sin realtime), se reinicia el temporizador de cocina.
  useEffect(() => {
    let changed = false;
    (Array.isArray(state.mesas) ? state.mesas : []).forEach((mesa) => {
      if (String(mesa?.status || '').trim().toLowerCase() !== 'occupied') return;
      const orderId = String(mesa?.orders?.id || mesa?.current_order_id || '').trim();
      if (!orderId) return;
      const persistedTs = Date.parse(
        String(mesa?.orders?.updated_at || mesa?.orders?.opened_at || ''),
      );
      if (!Number.isFinite(persistedTs)) return;
      const current = arrivalTimestampsRef.current.get(orderId);
      if (current === undefined) {
        arrivalTimestampsRef.current.set(orderId, persistedTs);
        changed = true;
        return;
      }
      if (persistedTs > current) {
        arrivalTimestampsRef.current.set(orderId, persistedTs);
        changed = true;
      }
    });
    if (changed) setArrivalVersion((v) => v + 1);
  }, [state.mesas]);

  const {
    handleCreateTable,
    loadMesas,
    clearClosedMesaCache,
    handleOpenTable,
    addCatalogItemToOrder,
    updateItemQuantity,
    handleRefreshOrder,
    handleCloseModal,
    flushPendingRemoteOrderTotals,
  } = useMesaOrderOperations({
    businessId,
    setMesas: state.setMesas,
    setLoading: state.setLoading,
    selectedMesa: state.selectedMesa,
    setSelectedMesa: state.setSelectedMesa,
    setShowOrderDetails: state.setShowOrderDetails,
    orderItems: state.orderItems,
    setOrderItems: state.setOrderItems,
    setPendingQuantityUpdatesSafe: refs.setPendingQuantityUpdatesSafe,
    pendingQuantityUpdatesRef: refs.pendingQuantityUpdatesRef,
    orderItemsDirtyRef: refs.orderItemsDirtyRef,
    orderItemsRef: refs.orderItemsRef,
    orderDetailsRequestRef: refs.orderDetailsRequestRef,
    pendingRemoteOrderTotalsRef: refs.pendingRemoteOrderTotalsRef,
    orderTotalSyncQueueRef: refs.orderTotalSyncQueueRef,
    lastSyncedOrderTotalsRef: refs.lastSyncedOrderTotalsRef,
    acquireMesaEditLockWeb,
    publishMesaLockBroadcast: refs.publishMesaLockBroadcast,
    ensureCatalogWarmup,
    isOfflineFirstRuntime: refs.isOfflineFirstRuntime,
    setMesaOpenDebugStage: refs.setMesaOpenDebugStage,
    buildMesaOpenDebugTag: refs.buildMesaOpenDebugTag,
    isCreatingTable: state.isCreatingTable,
    setIsCreatingTable: state.setIsCreatingTable,
    newTableNumber: state.newTableNumber,
    setNewTableNumber: state.setNewTableNumber,
    setModalOpenIntent: state.setModalOpenIntent,
    setSearchProduct: state.setSearchProduct,
    quantityToAdd: state.quantityToAdd,
    setQuantityToAdd: state.setQuantityToAdd,
    getCurrentUser: state.getCurrentUser,
    currentUser: state.currentUser,
    canManageTables: state.canManageTables,
    isEmployee: state.isEmployee,
    activeMesaBroadcastRef: refs.activeMesaBroadcastRef,
    mesaSyncClientIdRef: refs.mesaSyncClientIdRef,
    heldMesaLockRef: refs.heldMesaLockRef,
    getMesaLockState,
    setShowAddForm: state.setShowAddForm,
    isOpeningTableRef,
    emptyReleaseInProgressRef: refs.emptyReleaseInProgressRef,
    showError,
    showSuccess,
    dismissedCallsRef,
  });

  useMesaRealtime({
    businessId,
    setMesas: state.setMesas,
    enqueueRealtimeUpdate,
    dismissedCallsRef,
    setSelectedMesa: state.setSelectedMesa,
    selectedMesaRef: refs.selectedMesaRef,
    orderItemsRef: refs.orderItemsRef,
    setOrderItems: state.setOrderItems,
    pendingQuantityUpdatesRef: refs.pendingQuantityUpdatesRef,
    productCatalogByIdRef: refs.productCatalogByIdRef,
    orderItemsDirtyRef: refs.orderItemsDirtyRef,
    lastSyncedOrderTotalsRef: refs.lastSyncedOrderTotalsRef,
    justCompletedSaleRef: refs.justCompletedSaleRef,
    setShowOrderDetails: state.setShowOrderDetails,
    setModalOpenIntent: state.setModalOpenIntent,
    pendingRemoteOrderTotalsRef: refs.pendingRemoteOrderTotalsRef,
    loadCombos,
    comboCatalogByIdRef: refs.comboCatalogByIdRef,
    isOpeningTableRef,
    emptyReleaseInProgressRef: refs.emptyReleaseInProgressRef,
    onOrderChanged: (kind, payload) => {
      if (!isKitchenRole) return;
      const itemRow = payload as { order_id?: string; id?: string } | null;
      const orderId = String(itemRow?.order_id || itemRow?.id || '').trim();
      const matchingMesa = orderId
        ? (Array.isArray(state.mesas) ? state.mesas : []).find(
            (m) => String((m.orders as unknown as Record<string, unknown>)?.id || '') === orderId
          )
        : null;
      // No avisar si la orden ya no está activa: cerrada, liberada o sin mesa.
      // En 'new' se tolera que la mesa aún no aparezca en el estado del kitchen
      // (el INSERT del item puede llegar antes del UPDATE de la tabla): se
      // notifica igual y se resuelve la mesa cuando esté disponible.
      if (!matchingMesa) {
        if (kind !== 'new') return;
      } else {
        const mesaOrderStatus = String(
          (matchingMesa?.orders as unknown as Record<string, unknown>)?.status || ''
        ).trim().toLowerCase();
        if (mesaOrderStatus === 'closed') return;
        if (kind !== 'new' && matchingMesa.status !== 'occupied') return;
      }
      playNewOrderBeep();
      recordOrderArrival(orderId);
      const tableNumber = matchingMesa?.table_number;
      const mesaLabel = tableNumber
        ? t('mesas:labels.tableNumber', { number: tableNumber })
        : null;
      if (kind === 'new') {
        showInfo(
          t('mesas:toast.newOrder.title'),
          mesaLabel
            ? t('mesas:toast.newOrder.message', { mesa: mesaLabel })
            : t('mesas:toast.newOrder.messageGeneric')
        );
        return;
      }
      showInfo(
        t('mesas:toast.updatedOrder.title'),
        mesaLabel
          ? t('mesas:toast.updatedOrder.message', { mesa: mesaLabel })
          : t('mesas:toast.updatedOrder.messageGeneric')
      );
    },
  });

  const {
    handleCloseOrder,
    handlePayAllTogether,
    handleSplitBill,
    processPaymentAndClose,
    processSplitPaymentAndClose,
    handlePrintOrder,
    handlePrintConfirm,
    handlePrintCancel,
  } = useMesaPayment({
    businessId,
    setMesas: state.setMesas,
    selectedMesa: state.selectedMesa,
    setSelectedMesa: state.setSelectedMesa,
    orderItems: state.orderItems,
    setOrderItems: state.setOrderItems,
    paymentMethod: state.paymentMethod,
    setPaymentMethod: state.setPaymentMethod,
    amountReceived: state.amountReceived,
    setAmountReceived: state.setAmountReceived,
    setAmountReceivedError: state.setAmountReceivedError,
    setSelectedCustomer: state.setSelectedCustomer,
    isClosingOrder: state.isClosingOrder,
    setIsClosingOrder: state.setIsClosingOrder,
    setIsGeneratingSplitSales: state.setIsGeneratingSplitSales,
    setShowPaymentModal: state.setShowPaymentModal,
    setShowSplitBillModal: state.setShowSplitBillModal,
    setShowCloseOrderChoiceModal: state.setShowCloseOrderChoiceModal,
    setShowPrintModal: state.setShowPrintModal,
    printSaleDataList: state.printSaleDataList,
    setPrintSaleDataList: state.setPrintSaleDataList,
    setIsPrintingReceipt: state.setIsPrintingReceipt,
    printCustomerName: state.printCustomerName,
    setPrintCustomerName: state.setPrintCustomerName,
    setPrintSaleIds: state.setPrintSaleIds,
    justCompletedSaleRef: refs.justCompletedSaleRef,
    acquireCloseOrderLock,
    releaseCloseOrderLock,
    publishMesaLockBroadcast: refs.publishMesaLockBroadcast,
    loadMesas,
    clearClosedMesaCache,
    productCatalogByIdRef: refs.productCatalogByIdRef,
    comboCatalogByIdRef: refs.comboCatalogByIdRef,
    orderItemsDirtyRef: refs.orderItemsDirtyRef,
    orderItemsRef: refs.orderItemsRef,
    setModalOpenIntent: state.setModalOpenIntent,
    setShowOrderDetails: state.setShowOrderDetails,
    setCanShowOrderModal: state.setCanShowOrderModal,
    insufficientItems: catalog.insufficientItems,
    hasInsufficientComboStock: catalog.hasInsufficientComboStock,
    insufficientComboComponents: catalog.insufficientComboComponents,
    orderTotal: catalog.orderTotal,
    setPendingQuantityUpdatesSafe: refs.setPendingQuantityUpdatesSafe,
    setProducts: state.setProducts,
    priceConfig,
    showError,
    showSuccess,
  });

  useEffect(() => {
    refs.orderItemsRef.current = Array.isArray(state.orderItems) ? state.orderItems : [];
  }, [state.orderItems]);

  useEffect(() => {
    refs.selectedMesaRef.current = state.selectedMesa || null;
  }, [state.selectedMesa]);

  useEffect(() => {
    const productMap = new Map();
    (Array.isArray(state.products) ? state.products : []).forEach((product) => {
      const productId = product?.id;
      if (productId) productMap.set(productId, product);
    });
    refs.productCatalogByIdRef.current = productMap;
  }, [state.products]);

  useEffect(() => {
    const comboMap = new Map();
    (Array.isArray(state.combos) ? state.combos : []).forEach((combo) => {
      const comboId = combo?.id;
      if (comboId) comboMap.set(comboId, combo);
    });
    refs.comboCatalogByIdRef.current = comboMap;
  }, [state.combos]);

  useMesasEffects({
    businessId,
    mesas: state.mesas,
    showOrderDetails: state.showOrderDetails,
    loadMesas,
    getCurrentUser: state.getCurrentUser,
    checkIfEmployee: state.checkIfEmployee,
    refreshMesaLocks,
    applyRealtimeMesaLockBroadcast,
    refreshMesaEditLockHeartbeatWeb,
    releaseMesaEditLockWeb,
    flushPendingRemoteOrderTotals,
    heldMesaLockRef: refs.heldMesaLockRef,
    activeMesaBroadcastRef: refs.activeMesaBroadcastRef,
    mesaSyncBroadcastChannelRef: refs.mesaSyncBroadcastChannelRef,
    mesaSyncBroadcastReadyRef: refs.mesaSyncBroadcastReadyRef,
    mesasSnapshotTimerRef: refs.mesasSnapshotTimerRef,
    mesaLockHeartbeatTimerRef: refs.mesaLockHeartbeatTimerRef,
    publishMesaLockBroadcast: refs.publishMesaLockBroadcast,
    emptyReleaseInProgressRef: refs.emptyReleaseInProgressRef,
  });

  const handleRetry = async () => {
    try {
      await loadMesas();
    } catch {
      showError('Error', t('mesas:errors.loadFailed'));
    }
  };

  const [isSavingNotes, setIsSavingNotes] = useState(false);

  const selectedOrderNotes = useMemo(() => {
    const orders = state.selectedMesa?.orders;
    if (!orders || typeof orders !== 'object') return '';
    return String((orders as unknown as Record<string, unknown>)?.notes || '');
  }, [state.selectedMesa?.orders]);

  const handleSaveNotes = useCallback(async (notes: string) => {
    const orders = state.selectedMesa?.orders;
    const orderId = orders && typeof orders === 'object'
      ? (orders as unknown as Record<string, unknown>)?.id
      : null;
    if (!orderId || isSavingNotes) return;

    setIsSavingNotes(true);
    try {
      const cleanNotes = String(notes || '').trim().slice(0, 500);
      await updateOrderNotesById({
        orderId: String(orderId),
        notes: cleanNotes,
        businessId
      });

      const selectedMesaId = state.selectedMesa?.id;
      state.setSelectedMesa((prev) => {
        if (!prev || prev.id !== selectedMesaId) return prev;
        const currentOrders = prev.orders && typeof prev.orders === 'object'
          ? { ...(prev.orders as unknown as Record<string, unknown>) }
          : {};
        return { ...prev, orders: { ...currentOrders, notes: cleanNotes } } as unknown as MesaRecord;
      });
      state.setMesas((prev) => prev.map((mesa) => {
        if (mesa.id !== selectedMesaId) return mesa;
        const currentOrders = mesa.orders && typeof mesa.orders === 'object'
          ? { ...(mesa.orders as unknown as Record<string, unknown>) }
          : {};
        return { ...mesa, orders: { ...currentOrders, notes: cleanNotes } } as unknown as MesaRecord;
      }));

      showSuccess(t('mesas:success.notesSaved'));
    } catch {
      showError('Error', t('mesas:errors.notesSaveFailed'));
    } finally {
      setIsSavingNotes(false);
    }
  }, [state.selectedMesa, businessId, isSavingNotes, showSuccess, showError, t]);

  return (
    <>
    <AsyncStateWrapper
      loading={state.loading}
      error={state.mesas.length === 0 ? state.error : null}
      dataCount={state.mesas.length}
      onRetry={handleRetry}
      skeletonType="mesas"
      emptyTitle={t('mesas:empty.noTables')}
      emptyDescription={t('mesas:empty.noTablesDescription')}
      emptyAction={
        state.canManageTables ? (
          <Button
            type="button"
            onClick={() => state.setShowAddForm(true)}
            className="gradient-primary text-white hover:opacity-90 transition-all duration-300 shadow-lg font-semibold px-4 py-2 rounded-xl"
          >
            {t('empty.createFirstTable')}
          </Button>
        ) : null
      }
      bypassStateRendering={state.showAddForm}
    >
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="space-y-6"
      >
        {!isKitchenRole && (
        <MesasHeader
          canManageTables={state.canManageTables}
          onToggleAddForm={() => state.setShowAddForm(!state.showAddForm)}
        />
        )}

        <div className="pt-6">
          <PrintReceiptConfirmModal
            key="print-receipt-confirm"
            isOpen={state.showPrintModal}
            onConfirm={handlePrintConfirm}
            onCancel={handlePrintCancel}
            isLoading={state.isPrintingReceipt}
            customerName={state.printCustomerName}
            onCustomerNameChange={state.setPrintCustomerName}
          />

          <AddMesaForm
            showAddForm={state.showAddForm}
            canManageTables={state.canManageTables}
            isCreatingTable={state.isCreatingTable}
            newTableNumber={state.newTableNumber}
            onNewTableNumberChange={(e) => state.setNewTableNumber(e.target.value)}
            onSubmit={handleCreateTable}
            onCancel={() => {
              state.setShowAddForm(false);
              state.setNewTableNumber('');
            }}
          />

          <MesasGrid
            visibleMesas={state.visibleMesas}
            totalMesas={state.totalMesas}
            hasMoreMesas={state.hasMoreMesas}
            mesasSentinelRef={state.mesasSentinelRef}
            loadMoreMesas={state.loadMoreMesas}
            isEmployee={state.isEmployee}
            onOpenTable={handleOpenTable}
            onDeleteTable={(mesaId) => {
              state.setMesaToDelete(state.mesas.find((m) => m.id === mesaId) ?? null);
              state.setShowDeleteModal(true);
            }}
            selectedMesaId={state.modalOpenIntent && state.showOrderDetails ? null : state.selectedMesa?.id || null}
            selectedMesaUnits={
              state.modalOpenIntent && state.showOrderDetails
                ? null
                : state.selectedMesa?.id
                  ? getTotalProductUnits(state.orderItems)
                  : null
            }
            lowMotionMode={state.lowMotionMode}
            isKitchen={isKitchenRole}
            businessId={businessId}
            getMesaLockState={getMesaLockState}
            mostRecentOrderId={mostRecentOrderId}
            orderArrivalTsByOrderId={arrivalTimestampsRef}
            arrivalVersion={arrivalVersion}
            onDismissCall={handleDismissCall}
            showInfo={showInfo}
            showError={showError}
          />

          {/* Cocina: hay mesas pero ninguna con pedidos en espera */}
          {isKitchenRole && !state.loading && state.mesas.length > 0 && !state.mesas.some((m) => m.status === 'occupied') && (
            <div className="text-center py-16">
              <div className="relative w-20 h-20 mx-auto mb-4">
                {!state.lowMotionMode && (
                  <div className="absolute inset-0 rounded-full bg-amber-200/70 animate-ping" aria-hidden="true" />
                )}
                <div className="relative w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center">
                  <ChefHat className="w-10 h-10 text-amber-600" />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-primary-900 mb-2">{t('mesas:empty.noPendingOrders')}</h3>
              <p className="text-primary-600">{t('mesas:empty.noPendingOrdersDescription')}</p>
            </div>
          )}

          {state.mesas.length === 0 && !state.loading && (
            <div className="text-center py-12">
              <div className="w-20 h-20 rounded-full bg-accent-100 flex items-center justify-center mx-auto mb-4">
                <Layers className="w-10 h-10 text-accent-600" />
              </div>
              <h3 className="text-xl font-semibold text-primary-900 mb-2">{t('mesas:empty.noTables')}</h3>
              <p className="text-primary-600 mb-6">{t('mesas:empty.noTablesDescription')}</p>
              {state.canManageTables && (
                <Button onClick={() => state.setShowAddForm(true)} className="gradient-primary text-white hover:opacity-90">
                  <Plus className="w-5 h-5 mr-2" />
                  {t('mesas:buttons.addTable')}
                </Button>
              )}
            </div>
          )}
        </div>

        <OrderDetailsModal
          isOpen={state.modalOpenIntent && state.showOrderDetails && state.canShowOrderModal}
          selectedMesa={state.selectedMesa}
          searchProduct={state.searchProduct}
          onSearchChange={(value) => state.setSearchProduct(value)}
          filteredCatalog={catalog.filteredCatalog}
          visibleFilteredCatalog={catalog.visibleFilteredCatalog}
          hasMoreFilteredCatalog={catalog.hasMoreFilteredCatalog}
          totalFilteredCatalog={catalog.totalFilteredCatalog}
          filteredCatalogSentinelRef={catalog.filteredCatalogSentinelRef}
          lowMotionMode={state.lowMotionMode}
          onAddItem={addCatalogItemToOrder}
          onLoadMoreFilteredCatalog={catalog.loadMoreFilteredCatalog}
          orderItems={state.orderItems as OrderItem[]}
          visibleOrderItems={catalog.visibleOrderItems as OrderItem[]}
          hasMoreOrderItems={catalog.hasMoreOrderItems}
          totalOrderItems={catalog.totalOrderItems}
          orderItemsSentinelRef={catalog.orderItemsSentinelRef}
          getOrderItemRenderKey={getOrderItemRenderKey as unknown as (item: OrderItem, index: number) => string}
          getOrderItemName={(item) => getOrderItemName(item as unknown as import('./mesas/mesaHelpers').OrderItem, t)}
          onUpdateQuantity={updateItemQuantity}
          onLoadMoreOrderItems={catalog.loadMoreOrderItems}
          orderTotal={catalog.orderTotal}
          onSave={handleRefreshOrder}
          onPrintKitchen={handlePrintOrder}
          onCloseOrder={handleCloseOrder}
          onClose={handleCloseModal}
          orderNotes={selectedOrderNotes}
          onSaveNotes={handleSaveNotes}
        />

        <CloseOrderChoiceModal
          isOpen={state.showCloseOrderChoiceModal}
          orderTotal={catalog.orderTotal}
          onPayAllTogether={handlePayAllTogether}
          onSplitBill={handleSplitBill}
          onClose={() => state.setShowCloseOrderChoiceModal(false)}
        />

        <AnimatePresence>
          {state.showSplitBillModal && (
            <SplitBillModal
              orderItems={state.orderItems as SplitBillOrderItem[]}
              onConfirm={processSplitPaymentAndClose}
              onCancel={() => {
                state.setShowSplitBillModal(false);
                state.setShowCloseOrderChoiceModal(true);
              }}
            />
          )}
        </AnimatePresence>

        <MesaPaymentModal
          isOpen={state.showPaymentModal}
          orderTotal={catalog.orderTotal}
          cambioPago={catalog.cambioPago}
          paymentMethod={state.paymentMethod}
          onPaymentMethodChange={state.setPaymentMethod}
          selectedCustomer={state.selectedCustomer}
          onCustomerChange={state.setSelectedCustomer}
          amountReceived={state.amountReceived}
          onAmountReceivedChange={state.setAmountReceived}
          amountReceivedError={state.amountReceivedError}
          setAmountReceivedError={state.setAmountReceivedError}
          insufficientItems={catalog.insufficientItems}
          insufficientComboComponents={catalog.insufficientComboComponents}
          hasInsufficientComboStock={catalog.hasInsufficientComboStock}
          isCashPaymentInvalid={catalog.isCashPaymentInvalid}
          isClosingOrder={state.isClosingOrder}
          onCancel={() => {
            state.setShowPaymentModal(false);
            state.setPaymentMethod('cash');
            state.setAmountReceived('');
            state.setAmountReceivedError('');
            state.setSelectedCustomer('');
          }}
          onConfirm={processPaymentAndClose}
          calcularCambio={calcularCambio}
        />

        <MesaDeleteModal
          isOpen={state.showDeleteModal}
          onCancel={() => {
            state.setShowDeleteModal(false);
            state.setMesaToDelete(null);
          }}
          onConfirm={async () => {
            if (!state.mesaToDelete) return;
            const mesaId = state.mesaToDelete.id;
            const snapshotMesas = state.mesas.slice();
            const deletedTable = snapshotMesas.find((m) => m.id === mesaId) || null;
            const deletedTableLabel = deletedTable?.table_number ? `#${deletedTable.table_number}` : '-';
            state.setMesas((prevMesas) => prevMesas.filter((m) => m.id !== mesaId));
            if (state.selectedMesa?.id === mesaId) {
              handleCloseModal();
            }
            state.setShowDeleteModal(false);
            state.setMesaToDelete(null);
            try {
              const deleteResult = await deleteTableCascadeOrders(mesaId, { businessId });
              showSuccess(t('mesas:alerts.tableDeleted'), `${t('mesas:labels.table')}: ${deletedTableLabel}`);
              if (!deleteResult?.__localOnly) {
                await loadMesas();
              }
            } catch (err) {
              const message = String(err?.message || '').trim();
              const code = String(err?.code || '').trim();
              const details = String(err?.details || '').trim();
              const hint = String(err?.hint || '').trim();
              const diag = [code ? `code=${code}` : null, hint ? `hint=${hint}` : null, details ? `details=${details}` : null]
                .filter(Boolean)
                .join(' | ');
              showError(
                'Error',
                `${t('mesas:errors.deleteFailed')}${message ? ` ${message}` : ''}${diag ? ` [${diag}]` : ''}`,
              );
              state.setMesas(snapshotMesas);
            }
          }}
        />
      </motion.section>
    </AsyncStateWrapper>
    <ToastComponent />
    </>
  );
}

export default Mesas;
