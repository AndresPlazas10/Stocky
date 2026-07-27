import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Session } from '@supabase/supabase-js';
import { Keyboard, StyleSheet, Text, View } from 'react-native';
import { formatCop } from '../../utils/money';
import { readCatalogFromStorage } from './utils/catalogCache';

import { useToastContext } from '../../hooks/useToastContext';
import { useToastMessages } from '../../hooks/useToastMessages';
import {
  addCatalogItemToOrder,
  getOrderItemName,
  listCatalogItems,
  loadOpenOrderSnapshot,
  persistOrderSnapshot,
  preloadRpcCompatibility,
  removeOrderItemFromOrder,
  syncOrderItemQuantity,
  type MesaOrderCatalogItem,
  type MesaOrderItem,
} from '../../services/mesaOrderService';
import { closeOrderAsSplit, closeOrderSingle } from '../../services/mesaCheckoutService';
import {
  deleteMesaCascade,
  fetchMesasByBusinessId,
  openCloseMesa,
  refreshMesaEditLockHeartbeat,
  resolveBusinessContext,
  resolveMesaEditorDisplayName,
  type BusinessContext,
  type MesaEditLock,
  type MesaRecord,
} from '../../services/mesasService';
import { SplitBillModalRN } from './split-bill/SplitBillModal';

import { useMesaOrderState } from './hooks/useMesaOrderState';
import { useMesaEditLock } from './hooks/useMesaEditLock';
import { useMesaRealtime } from './hooks/useMesaRealtime';
import { useMesaOrderMutations } from './hooks/useMesaOrderMutations';
import { useMesaPrint } from './hooks/useMesaPrint';
import { useMesaCreate } from './hooks/useMesaCreate';
import { useMesaKeyboard } from './hooks/useMesaKeyboard';
import { useMesaDeleteModal } from './hooks/useMesaDeleteModal';
import { usePaymentFlow } from './hooks/usePaymentFlow';
import { useMesaAutoSave } from './hooks/useMesaAutoSave';
import { useMesaDataLoader } from './hooks/useMesaDataLoader';
import { useMesaOpenClose } from './hooks/useMesaOpenClose';
import { useMesaActionBroadcast } from './hooks/useMesaActionBroadcast';
import { MesasGrid } from './components/MesasGrid';
import { MesasPanelHeader } from './components/MesasPanelHeader';
import { MesasModals } from './components/MesasModals';
import { OrderModal } from './components/OrderModal';
import { CreateMesaModal } from './components/CreateMesaModal';
import { DeleteMesaModal } from './components/DeleteMesaModal';
import { CloseOrderChoiceModal } from './components/CloseOrderChoiceModal';
import { PaymentModal } from './components/PaymentModal';
import {
  MESA_IN_USE_MESSAGE,
  mesaDisplayName,
  resolveSessionDisplayName,
  sumOrderItemsQuantity,
  compareMesaTableIdentifiers,
  buildCashBreakdown,
  getDenominationsForCountry,
  resetAuxiliaryModals,
  resetOrderFlow,
} from './utils/mesaHelpers';

type Props = {
  session: Session;
  businessContext?: BusinessContext | null;
};

export function MesasPanel({ session, businessContext }: Props) {
  const { t } = useTranslation('mesas');
  const [context, setContext] = useState<BusinessContext | null>(null);
  const [mesas, setMesas] = useState<MesaRecord[]>([]);
  const mesasLengthRef = useRef(0);
  const hasLoadedOnceRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [_error, setError] = useState<string | null>(null);
  const [actingMesaId, setActingMesaId] = useState<string | null>(null);

  const { isKeyboardVisible } = useMesaKeyboard();

  const selectedMesaIdRef = useRef<string>('');

  const [actorDisplayName, setActorDisplayName] = useState(() =>
    resolveSessionDisplayName(session),
  );
  const sessionDisplayName = useMemo(() => resolveSessionDisplayName(session), [session]);
  const canDeleteMesas = context?.source !== 'employee';

  const toast = useToastContext();
  const toastMessages = useToastMessages();
  const orderState = useMesaOrderState({ listCatalogItems });
  const {
    showOrderModal,
    setShowOrderModal,
    selectedMesa,
    setSelectedMesa,
    catalogItems,
    setCatalogItems,
    isCatalogLoading,
    orderItems,
    setOrderItems,
    loadingOrder,
    setLoadingOrder,
    orderModalError: _orderModalError,
    setOrderModalError,
    searchCatalog,
    setSearchCatalog,
    setIsSearchFocused,
    mutatingOrderItemId,
    setMutatingOrderItemId,
    releasingEmptyOrder,
    isSavingOrder,
    isClosingOrder,
    showCloseOrderChoiceModal,
    setShowCloseOrderChoiceModal,
    showPaymentModal,
    setShowPaymentModal,
    showSplitBillModal,
    setShowSplitBillModal,
    showPaymentMethodMenu,
    setShowPaymentMethodMenu,
    paymentMethod,
    setPaymentMethod,
    amountReceived,
    setAmountReceived,
    latestOrderItemsRef,
    orderItemsCacheRef,
    catalogBusinessIdRef,
    catalogUpdatedAtRef,
    catalogItemsRef,
    orderModalOpenIntentRef,
    pendingQuantityUpdatesRef,
    quantitySyncTimerRef,
    filteredCatalog,
    insufficientItems,
    insufficientComboComponents,
    orderTotal,
    orderModalTitle,
    isOrderFlowActive,
    cashChangeData,
    ensureCatalogLoaded,
    hasPendingChanges,
    setHasPendingChanges,
  } = orderState;

  const sendBroadcastRef = useRef<((event: string, payload: Record<string, unknown>) => void) | null>(null);

  const editLock = useMesaEditLock({
    session,
    context,
    actorDisplayName,
    onError: (msg) => setError(msg),
    isOrderFlowActive,
    onLockLost: () => resetOrderFlow(orderState),
    onCloseAuxiliaryOrderModals: () => resetAuxiliaryModals(orderState),
    sendBroadcastRef,
  });

  const {
    mesaLocksByTableId,
    setMesaLocksByTableId,
    heldMesaLock,
    heldMesaLockRef,
    closeAuxiliaryOrderModals: _closeAuxiliaryOrderModals,
    publishMesaLockBroadcast,
    acquireMesaLockForEdition,
    releaseHeldMesaLock,
    refreshMesaLocks,
  } = editLock;

  const { isPrintInProgress, beginPrintFlow, endPrintFlow } = useMesaPrint({ setOrderModalError });

  const mesaCreate = useMesaCreate({
    context,
    onCreated: (createdMesa) => {
      setMesas((prev) => [...prev, createdMesa].sort(compareMesaTableIdentifiers));
      toast.showSuccess(
        toastMessages.mesas.created(mesaDisplayName(createdMesa, t('labels.table'))),
      );
    },
    onError: (msg) => setError(msg),
  });
  const {
    showCreateMesaModal,
    setShowCreateMesaModal,
    newTableNumber,
    setNewTableNumber,
    isCreatingMesa,
    mesaPreviewName,
    handleCreateMesa,
  } = mesaCreate;

  const emptyReleaseGuardsRef = useRef<{
    isPendingEmptyRelease: (mesaId: string) => boolean;
    shouldIgnoreStaleOccupiedDuringEmptyRelease: (
      mesaId: string,
      incomingStatus?: string | null,
      incomingSyncVersion?: number | null,
    ) => boolean;
  }>({
    isPendingEmptyRelease: () => false,
    shouldIgnoreStaleOccupiedDuringEmptyRelease: () => false,
  });

  const realtime = useMesaRealtime({
    businessId: String(context?.businessId || ''),
    userId: session.user.id,
    isOrderFlowActive,
    setMesas,
    setMesaLocksByTableId,
    setSelectedMesa,
    publishMesaLockBroadcast,
    selectedMesaIdRef,
    heldMesaLockRef,
    isPendingEmptyRelease: (mesaId) => emptyReleaseGuardsRef.current.isPendingEmptyRelease(mesaId),
    shouldIgnoreStaleOccupiedDuringEmptyRelease: (mesaId, incomingStatus, incomingSyncVersion) =>
      emptyReleaseGuardsRef.current.shouldIgnoreStaleOccupiedDuringEmptyRelease(
        mesaId,
        incomingStatus,
        incomingSyncVersion,
      ),
  });

  const {
    mesasSyncBroadcastReadyRef,
    mesasSyncBroadcastChannelRef,
    pendingUiTraceRef,
    realtimeClientInstanceIdRef,
    traceAsyncDuration,
    setActiveOrderId,
  } = realtime;

  const {
    bumpMesaActionVersion,
    isMesaActionVersionCurrent,
    beginPendingEmptyRelease,
    endPendingEmptyRelease,
    isPendingEmptyRelease,
    shouldIgnoreStaleOccupiedDuringEmptyRelease,
    sendMesaSyncBroadcast,
  } = useMesaActionBroadcast({
    mesasSyncBroadcastChannelRef,
    mesasSyncBroadcastReadyRef,
  });

  emptyReleaseGuardsRef.current = {
    isPendingEmptyRelease,
    shouldIgnoreStaleOccupiedDuringEmptyRelease,
  };

  // Set sendBroadcastRef so useMesaEditLock can send broadcasts via the realtime channel
  useEffect(() => {
    sendBroadcastRef.current = (event: string, payload: Record<string, unknown>) => {
      const channel = mesasSyncBroadcastChannelRef.current;
      if (!channel) return;
      (channel as { send: (msg: unknown) => void }).send({ type: 'broadcast', event, payload });
    };
  }, [mesasSyncBroadcastChannelRef]);

  // Sync external refs with state
  useEffect(() => {
    selectedMesaIdRef.current = String(selectedMesa?.id || '').trim();
  }, [selectedMesa?.id]);

  useEffect(() => {
    mesasLengthRef.current = Array.isArray(mesas) ? mesas.length : 0;
  }, [mesas]);

  useEffect(() => {
    const trace = pendingUiTraceRef.current;
    if (!trace) return;
    const uiLagMs = Math.max(0, Date.now() - trace.receivedAt);
    if (__DEV__) {
      console.warn('[mesa-sync] ui_painted', {
        source: trace.source,
        eventType: trace.eventType,
        rowRef: trace.rowRef,
        commitLagMs: trace.commitLagMs,
        uiLagMs,
      });
    }
    pendingUiTraceRef.current = null;
  }, [mesas]);

  const publishMesaStateBroadcast = useCallback(
    (
      mesa: MesaRecord,
      options?: {
        previousOrderId?: string | null;
        mode?: 'optimistic' | 'confirmed' | 'rollback';
        orderUnits?: number | null;
      },
    ) => {
      if (!mesa?.id) return;
      const normalizedMesaStatus = String(mesa?.status || '')
        .trim()
        .toLowerCase();
      const isMesaOccupiedNow = normalizedMesaStatus === 'occupied';
      const held = heldMesaLockRef.current;
      const hasHeldLockForMesa = Boolean(
        held &&
        held.businessId === String(mesa.business_id || '').trim() &&
        held.tableId === String(mesa.id || '').trim(),
      );
      const lockTokenHint = hasHeldLockForMesa ? held?.lockToken || null : null;
      const lockTtlMs = 45_000;
      const lockExpiresAt = isMesaOccupiedNow
        ? new Date(Date.now() + lockTtlMs).toISOString()
        : null;

      sendMesaSyncBroadcast('mesa_state_changed', {
        sender_user_id: session.user.id,
        sender_user_name: actorDisplayName,
        sender_client_id: realtimeClientInstanceIdRef.current,
        mesa_id: mesa.id,
        business_id: mesa.business_id,
        status: mesa.status,
        current_order_id: String(mesa.current_order_id || '').trim() || null,
        previous_order_id: String(options?.previousOrderId || '').trim() || null,
        sync_mode: options?.mode || 'confirmed',
        editing_user_id: isMesaOccupiedNow ? session.user.id : null,
        editing_user_name: isMesaOccupiedNow ? actorDisplayName : null,
        editing_lock_token: isMesaOccupiedNow ? lockTokenHint : null,
        editing_lock_expires_at: lockExpiresAt,
        editing_lock_ttl_ms: isMesaOccupiedNow ? lockTtlMs : null,
        table_number: mesa.table_number ?? null,
        table_name: mesa.table_name ?? null,
        order_status: mesa.orders?.status ?? null,
        order_total: Number(mesa.orders?.total || 0),
        order_units: Number.isFinite(Number(options?.orderUnits))
          ? Math.max(0, Math.floor(Number(options?.orderUnits || 0)))
          : null,
        sync_version: Number.isFinite(Number(mesa?.sync_version))
          ? Math.max(0, Math.floor(Number(mesa?.sync_version)))
          : null,
        emitted_at: Date.now(),
      });
    },
    [
      actorDisplayName,
      heldMesaLockRef,
      realtimeClientInstanceIdRef,
      sendMesaSyncBroadcast,
      session.user.id,
    ],
  );

  useEffect(() => {
    const held = heldMesaLockRef.current;
    const activeBusinessId = String(context?.businessId || '').trim();
    if (!held) return;
    if (!activeBusinessId || held.businessId !== activeBusinessId) {
      void releaseHeldMesaLock(held);
    }
  }, [context?.businessId, heldMesaLockRef, releaseHeldMesaLock]);

  useEffect(
    () => () => {
      if (quantitySyncTimerRef.current) {
        clearTimeout(quantitySyncTimerRef.current);
        quantitySyncTimerRef.current = null;
      }
      pendingQuantityUpdatesRef.current.clear();
      void releaseHeldMesaLock();
    },
    [pendingQuantityUpdatesRef, quantitySyncTimerRef, releaseHeldMesaLock],
  );

  useEffect(() => {
    if (!isOrderFlowActive) return undefined;
    const held = heldMesaLockRef.current;
    if (!held) return undefined;

    let cancelled = false;
    const timer = setInterval(() => {
      const current = heldMesaLockRef.current;
      if (!current || current.tableId !== held.tableId || current.businessId !== held.businessId)
        return;

      void refreshMesaEditLockHeartbeat({
        businessId: current.businessId,
        tableId: current.tableId,
        userId: session.user.id,
        userName: actorDisplayName,
        lockToken: current.lockToken,
        ttlSeconds: 45,
      })
        .then((result) => {
          if (cancelled) return;
          if (result.unsupported) return;
          if (result.ok) {
            if (result.lock) {
              setMesaLocksByTableId((prev) => ({
                ...prev,
                [current.tableId]: result.lock as MesaEditLock,
              }));
            }
            return;
          }

          if (result.lost) {
            setError(MESA_IN_USE_MESSAGE);
            void releaseHeldMesaLock(current);
            resetOrderFlow(orderState);
            void refreshMesaLocks(current.businessId);
          }
        })
        .catch(() => {
          // no-op
        });
    }, 9000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [
    actorDisplayName,
    heldMesaLockRef,
    isOrderFlowActive,
    orderState,
    refreshMesaLocks,
    releaseHeldMesaLock,
    session.user.id,
    setMesaLocksByTableId,
  ]);

  const catalogNameByIdentity = useMemo(() => {
    if (orderItems.length === 0) return new Map<string, string>();
    const map = new Map<string, string>();
    (Array.isArray(catalogItems) ? catalogItems : []).forEach((item) => {
      if (item.item_type === 'product' && item.product_id) {
        map.set(`p:${item.product_id}`, String(item.name || '').trim());
        return;
      }
      if (item.item_type === 'combo' && item.combo_id) {
        map.set(`c:${item.combo_id}`, String(item.name || '').trim());
      }
    });
    return map;
  }, [catalogItems, orderItems.length]);
  const resolveOrderItemDisplayName = useCallback(
    (item: MesaOrderItem) => {
      const direct = getOrderItemName(item);
      if (direct && direct !== 'Item') return direct;
      const productId = String(item?.product_id || '').trim();
      if (productId) {
        const name = String(catalogNameByIdentity.get(`p:${productId}`) || '').trim();
        if (name) return name;
      }
      const comboId = String(item?.combo_id || '').trim();
      if (comboId) {
        const name = String(catalogNameByIdentity.get(`c:${comboId}`) || '').trim();
        if (name) return name;
      }
      return direct;
    },
    [catalogNameByIdentity],
  );

  const countryDenominations = useMemo(
    () => getDenominationsForCountry(context?.country_code || 'CO'),
    [context?.country_code],
  );

  const buildCashBreakdownForCountry = useCallback(
    (change: number) => buildCashBreakdown(change, countryDenominations),
    [countryDenominations],
  );

  const {
    loadData,
    patchMesaOrderTotal,
    publishRealtimeOrderSummary,
    markMesaAsAvailableAfterSale,
  } = useMesaDataLoader({
    auth: { session, businessContext, sessionDisplayName, actorDisplayName },
    setters: { setContext, setMesas, setLoading, setError, setActorDisplayName, setCatalogItems },
    lockOps: { setMesaLocksByTableId, refreshMesaLocks, heldMesaLockRef, releaseHeldMesaLock },
    catalogOps: { ensureCatalogLoaded, readCatalogFromStorage, catalogBusinessIdRef, catalogUpdatedAtRef, catalogItemsRef },
    broadcast: { publishMesaStateBroadcast, traceAsyncDuration, realtimeClientInstanceIdRef },
    sharedRefs: { orderItemsCacheRef, mesasLengthRef, hasLoadedOnceRef, isPendingEmptyRelease },
  });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos
    void loadData();
    void preloadRpcCompatibility();
  }, [loadData]);

  const mutations = useMesaOrderMutations({
    order: orderState,
    auth: { businessId: context?.businessId, source: context?.source, session },
    lockOps: { heldMesaLockRef, publishMesaLockBroadcast, acquireMesaLockForEdition, releaseHeldMesaLock },
    broadcastOps: { publishMesaStateBroadcast, bumpMesaActionVersion, isMesaActionVersionCurrent, beginPendingEmptyRelease, endPendingEmptyRelease, isPendingEmptyRelease },
    orderServices: { loadOpenOrderSnapshot, addCatalogItemToOrder, syncOrderItemQuantity, removeOrderItemFromOrder, persistOrderSnapshot, closeOrderSingle, closeOrderAsSplit },
    dataLoader: { patchMesaOrderTotal, publishRealtimeOrderSummary, loadData },
    globalSetters: { setError, setMesas, markMesaAsAvailableAfterSale },
    printOps: { beginPrintFlow, endPrintFlow, buildCashBreakdown: buildCashBreakdownForCountry },
    callbacks: {
      onOrderSaved: () => {
        toast.showSuccess(toastMessages.mesas.updated());
      },
      onOrderClosed: (mesaLabel, total) => {
        toast.showSuccess(toastMessages.ventas.confirmed(mesaLabel, formatCop(total)));
      },
      onKitchenPrinted: () => {
        toast.showSuccess(toastMessages.mesas.orderSent());
      },
      onNoKitchenItems: () => {
        toast.showWarning({
          title: t('mesas:toast.noKitchenItems.title', 'Sin productos de cocina'),
          message: t(
            'mesas:toast.noKitchenItems.message',
            "No hay productos de la categoría 'Platos' para imprimir",
          ),
        });
      },
      onNoPrinterConnected: () => {
        toast.showError({
          title: t('mesas:toast.noPrinter.title', 'Sin impresora'),
          message: t(
            'mesas:toast.noPrinter.message',
            'No hay una impresora conectada. Ve a Configuración > Impresión para conectar una.',
          ),
        });
      },
      onPrintError: (error: string) => {
        toast.showError({
          title: t('mesas:toast.printError.title', 'Error de impresión'),
          message: error,
        });
      },
    },
  });

  const {
    closeOrderModal: closeOrderModalBase,
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
  } = mutations;

  useMesaAutoSave({
    hasPendingChanges,
    onSave: handleSaveOrder,
    enabled: showOrderModal && !isSavingOrder && !isClosingOrder,
  });

  const closeOrderModal = useCallback(() => {
    setActiveOrderId(null);
    closeOrderModalBase();
  }, [setActiveOrderId, closeOrderModalBase]);

  const {
    showDeleteMesaModal,
    mesaToDelete,
    isDeletingMesa,
    askDeleteMesa,
    confirmDeleteMesa,
    handleCancelDeleteMesa,
  } = useMesaDeleteModal({
    context,
    selectedMesa,
    setMesas,
    closeOrderModal,
    setError,
    showDeletedToast: (label: string) => toast.showSuccess(toastMessages.mesas.deleted(label)),
  });

  const {
    handleSplitBill,
    handleCloseCloseOrderChoice,
    handleClosePayment,
    handleTogglePaymentMenu,
    handlePaymentMethodChange,
    handleBackFromSplitBill,
    handleCloseSplitBill,
  } = usePaymentFlow({
    isClosingOrder,
    releasingEmptyOrder,
    orderTotal,
    amountReceived,
    setShowCloseOrderChoiceModal,
    setShowPaymentModal,
    setShowPaymentMethodMenu,
    setShowSplitBillModal,
    setShowOrderModal,
    setPaymentMethod,
    setAmountReceived,
  });

  const handleDismissOrderModal = useCallback(() => {
    if (isClosingOrder || releasingEmptyOrder || isSavingOrder) return;

    if (orderItems.length === 0) {
      void releaseEmptyOrderAndClose();
      return;
    }

    if (selectedMesa?.id && selectedMesa.current_order_id) {
      patchMesaOrderTotal(selectedMesa.id, selectedMesa.current_order_id, orderTotal);
      const currentUnits = sumOrderItemsQuantity(orderItems);
      publishRealtimeOrderSummary(
        selectedMesa,
        selectedMesa.current_order_id,
        orderTotal,
        currentUnits,
        'optimistic',
      );
    }
    closeOrderModal();
  }, [
    closeOrderModal,
    isClosingOrder,
    isSavingOrder,
    orderItems,
    orderTotal,
    patchMesaOrderTotal,
    publishRealtimeOrderSummary,
    releaseEmptyOrderAndClose,
    releasingEmptyOrder,
    selectedMesa,
  ]);

  const { handleOpenClose } = useMesaOpenClose({
    session,
    context,
    selectedMesa,
    setSelectedMesa,
    setMesas,
    setOrderItems,
    setLoadingOrder,
    setOrderModalError,
    setShowOrderModal,
    setError,
    setActingMesaId,
    setActiveOrderId,
    closeOrderModal,
    openOrderModal,
    acquireMesaLockForEdition,
    ensureCatalogLoaded,
    publishMesaStateBroadcast,
    bumpMesaActionVersion,
    isMesaActionVersionCurrent,
    isPendingEmptyRelease,
    orderItemsCacheRef,
    orderModalOpenIntentRef,
  });

  const handleMesaPress = useCallback(
    (
      mesa: MesaRecord,
      { occupied, lockedByOther }: { occupied: boolean; lockedByOther: boolean },
    ) => {
      if (lockedByOther) {
        setError(MESA_IN_USE_MESSAGE);
        return;
      }
      if (occupied) {
        setActingMesaId(mesa.id);
        const orderId = String(mesa.current_order_id || '').trim() || null;
        if (orderId) setActiveOrderId(orderId);
        void openOrderModal(mesa).finally(() => {
          setActingMesaId((current) => (current === mesa.id ? null : current));
        });
      } else {
        void handleOpenClose(mesa, 'open');
      }
    },
    [handleOpenClose, openOrderModal, setActiveOrderId],
  );

  const handleCatalogItemPress = useCallback(
    (item: MesaOrderCatalogItem) => {
      Keyboard.dismiss();
      void handleAddCatalogItem(item);
    },
    [handleAddCatalogItem],
  );

  const handleOpenAddMesa = useCallback(() => {
    setShowCreateMesaModal(true);
    setNewTableNumber('');
  }, [setShowCreateMesaModal, setNewTableNumber]);

  const handleCancelCreateMesa = useCallback(() => {
    setShowCreateMesaModal(false);
    setNewTableNumber('');
  }, [setShowCreateMesaModal, setNewTableNumber]);

  const memoizedOrderState = useMemo(
    () => ({
      selectedMesa,
      orderModalTitle,
      orderTotal,
      orderItems,
      filteredCatalog,
      searchCatalog,
      isCatalogLoading,
      loadingOrder,
      isSavingOrder,
      isClosingOrder,
      releasingEmptyOrder,
      isPrintInProgress,
      mutatingOrderItemId,
      insufficientItems,
      insufficientComboComponents,
      hasPendingChanges,
    }),
    [
      selectedMesa,
      orderModalTitle,
      orderTotal,
      orderItems,
      filteredCatalog,
      searchCatalog,
      isCatalogLoading,
      loadingOrder,
      isSavingOrder,
      isClosingOrder,
      releasingEmptyOrder,
      isPrintInProgress,
      mutatingOrderItemId,
      insufficientItems,
      insufficientComboComponents,
      hasPendingChanges,
    ],
  );

  const memoizedActions = useMemo(
    () => ({
      onDismiss: handleDismissOrderModal,
      onSaveOrder: handleSaveOrder,
      onPrintKitchen: handlePrintKitchen,
      onCloseOrder: handleCloseOrder,
      onCatalogItemPress: handleCatalogItemPress,
      onUpdateOrderItemQuantity: handleUpdateOrderItemQuantity,
      onSearchChange: setSearchCatalog,
      resolveOrderItemDisplayName,
    }),
    [
      handleDismissOrderModal,
      handleSaveOrder,
      handlePrintKitchen,
      handleCloseOrder,
      handleCatalogItemPress,
      handleUpdateOrderItemQuantity,
      setSearchCatalog,
      resolveOrderItemDisplayName,
    ],
  );

  return (
    <>
      <View style={styles.mesasContainer}>
        <MesasPanelHeader isCreatingMesa={isCreatingMesa} onOpenAddMesa={handleOpenAddMesa} canCreateMesa={canDeleteMesas} />

        <View style={styles.mesasPanelDivider} />

        <MesasGrid
          mesas={mesas}
          loading={loading}
          actingMesaId={actingMesaId}
          canDeleteMesas={canDeleteMesas}
          mesaLocksByTableId={mesaLocksByTableId}
          heldMesaLock={heldMesaLock}
          contextBusinessId={context?.businessId}
          sessionUserId={session.user.id}
          onMesaPress={handleMesaPress}
          onDeleteMesa={canDeleteMesas ? askDeleteMesa : undefined}
        />
      </View>

      <MesasModals
        session={session}
        context={context}
        isKeyboardVisible={isKeyboardVisible}
        showCreateMesaModal={showCreateMesaModal}
        isCreatingMesa={isCreatingMesa}
        newTableNumber={newTableNumber}
        mesaPreviewName={mesaPreviewName}
        onChangeNumber={setNewTableNumber}
        onSubmitCreateMesa={handleCreateMesa}
        onCancelCreateMesa={handleCancelCreateMesa}
        showDeleteMesaModal={showDeleteMesaModal}
        mesaToDelete={mesaToDelete}
        isDeletingMesa={isDeletingMesa}
        onCancelDeleteMesa={handleCancelDeleteMesa}
        onConfirmDeleteMesa={confirmDeleteMesa}
        showOrderModal={showOrderModal}
        orderState={memoizedOrderState}
        actions={memoizedActions}
        showCloseOrderChoiceModal={showCloseOrderChoiceModal}
        orderTotal={orderTotal}
        isClosingOrder={isClosingOrder}
        releasingEmptyOrder={releasingEmptyOrder}
        onCloseCloseOrderChoice={handleCloseCloseOrderChoice}
        onPayAllTogether={handlePayAllTogether}
        onSplitBill={handleSplitBill}
        showPaymentModal={showPaymentModal}
        paymentMethod={paymentMethod}
        amountReceived={amountReceived}
        cashChangeData={cashChangeData}
        showPaymentMethodMenu={showPaymentMethodMenu}
        onClosePayment={handleClosePayment}
        onTogglePaymentMenu={handleTogglePaymentMenu}
        onPaymentMethodChange={handlePaymentMethodChange}
        onAmountReceivedChange={setAmountReceived}
        onConfirmPayment={processPaymentAndClose}
        showSplitBillModal={showSplitBillModal}
        orderItems={orderItems}
        resolveItemName={resolveOrderItemDisplayName}
        isClosingSplitBill={isClosingOrder}
        onBackSplitBill={handleBackFromSplitBill}
        onCloseSplitBill={handleCloseSplitBill}
        onConfirmSplitBill={processSplitPaymentAndClose}
      />
    </>
  );
}

const styles = StyleSheet.create({
  mesasContainer: {
    marginTop: 24,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#D9DEE8',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    overflow: 'hidden',
  },
  mesasPanelDivider: {
    height: 1,
    backgroundColor: '#E3E8EF',
  },
});
