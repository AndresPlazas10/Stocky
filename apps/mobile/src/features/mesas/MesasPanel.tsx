import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Session } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { STOCKY_COLORS } from '../../theme/tokens';
import { formatCop } from '../../utils/money';

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
import { SplitBillModalRN } from './SplitBillModalRN';

import { useMesaOrderState } from './hooks/useMesaOrderState';
import { useMesaEditLock } from './hooks/useMesaEditLock';
import { useMesaRealtime } from './hooks/useMesaRealtime';
import { useMesaOrderMutations } from './hooks/useMesaOrderMutations';
import { useMesaPrint } from './hooks/useMesaPrint';
import { useMesaCreate } from './hooks/useMesaCreate';
import { useMesaRefSync } from './hooks/useMesaRefSync';
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
} from './utils/mesaHelpers';

type Props = {
  session: Session;
  businessContext?: BusinessContext | null;
};

const CATALOG_LOCAL_TTL_MS = 180_000;
const CATALOG_STORAGE_PREFIX = 'stocky:mesa-catalog:';
const MESA_SYNC_TRACE_ENABLED = __DEV__;

function traceMesaSync(label: string, data: Record<string, unknown>) {
  if (!MESA_SYNC_TRACE_ENABLED) return;
  const safeData = Object.entries(data || {}).reduce<Record<string, unknown>>(
    (acc, [key, value]) => {
      if (value === undefined) return acc;
      acc[key] = value;
      return acc;
    },
    {},
  );
  if (__DEV__) console.warn(`[mesa-sync] ${label}`, safeData);
}

type StoredCatalogSnapshot = {
  cachedAt: number;
  items: MesaOrderCatalogItem[];
};

async function readCatalogFromStorage(businessId: string): Promise<StoredCatalogSnapshot | null> {
  const storageKey = `${CATALOG_STORAGE_PREFIX}${businessId}`;
  try {
    const raw = await AsyncStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredCatalogSnapshot;
    if (!parsed || !Array.isArray(parsed.items)) return null;
    const cachedAt = Number(parsed.cachedAt || 0);
    return {
      cachedAt: Number.isFinite(cachedAt) ? cachedAt : 0,
      items: parsed.items,
    };
  } catch {
    return null;
  }
}

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
    onLockLost: () => {
      setShowOrderModal(false);
      setSelectedMesa(null);
      setOrderItems([]);
      setOrderModalError(null);
      setSearchCatalog('');
      setIsSearchFocused(false);
      setMutatingOrderItemId(null);
    },
    onCloseAuxiliaryOrderModals: () => {
      setShowCloseOrderChoiceModal(false);
      setShowPaymentModal(false);
      setShowSplitBillModal(false);
      setPaymentMethod('cash');
      setAmountReceived('');
    },
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

  const realtime = useMesaRealtime({
    businessId: String(context?.businessId || ''),
    userId: session.user.id,
    isOrderFlowActive,
    setMesas,
    setMesaLocksByTableId,
    setSelectedMesa,
    setShowOrderModal,
    setShowCloseOrderChoiceModal,
    setShowPaymentModal,
    setShowSplitBillModal,
    setShowPaymentMethodMenu,
    setPaymentMethod,
    setAmountReceived,
    setOrderItems,
    setSearchCatalog,
    setIsSearchFocused,
    setMutatingOrderItemId,
    setOrderModalError,
    publishMesaLockBroadcast,
    selectedMesaIdRef,
    heldMesaLockRef,
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
    sendMesaSyncBroadcast,
  } = useMesaActionBroadcast({
    mesasSyncBroadcastChannelRef,
    mesasSyncBroadcastReadyRef,
  });

  // Set sendBroadcastRef so useMesaEditLock can send broadcasts via the realtime channel
  useEffect(() => {
    sendBroadcastRef.current = (event: string, payload: Record<string, unknown>) => {
      const channel = mesasSyncBroadcastChannelRef.current;
      if (!channel) return;
      (channel as { send: (msg: unknown) => void }).send({ type: 'broadcast', event, payload });
    };
  }, [mesasSyncBroadcastChannelRef]);

  useMesaRefSync({
    selectedMesaId: selectedMesa?.id ?? undefined,
    mesas,
    orderItems,
    catalogItems,
    currentOrderId: selectedMesa?.current_order_id ?? undefined,
    pendingUiTraceRef,
    latestOrderItemsRef,
    catalogItemsRef,
    orderItemsCacheRef,
    selectedMesaIdRef,
    mesasLengthRef,
  });

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
            setShowOrderModal(false);
            setShowCloseOrderChoiceModal(false);
            setShowPaymentModal(false);
            setShowSplitBillModal(false);
            setShowPaymentMethodMenu(false);
            setPaymentMethod('cash');
            setAmountReceived('');
            setSelectedMesa(null);
            setOrderItems([]);
            setSearchCatalog('');
            setIsSearchFocused(false);
            setMutatingOrderItemId(null);
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
    refreshMesaLocks,
    releaseHeldMesaLock,
    session.user.id,
    setAmountReceived,
    setIsSearchFocused,
    setMesaLocksByTableId,
    setMutatingOrderItemId,
    setOrderItems,
    setPaymentMethod,
    setSearchCatalog,
    setSelectedMesa,
    setShowCloseOrderChoiceModal,
    setShowOrderModal,
    setShowPaymentMethodMenu,
    setShowPaymentModal,
    setShowSplitBillModal,
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
    session,
    businessContext,
    sessionDisplayName,
    setContext,
    setMesas,
    setLoading,
    setError,
    setActorDisplayName,
    setCatalogItems,
    setMesaLocksByTableId,
    ensureCatalogLoaded,
    publishMesaStateBroadcast,
    traceAsyncDuration,
    readCatalogFromStorage,
    refreshMesaLocks,
    heldMesaLockRef,
    releaseHeldMesaLock,
    catalogBusinessIdRef,
    catalogUpdatedAtRef,
    catalogItemsRef,
    orderItemsCacheRef,
    mesasLengthRef,
    hasLoadedOnceRef,
    realtimeClientInstanceIdRef,
    actorDisplayName,
  });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos
    void loadData();
    void preloadRpcCompatibility();
  }, [loadData]);

  const mutations = useMesaOrderMutations({
    order: orderState,
    businessId: context?.businessId,
    source: context?.source,
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
    patchMesaOrderTotal,
    publishRealtimeOrderSummary,
    setError,
    setMesas,
    markMesaAsAvailableAfterSale,
    loadData,
    beginPrintFlow,
    endPrintFlow,
    buildCashBreakdown: buildCashBreakdownForCountry,
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
      if (isKeyboardVisible) {
        Keyboard.dismiss();
        return;
      }
      void handleAddCatalogItem(item);
    },
    [handleAddCatalogItem, isKeyboardVisible],
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
        <MesasPanelHeader isCreatingMesa={isCreatingMesa} onOpenAddMesa={handleOpenAddMesa} />

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
  mesasPanelHeader: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  mesasPanelTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  mesasPanelIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#5B33D6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 5,
  },
  mesasPanelTitle: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
    flexShrink: 1,
  },
  addMesaButtonWrap: {
    minWidth: 136,
    flexShrink: 0,
    marginLeft: 8,
  },
  addMesaButton: {
    minHeight: 40,
    borderRadius: 12,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: '#5B33D6',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  addMesaButtonText: {
    color: STOCKY_COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
  mesasPanelDivider: {
    height: 1,
    backgroundColor: '#E3E8EF',
  },
});
