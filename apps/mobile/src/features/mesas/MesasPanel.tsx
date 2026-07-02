import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { STOCKY_COLORS } from '../../theme/tokens';

import { StockyStatusToast } from '../../ui/StockyStatusToast';
import { PrintReceiptConfirmModal } from '../../ui/PrintReceiptConfirmModal';
import {
  addCatalogItemToOrder,
  getOrderItemName,
  listCatalogItems,
  loadOpenOrderSnapshot,
  persistOrderSnapshot,
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
import { type VentaDetailRecord, type VentaRecord } from '../../services/ventasService';
import { SplitBillModalRN } from './SplitBillModalRN';

import { useMesaToasts } from './hooks/useMesaToasts';
import { useMesaOrderState } from './hooks/useMesaOrderState';
import { useMesaEditLock } from './hooks/useMesaEditLock';
import { useMesaRealtime } from './hooks/useMesaRealtime';
import { useMesaOrderMutations } from './hooks/useMesaOrderMutations';
import { useMesaPrint } from './hooks/useMesaPrint';
import { useMesaCreate } from './hooks/useMesaCreate';
import { MesasGrid } from './components/MesasGrid';
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
  console.warn(`[mesa-sync] ${label}`, safeData);
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
  const [context, setContext] = useState<BusinessContext | null>(null);
  const [mesas, setMesas] = useState<MesaRecord[]>([]);
  const mesasLengthRef = useRef(0);
  const hasLoadedOnceRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [_error, setError] = useState<string | null>(null);
  const [actingMesaId, setActingMesaId] = useState<string | null>(null);

  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  const [showDeleteMesaModal, setShowDeleteMesaModal] = useState(false);
  const [mesaToDelete, setMesaToDelete] = useState<MesaRecord | null>(null);
  const [isDeletingMesa, setIsDeletingMesa] = useState(false);

  const selectedMesaIdRef = useRef<string>('');
  const mesaActionVersionRef = useRef<Record<string, number>>({});

  const [actorDisplayName, setActorDisplayName] = useState(() =>
    resolveSessionDisplayName(session),
  );
  const sessionDisplayName = useMemo(() => resolveSessionDisplayName(session), [session]);
  const canDeleteMesas = context?.source !== 'employee';

  const toasts = useMesaToasts();
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
  } = orderState;

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

  const mesaPrint = useMesaPrint({ setOrderModalError });
  const {
    showPrintModal,
    setShowPrintModal,
    setPrintSalesData,
    isPrintingReceipt,
    printCustomerName,
    setPrintCustomerName,
    isPrintInProgress,
    beginPrintFlow,
    endPrintFlow,
    handlePrintConfirm,
    handlePrintCancel,
  } = mesaPrint;

  const mesaCreate = useMesaCreate({
    context,
    onCreated: (createdMesa) => {
      setMesas((prev) => [...prev, createdMesa].sort(compareMesaTableIdentifiers));
      toasts.showCreatedToast(mesaDisplayName(createdMesa));
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
  } = realtime;

  const bumpMesaActionVersion = useCallback((mesaId: string) => {
    const normalizedMesaId = String(mesaId || '').trim();
    if (!normalizedMesaId) return 0;
    const current = Number(mesaActionVersionRef.current[normalizedMesaId] || 0);
    const next = current + 1;
    mesaActionVersionRef.current[normalizedMesaId] = next;
    return next;
  }, []);

  const isMesaActionVersionCurrent = useCallback((mesaId: string, version: number) => {
    const normalizedMesaId = String(mesaId || '').trim();
    if (!normalizedMesaId) return false;
    return Number(mesaActionVersionRef.current[normalizedMesaId] || 0) === Number(version || 0);
  }, []);

  const sendMesaSyncBroadcast = useCallback(
    (event: string, payload: Record<string, unknown>) => {
      const channel = mesasSyncBroadcastChannelRef.current;
      if (!channel) return;

      const message = {
        type: 'broadcast',
        event,
        payload,
      } as const;

      const canHttpSend = typeof channel?.httpSend === 'function';
      const isReady = mesasSyncBroadcastReadyRef.current === true;

      if (!isReady && canHttpSend) {
        void channel.httpSend(message);
        return;
      }

      const sendResult = channel.send(message);
      if (sendResult && typeof sendResult.then === 'function') {
        void sendResult.catch(() => {
          if (canHttpSend) {
            return channel.httpSend(message);
          }
          return undefined;
        });
      }
    },
    [mesasSyncBroadcastChannelRef, mesasSyncBroadcastReadyRef],
  );

  const loadData = useCallback(async () => {
    const shouldShowLoading = mesasLengthRef.current === 0 && !hasLoadedOnceRef.current;
    if (shouldShowLoading) {
      setLoading(true);
    }
    setError(null);

    try {
      const nextContext = businessContext?.businessId
        ? businessContext
        : await resolveBusinessContext(session.user.id);
      if (!nextContext?.businessId) {
        setContext(null);
        setMesas([]);
        setMesaLocksByTableId({});
        orderItemsCacheRef.current.clear();
        setError('No se encontro un negocio asociado a esta cuenta.');
        return;
      }

      setContext(nextContext);
      const fallbackName = sessionDisplayName;
      void resolveMesaEditorDisplayName({
        businessId: nextContext.businessId,
        userId: session.user.id,
        fallbackName,
      })
        .then((name) => {
          setActorDisplayName(name);
        })
        .catch(() => {
          setActorDisplayName(fallbackName);
        });
      if (catalogBusinessIdRef.current !== nextContext.businessId) {
        catalogBusinessIdRef.current = null;
        catalogUpdatedAtRef.current = 0;
        setCatalogItems([]);
        orderItemsCacheRef.current.clear();
      }
      void readCatalogFromStorage(nextContext.businessId)
        .then((cached) => {
          if (!cached) return;
          if (
            catalogBusinessIdRef.current === nextContext.businessId &&
            catalogItemsRef.current.length > 0
          ) {
            return;
          }
          catalogBusinessIdRef.current = nextContext.businessId;
          catalogUpdatedAtRef.current = cached.cachedAt || 0;
          setCatalogItems(cached.items);
        })
        .catch(() => {
          // no-op
        });
      void ensureCatalogLoaded(nextContext.businessId).catch(() => {
        // no-op: no bloquear carga de mesas por catalogo
      });

      const initialFetchStart = Date.now();
      const nextMesas = await fetchMesasByBusinessId(nextContext.businessId);
      traceAsyncDuration('initial_fetch_mesas', initialFetchStart, {
        businessId: nextContext.businessId,
        rows: Array.isArray(nextMesas) ? nextMesas.length : 0,
      });
      const sortedMesas = nextMesas.sort(compareMesaTableIdentifiers);
      setMesas(sortedMesas);
      void refreshMesaLocks(nextContext.businessId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las mesas.');
    } finally {
      hasLoadedOnceRef.current = true;
      if (shouldShowLoading) {
        setLoading(false);
      }
    }
  }, [
    businessContext,
    catalogBusinessIdRef,
    catalogItemsRef,
    catalogUpdatedAtRef,
    ensureCatalogLoaded,
    orderItemsCacheRef,
    refreshMesaLocks,
    session.user.id,
    sessionDisplayName,
    setCatalogItems,
    setMesaLocksByTableId,
    traceAsyncDuration,
  ]);

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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos
    void loadData();
  }, [loadData]);

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
    traceMesaSync('ui_painted', {
      source: trace.source,
      eventType: trace.eventType,
      rowRef: trace.rowRef,
      commitLagMs: trace.commitLagMs,
      uiLagMs,
    });
    pendingUiTraceRef.current = null;
  }, [mesas, pendingUiTraceRef]);

  useEffect(() => {
    const held = heldMesaLockRef.current;
    const activeBusinessId = String(context?.businessId || '').trim();
    if (!held) return;
    if (!activeBusinessId || held.businessId !== activeBusinessId) {
      void releaseHeldMesaLock(held);
    }
  }, [context?.businessId, heldMesaLockRef, releaseHeldMesaLock]);

  useEffect(() => {
    latestOrderItemsRef.current = orderItems;
  }, [latestOrderItemsRef, orderItems]);

  useEffect(() => {
    catalogItemsRef.current = catalogItems;
  }, [catalogItems, catalogItemsRef]);

  useEffect(() => {
    const onShow = Keyboard.addListener('keyboardDidShow', () => {
      setIsKeyboardVisible(true);
    });
    const onHide = Keyboard.addListener('keyboardDidHide', () => {
      setIsKeyboardVisible(false);
    });

    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, []);

  useEffect(() => {
    const orderId = String(selectedMesa?.current_order_id || '').trim();
    if (!orderId) return;
    orderItemsCacheRef.current.set(orderId, orderItems);
  }, [orderItems, orderItemsCacheRef, selectedMesa?.current_order_id]);

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

  const patchMesaOrderTotal = useCallback(
    (mesaId: string, orderId: string, total: number) => {
      setMesas((prev) =>
        prev.map((mesa) => {
          if (mesa.id !== mesaId) return mesa;
          return {
            ...mesa,
            status: 'occupied',
            current_order_id: orderId,
            orders: {
              ...(mesa.orders || {}),
              id: orderId,
              total,
            },
          };
        }),
      );

      setSelectedMesa((prev) => {
        if (!prev || prev.id !== mesaId) return prev;
        return {
          ...prev,
          status: 'occupied',
          current_order_id: orderId,
          orders: {
            ...(prev.orders || {}),
            id: orderId,
            total,
          },
        };
      });
    },
    [setSelectedMesa],
  );

  const publishRealtimeOrderSummary = useCallback(
    (
      mesa: MesaRecord | null | undefined,
      orderId: string,
      total: number,
      units: number,
      mode: 'optimistic' | 'confirmed' | 'rollback' = 'optimistic',
    ) => {
      const normalizedMesaId = String(mesa?.id || '').trim();
      const normalizedOrderId = String(orderId || '').trim();
      const normalizedBusinessId = String(mesa?.business_id || context?.businessId || '').trim();
      if (!normalizedMesaId || !normalizedOrderId || !normalizedBusinessId) return;

      publishMesaStateBroadcast(
        {
          id: normalizedMesaId,
          business_id: normalizedBusinessId,
          status: 'occupied',
          current_order_id: normalizedOrderId,
          table_number: mesa?.table_number ?? null,
          table_name: mesa?.table_name ?? null,
          orders: {
            id: normalizedOrderId,
            status: 'open',
            total: Number(total || 0),
          },
        },
        {
          previousOrderId: normalizedOrderId,
          mode,
          orderUnits: Math.max(0, Math.floor(Number(units || 0))),
        },
      );
    },
    [context?.businessId, publishMesaStateBroadcast],
  );

  const askDeleteMesa = useCallback(
    (mesa: MesaRecord) => {
      if (context?.source === 'employee') {
        setError('No tienes permisos para eliminar mesas.');
        return;
      }
      setMesaToDelete(mesa);
      setShowDeleteMesaModal(true);
    },
    [context?.source],
  );

  const markMesaAsAvailableAfterSale = useCallback(
    (mesaId: string) => {
      let orderIdToClear = '';
      let mesaBusinessId = String(context?.businessId || '').trim();
      let mesaTableNumber: string | number | null | undefined = null;
      let mesaTableName: string | null | undefined = null;
      setMesas((prev) => {
        const target = prev.find((mesa) => mesa.id === mesaId) || null;
        orderIdToClear = String(target?.current_order_id || '').trim();
        mesaBusinessId = String(target?.business_id || mesaBusinessId || '').trim();
        mesaTableNumber = target?.table_number;
        mesaTableName = target?.table_name;
        return prev.map((mesa) =>
          mesa.id === mesaId
            ? {
                ...mesa,
                status: 'available',
                current_order_id: null,
                orders: null,
              }
            : mesa,
        );
      });
      if (orderIdToClear) {
        orderItemsCacheRef.current.delete(orderIdToClear);
      }

      publishMesaStateBroadcast(
        {
          id: mesaId,
          business_id: mesaBusinessId,
          status: 'available',
          current_order_id: null,
          table_number: mesaTableNumber ?? null,
          table_name: mesaTableName ?? null,
          orders: null,
        },
        {
          previousOrderId: orderIdToClear || null,
        },
      );
    },
    [context?.businessId, orderItemsCacheRef, publishMesaStateBroadcast],
  );

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
    buildCashBreakdown,
    setPrintSalesData,
    setShowPrintModal,
  });

  const {
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
  } = mutations;

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

  const confirmDeleteMesa = useCallback(async () => {
    if (context?.source === 'employee') {
      setError('No tienes permisos para eliminar mesas.');
      return;
    }
    if (!context?.businessId || !mesaToDelete) return;

    setIsDeletingMesa(true);
    setError(null);

    try {
      const deletedLabel = mesaDisplayName(mesaToDelete);
      await deleteMesaCascade({
        businessId: context.businessId,
        tableId: mesaToDelete.id,
      });

      setMesas((prev) => prev.filter((mesa) => mesa.id !== mesaToDelete.id));
      if (selectedMesa?.id === mesaToDelete.id) {
        closeOrderModal();
      }

      setShowDeleteMesaModal(false);
      setMesaToDelete(null);
      toasts.showDeletedToast(deletedLabel);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la mesa.');
    } finally {
      setIsDeletingMesa(false);
    }
  }, [closeOrderModal, context, mesaToDelete, selectedMesa, toasts]);

  const handleOpenClose = useCallback(
    async (mesa: MesaRecord, action: 'open' | 'close') => {
      if (!session.access_token) {
        setError('No hay token de sesión activo para ejecutar la acción.');
        return;
      }

      setActingMesaId(mesa.id);
      if (action === 'open') {
        orderModalOpenIntentRef.current = true;
      }
      setError(null);
      const previousOrderId = String(mesa.current_order_id || '').trim() || null;
      const actionVersion = bumpMesaActionVersion(mesa.id);

      if (action === 'open') {
        const lockAcquired = await acquireMesaLockForEdition(mesa);
        if (!lockAcquired) {
          setActingMesaId(null);
          return;
        }
      }

      const optimisticMesa: MesaRecord =
        action === 'open'
          ? {
              ...mesa,
              status: 'occupied',
              orders: {
                ...(mesa.orders || {}),
                status: 'open',
              },
            }
          : {
              ...mesa,
              status: 'available',
              current_order_id: null,
              orders: null,
            };

      publishMesaStateBroadcast(optimisticMesa, {
        previousOrderId,
        mode: 'optimistic',
      });

      if (action === 'open') {
        setSelectedMesa({
          ...mesa,
          status: 'occupied',
        });
        setOrderItems([]);
        setOrderModalError(null);
        setShowOrderModal(true);
        setLoadingOrder(true);
        if (context?.businessId) {
          void ensureCatalogLoaded(context.businessId, { forceRefresh: true }).catch(() => {
            // no-op: no bloquear apertura por catalogo
          });
        }
      }

      try {
        const updatedMesa = await openCloseMesa({
          accessToken: session.access_token,
          userId: session.user.id,
          tableId: mesa.id,
          action,
        });

        if (!isMesaActionVersionCurrent(mesa.id, actionVersion)) {
          return;
        }

        const mergedMesa: MesaRecord = {
          ...mesa,
          ...updatedMesa,
          table_number: updatedMesa.table_number ?? mesa.table_number,
          table_name: updatedMesa.table_name ?? mesa.table_name,
          orders: {
            ...(mesa.orders || {}),
            ...(updatedMesa.orders || {}),
          },
        };

        setMesas((prev) =>
          prev
            .map((row) => (row.id === mergedMesa.id ? mergedMesa : row))
            .sort(compareMesaTableIdentifiers),
        );
        publishMesaStateBroadcast(mergedMesa, {
          previousOrderId,
          mode: 'confirmed',
        });

        if (action === 'open') {
          if (mergedMesa.current_order_id) {
            const openedOrderId = String(mergedMesa.current_order_id || '').trim();
            if (openedOrderId) {
              orderItemsCacheRef.current.set(openedOrderId, []);
            }
            if (orderModalOpenIntentRef.current) {
              void openOrderModal(mergedMesa, {
                skipOrderItemsFetch: true,
                initialItems: [],
              });
            }
          } else {
            closeOrderModal();
            setError('La mesa se abrio, pero no se encontro una orden activa.');
          }
        } else if (selectedMesa?.id === mergedMesa.id) {
          closeOrderModal();
        }
      } catch (err) {
        if (action === 'open') {
          closeOrderModal();
        }
        publishMesaStateBroadcast(mesa, {
          previousOrderId,
          mode: 'rollback',
        });
        setError(err instanceof Error ? err.message : 'No se pudo actualizar la mesa.');
      } finally {
        setActingMesaId((current) => (current === mesa.id ? null : current));
      }
    },
    [
      acquireMesaLockForEdition,
      bumpMesaActionVersion,
      closeOrderModal,
      context,
      ensureCatalogLoaded,
      isMesaActionVersionCurrent,
      openOrderModal,
      orderItemsCacheRef,
      orderModalOpenIntentRef,
      publishMesaStateBroadcast,
      selectedMesa,
      session.access_token,
      session.user.id,
      setLoadingOrder,
      setOrderItems,
      setOrderModalError,
      setSelectedMesa,
      setShowOrderModal,
    ],
  );

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
        void openOrderModal(mesa).finally(() => {
          setActingMesaId((current) => (current === mesa.id ? null : current));
        });
      } else {
        void handleOpenClose(mesa, 'open');
      }
    },
    [handleOpenClose, openOrderModal],
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

  const handleSplitBill = useCallback(() => {
    setShowCloseOrderChoiceModal(false);
    setShowPaymentModal(false);
    setShowPaymentMethodMenu(false);
    setShowSplitBillModal(true);
  }, [
    setShowCloseOrderChoiceModal,
    setShowPaymentMethodMenu,
    setShowPaymentModal,
    setShowSplitBillModal,
  ]);

  const handleOpenAddMesa = useCallback(() => {
    setShowCreateMesaModal(true);
    setNewTableNumber('');
  }, [setShowCreateMesaModal, setNewTableNumber]);

  const handleCancelCreateMesa = useCallback(() => {
    setShowCreateMesaModal(false);
    setNewTableNumber('');
  }, [setShowCreateMesaModal, setNewTableNumber]);

  const handleCancelDeleteMesa = useCallback(() => {
    if (!isDeletingMesa) {
      setShowDeleteMesaModal(false);
      setMesaToDelete(null);
    }
  }, [isDeletingMesa, setShowDeleteMesaModal, setMesaToDelete]);

  const handleCloseCloseOrderChoice = useCallback(() => {
    if (isClosingOrder || releasingEmptyOrder) return;
    setShowCloseOrderChoiceModal(false);
    setShowOrderModal(true);
  }, [isClosingOrder, releasingEmptyOrder, setShowCloseOrderChoiceModal, setShowOrderModal]);

  const handleClosePayment = useCallback(() => {
    if (!isClosingOrder) {
      setShowPaymentMethodMenu(false);
      setShowPaymentModal(false);
      setShowCloseOrderChoiceModal(true);
    }
  }, [isClosingOrder, setShowPaymentMethodMenu, setShowPaymentModal, setShowCloseOrderChoiceModal]);

  const handleTogglePaymentMenu = useCallback(() => {
    setShowPaymentMethodMenu((prev) => !prev);
  }, [setShowPaymentMethodMenu]);

  const handlePaymentMethodChange = useCallback(
    (method: string) => {
      setPaymentMethod(method as 'cash' | 'card' | 'transfer');
      if (method === 'cash' && String(amountReceived || '').trim() === '') {
        setAmountReceived(String(Math.round(orderTotal || 0)));
      }
    },
    [amountReceived, orderTotal, setAmountReceived, setPaymentMethod],
  );

  const handleBackFromSplitBill = useCallback(() => {
    setShowSplitBillModal(false);
    setShowCloseOrderChoiceModal(true);
  }, [setShowSplitBillModal, setShowCloseOrderChoiceModal]);

  const handleCloseSplitBill = useCallback(() => {
    if (isClosingOrder) return;
    setShowSplitBillModal(false);
    setShowCloseOrderChoiceModal(false);
    setShowOrderModal(true);
  }, [isClosingOrder, setShowSplitBillModal, setShowCloseOrderChoiceModal, setShowOrderModal]);

  const handleCloseMesaCreatedToast = useCallback(() => {
    toasts.setShowMesaCreatedToast(false);
  }, [toasts]);

  const handleCloseMesaDeletedToast = useCallback(() => {
    toasts.setShowMesaDeletedToast(false);
  }, [toasts]);

  const handleCloseSaleToast = useCallback(() => {
    toasts.setShowSaleToast(false);
  }, [toasts]);

  const handleCloseMesaSavedToast = useCallback(() => {
    toasts.setShowMesaSavedToast(false);
  }, [toasts]);

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
        <View style={styles.mesasPanelHeader}>
          <View style={styles.mesasPanelTitleRow}>
            <LinearGradient
              colors={['#4F46E5', '#7C3AED']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.mesasPanelIcon}
            >
              <Ionicons name="layers-outline" size={30} color={STOCKY_COLORS.white} />
            </LinearGradient>
            <Text style={styles.mesasPanelTitle} numberOfLines={2}>
              Gestión de Mesas
            </Text>
          </View>

          <Pressable
            style={styles.addMesaButtonWrap}
            onPress={handleOpenAddMesa}
            disabled={isCreatingMesa}
          >
            <LinearGradient
              colors={isCreatingMesa ? ['#7D8AA7', '#9CA3AF'] : ['#4F46E5', '#7C3AED']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.addMesaButton}
            >
              <Ionicons name="add" size={16} color={STOCKY_COLORS.white} />
              <Text style={styles.addMesaButtonText}>Agregar Mesa</Text>
            </LinearGradient>
          </Pressable>
        </View>

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

      <CreateMesaModal
        visible={showCreateMesaModal}
        isCreatingMesa={isCreatingMesa}
        newTableNumber={newTableNumber}
        mesaPreviewName={mesaPreviewName}
        isKeyboardVisible={isKeyboardVisible}
        onChangeNumber={setNewTableNumber}
        onSubmit={handleCreateMesa}
        onCancel={handleCancelCreateMesa}
      />

      <DeleteMesaModal
        visible={showDeleteMesaModal}
        mesaToDelete={mesaToDelete}
        isDeletingMesa={isDeletingMesa}
        onCancel={handleCancelDeleteMesa}
        onConfirm={confirmDeleteMesa}
      />

      <OrderModal
        visible={showOrderModal}
        session={session}
        context={context}
        orderState={memoizedOrderState}
        actions={memoizedActions}
        isKeyboardVisible={isKeyboardVisible}
      />

      <CloseOrderChoiceModal
        visible={showCloseOrderChoiceModal}
        orderTotal={orderTotal}
        isClosingOrder={isClosingOrder}
        releasingEmptyOrder={releasingEmptyOrder}
        onClose={handleCloseCloseOrderChoice}
        onPayAllTogether={handlePayAllTogether}
        onSplitBill={handleSplitBill}
      />

      <PaymentModal
        visible={showPaymentModal}
        isClosing={isClosingOrder}
        paymentMethod={paymentMethod}
        amountReceived={amountReceived}
        orderTotal={orderTotal}
        cashChangeData={cashChangeData}
        showMenu={showPaymentMethodMenu}
        onClose={handleClosePayment}
        onToggleMenu={handleTogglePaymentMenu}
        onPaymentMethodChange={handlePaymentMethodChange}
        onAmountReceivedChange={setAmountReceived}
        onConfirm={processPaymentAndClose}
      />

      <SplitBillModalRN
        visible={showSplitBillModal}
        orderItems={orderItems}
        submitting={isClosingOrder}
        onBack={handleBackFromSplitBill}
        onClose={handleCloseSplitBill}
        onConfirm={processSplitPaymentAndClose}
      />
      <StockyStatusToast
        visible={toasts.showMesaCreatedToast}
        title="Mesa Creada"
        primaryLabel="Mesa"
        primaryValue={toasts.mesaCreatedLabel}
        secondaryLabel="Estado"
        secondaryValue="Disponible"
        durationMs={1000}
        onClose={handleCloseMesaCreatedToast}
      />
      <StockyStatusToast
        visible={toasts.showMesaDeletedToast}
        title="Mesa Eliminada"
        primaryLabel="Mesa"
        primaryValue={toasts.mesaDeletedLabel}
        secondaryLabel="Estado"
        secondaryValue="Eliminada"
        durationMs={1000}
        onClose={handleCloseMesaDeletedToast}
      />
      <StockyStatusToast
        visible={toasts.showSaleToast}
        title="Venta Confirmada"
        primaryLabel="Mesa"
        primaryValue={toasts.saleMesaLabel}
        secondaryLabel="Total"
        secondaryValue={toasts.saleTotalLabel}
        durationMs={1000}
        onClose={handleCloseSaleToast}
      />
      <StockyStatusToast
        visible={toasts.showMesaSavedToast}
        title="Mesa Actualizada"
        primaryLabel="Mesa"
        primaryValue={toasts.mesaSavedLabel}
        secondaryLabel="Estado"
        secondaryValue="Actualizada"
        durationMs={1000}
        onClose={handleCloseMesaSavedToast}
      />
      <PrintReceiptConfirmModal
        visible={showPrintModal}
        onConfirm={handlePrintConfirm}
        onCancel={handlePrintCancel}
        isLoading={isPrintingReceipt}
        customerName={printCustomerName}
        onCustomerNameChange={setPrintCustomerName}
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
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 10,
    elevation: 7,
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
