import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { isAdminRole } from '../../utils/roles.js';
import { formatPrice } from '../../utils/formatters';
import {
  getAuthenticatedUser as getAuthenticatedUserFromOrders,
  getEmployeeRoleInBusiness as getEmployeeRoleInBusinessForOrders,
  isEmployeeInBusiness as isEmployeeInBusinessForOrders,
} from '../../data/queries/authQueries';
import { deleteTableCascadeOrders } from '../../data/commands/ordersCommands';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { SaleSuccessAlert } from '../ui/SaleSuccessAlert';
import { SaleErrorAlert } from '../ui/SaleErrorAlert';
import { SaleUpdateAlert } from '../ui/SaleUpdateAlert';
import { PrintReceiptConfirmModal } from '../ui/PrintReceiptConfirmModal';
import { MesaPaymentModal } from './MesaPaymentModal';
import { MesaDeleteModal } from './MesaDeleteModal';
import { MesaOrderFooter } from './MesaOrderFooter';
import { MesaCatalogSearch } from './MesaCatalogSearch';
import { MesaOrderItemsGrid } from './MesaOrderItemsGrid';
import {
  Plus,
  Layers,
  X,
  ShoppingCart,
  CheckCircle2,
} from 'lucide-react';
import SplitBillModal from './SplitBillModal';
import { AsyncStateWrapper } from '../../ui/system/async-state/index.js';
import { normalizeTableRecord } from '../../utils/tableStatus';
import {
  isOfflineMode,
  isOfflinePersistenceEnabled,
  saveOfflineSnapshot,
} from '../../utils/offlineSnapshot.js';
import { useLowMotionMode } from '../../hooks/useLowMotionMode.js';
import { useProgressiveList } from '../../hooks/useProgressiveList.js';
import { useRafBatchedQueue } from '../../hooks/useRafBatchedQueue.js';
import { useDebounce } from '../../hooks/optimized.js';
import { useCloseOrderLocks } from '../../hooks/useCloseOrderLocks.js';
import { useMesaCatalog } from '../../hooks/useMesaCatalog.js';

import { calcularCambio } from '../../utils/cambio.js';
import { supabase } from '../../supabase/Client';
import {
  normalizeEntityId,
  getTotalProductUnits,
  calculateOrderItemsTotal,
  compareTableIdentifiers,
  getOrderItemRenderKey,
  getOrderItemName,
  MESA_IN_USE_MESSAGE,
  MESAS_REMOTE_FALLBACK_POLL_MS,
  MESA_LOCK_HEARTBEAT_MS,
  ORDER_ITEM_TYPE,
} from './mesas/mesaHelpers.js';
import MesasGrid from './mesas/MesasGrid.jsx';
import { useMesaEditLocks } from './mesas/useMesaEditLocks.js';
import { useMesaRealtime } from './mesas/useMesaRealtime.js';
import { useMesaOrderOperations } from './mesas/useMesaOrderOperations.js';
import { useMesaPayment } from './mesas/useMesaPayment.js';

function Mesas({ businessId, userRole = 'admin' }) {
  const canManageTables = isAdminRole(userRole);
  const [mesas, setMesas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [successDetails, setSuccessDetails] = useState([]);
  const [successTitle, setSuccessTitle] = useState('✨ Acción Completada');
  const [alertType, setAlertType] = useState('success');
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedMesa, setSelectedMesa] = useState(null);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  const [modalOpenIntent, setModalOpenIntent] = useState(false);
  const [isEmployee, setIsEmployee] = useState(false);

  const [orderItems, setOrderItems] = useState([]);
  const [, setPendingQuantityUpdates] = useState({});
  const [productos, setProductos] = useState([]);
  const [combos, setCombos] = useState([]);
  const [searchProduct, setSearchProduct] = useState('');
  const debouncedSearch = useDebounce(searchProduct, 200);

  const { acquireCloseOrderLock, releaseCloseOrderLock } = useCloseOrderLocks();
  const { loadCombos, ensureCatalogWarmup } = useMesaCatalog({
    businessId, setProductos, setCombos, setError,
  });
  const [currentUser, setCurrentUser] = useState(null);
  const [quantityToAdd, setQuantityToAdd] = useState(1);

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCloseOrderChoiceModal, setShowCloseOrderChoiceModal] = useState(false);
  const [showSplitBillModal, setShowSplitBillModal] = useState(false);
  const [isGeneratingSplitSales, setIsGeneratingSplitSales] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [amountReceived, setAmountReceived] = useState('');
  const [amountReceivedError, setAmountReceivedError] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [clientes, setClientes] = useState([]);
  const [isClosingOrder, setIsClosingOrder] = useState(false);
  const [isCreatingTable, setIsCreatingTable] = useState(false);
  const [pendingOrderItemOps, setPendingOrderItemOps] = useState(0);
  const [newTableNumber, setNewTableNumber] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [mesaToDelete, setMesaToDelete] = useState(null);

  const [canShowOrderModal, setCanShowOrderModal] = useState(true);
  const isOrderItemsSyncing = pendingOrderItemOps > 0;

  const [showPrintModal, setShowPrintModal] = useState(false);
  const [_printSaleIds, setPrintSaleIds] = useState([]);
  const [printSaleDataList, setPrintSaleDataList] = useState([]);
  const [isPrintingReceipt, setIsPrintingReceipt] = useState(false);
  const [printCustomerName, setPrintCustomerName] = useState('Venta general');

  const lowMotionMode = useLowMotionMode();
  const enqueueRealtimeUpdate = useRafBatchedQueue({ useTransition: false });
  const {
    visibleItems: visibleMesas,
    hasMore: hasMoreMesas,
    totalCount: totalMesas,
    sentinelRef: mesasSentinelRef,
    loadMore: loadMoreMesas,
  } = useProgressiveList(mesas, {
    initialCount: lowMotionMode ? 12 : 20,
    step: lowMotionMode ? 12 : 20,
    resetKey: `${mesas.length}:${lowMotionMode ? 'low' : 'full'}`,
  });

  const mesasLengthRef = useRef(0);
  const hasLoadedOnceRef = useRef(false);
  const pendingQuantityUpdatesRef = useRef({});
  const orderItemsDirtyRef = useRef(false);
  const orderItemsRef = useRef([]);
  const selectedMesaRef = useRef(null);
  const productCatalogByIdRef = useRef(new Map());
  const comboCatalogByIdRef = useRef(new Map());
  const orderDetailsRequestRef = useRef(0);
  const lastSyncedOrderTotalsRef = useRef({});
  const pendingRemoteOrderTotalsRef = useRef({});
  const orderTotalSyncQueueRef = useRef({});
  const optimisticTempItemQuantitiesRef = useRef({});
  const pendingOrderItemOpsRef = useRef(0);
  const orderItemWriteQueueRef = useRef({});
  const mesasSnapshotTimerRef = useRef(null);
  const mesaOpenDebugRef = useRef({ stage: 'idle', ts: null });

  const mesaSyncBroadcastChannelRef = useRef(null);
  const mesaSyncBroadcastReadyRef = useRef(false);
  const mesaSyncClientIdRef = useRef(
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : 'cl-' + Date.now().toString(36),
  );
  const activeMesaBroadcastRef = useRef(null);
  const heldMesaLockRef = useRef(null);
  const mesaLockHeartbeatTimerRef = useRef(null);
  const justCompletedSaleRef = useRef(false);

  const isOfflineFirstRuntime = isOfflineMode() && isOfflinePersistenceEnabled();

  const setPendingQuantityUpdatesSafe = useCallback((updater) => {
    const prev = pendingQuantityUpdatesRef.current || {};
    const next = typeof updater === 'function' ? updater(prev) : updater;
    const normalizedNext = next && typeof next === 'object' ? next : {};
    pendingQuantityUpdatesRef.current = normalizedNext;
    setPendingQuantityUpdates(normalizedNext);
  }, []);

  const setMesaOpenDebugStage = useCallback((stage) => {
    mesaOpenDebugRef.current = {
      stage: String(stage || 'unknown'),
      ts: new Date().toISOString(),
    };
  }, []);

  const buildMesaOpenDebugTag = useCallback((errorLike, mesa) => {
    const dbg = mesaOpenDebugRef.current || {};
    const mesaId = normalizeEntityId(mesa?.id) || 'na';
    const navOnline = (typeof navigator !== 'undefined' && navigator.onLine === false) ? '0' : '1';
    const runtimeOffline = isOfflineMode() ? '1' : '0';
    const persistence = isOfflinePersistenceEnabled() ? '1' : '0';
    const msg = String(errorLike?.message || errorLike || 'unknown').replace(/\s+/g, ' ').slice(0, 80);
    return `MESA_OPEN_DBG|stage=${dbg.stage || 'na'}|mesa=${mesaId}|online=${navOnline}|offline=${runtimeOffline}|persist=${persistence}|msg=${msg}`;
  }, []);

  const sendMesaSyncBroadcast = useCallback((event, payload) => {
    const channel = mesaSyncBroadcastChannelRef.current;
    if (!channel) return;
    const message = { type: 'broadcast', event, payload };
    const canHttpSend = typeof channel?.httpSend === 'function';
    const isReady = mesaSyncBroadcastReadyRef.current === true;
    if (!isReady && canHttpSend) {
      void channel.httpSend(message);
      return;
    }
    const sendResult = channel.send(message);
    if (sendResult && typeof sendResult.then === 'function') {
      void sendResult.catch(() => {
        if (canHttpSend) return channel.httpSend(message);
        return undefined;
      });
    }
  }, []);

  const publishMesaLockBroadcast = useCallback(({
    tableId, locked, mode = 'optimistic', lockToken = null,
  }) => {
    const normalizedBusinessId = String(businessId || '').trim();
    const normalizedTableId = String(tableId || '').trim();
    if (!normalizedBusinessId || !normalizedTableId) return;
    const resolvedUserId = normalizeEntityId(currentUser?.id);
    if (!resolvedUserId) return;
    const lockTtlMs = 45_000;
    const lockExpiresAt = locked
      ? new Date(Date.now() + lockTtlMs).toISOString()
      : null;
    sendMesaSyncBroadcast('mesa_lock_changed', {
      sender_user_id: resolvedUserId,
      sender_client_id: mesaSyncClientIdRef.current,
      mesa_id: normalizedTableId,
      business_id: normalizedBusinessId,
      locked: Boolean(locked),
      mode,
      lock_owner_user_id: locked ? resolvedUserId : null,
      lock_token: lockToken,
      lock_expires_at: lockExpiresAt,
      lock_ttl_ms: locked ? lockTtlMs : null,
      emitted_at: Date.now(),
    });
  }, [businessId, currentUser?.id, sendMesaSyncBroadcast]);

  const markOrderItemOpStarted = useCallback(() => {
    pendingOrderItemOpsRef.current += 1;
    setPendingOrderItemOps((prev) => prev + 1);
  }, []);

  const markOrderItemOpFinished = useCallback(() => {
    pendingOrderItemOpsRef.current = Math.max(pendingOrderItemOpsRef.current - 1, 0);
    setPendingOrderItemOps((prev) => Math.max(prev - 1, 0));
  }, []);

  const waitForPendingOrderItemOps = useCallback(async ({ timeoutMs = 2000, pollMs = 40 } = {}) => {
    const startedAt = Date.now();
    while (
      pendingOrderItemOpsRef.current > 0
      && (Date.now() - startedAt) < timeoutMs
    ) {
      await new Promise((resolve) => setTimeout(resolve, pollMs));
    }
    return pendingOrderItemOpsRef.current <= 0;
  }, []);

  const enqueueOrderItemWrite = useCallback((itemId, task) => {
    const normalizedItemId = String(itemId || '').trim();
    if (!normalizedItemId || typeof task !== 'function') return Promise.resolve(null);
    const queueByItem = orderItemWriteQueueRef.current || {};
    const previous = queueByItem[normalizedItemId] || Promise.resolve();
    const next = previous.catch(() => {}).then(() => task());
    queueByItem[normalizedItemId] = next;
    orderItemWriteQueueRef.current = queueByItem;
    return next.finally(() => {
      if (orderItemWriteQueueRef.current?.[normalizedItemId] === next) {
        delete orderItemWriteQueueRef.current[normalizedItemId];
      }
    });
  }, []);

  const getCurrentUser = useCallback(async () => {
    try {
      const user = await getAuthenticatedUserFromOrders();
      if (user) {
        const normalizedUser = {
          id: user.id,
          email: user.email || '',
          name: user.user_metadata?.full_name || user.user_metadata?.name || '',
          role: 'admin',
        };
        setCurrentUser(normalizedUser);
        return normalizedUser;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  const checkIfEmployee = useCallback(async () => {
    try {
      const user = await getAuthenticatedUserFromOrders();
      if (!user) {
        setIsEmployee(false);
        return;
      }
      const employeeInBusiness = await isEmployeeInBusinessForOrders({ userId: user.id, businessId });
      if (!employeeInBusiness) {
        setIsEmployee(false);
        return;
      }
      const role = await getEmployeeRoleInBusinessForOrders({ userId: user.id, businessId });
      const hasAdminPrivileges = isAdminRole(role);
      setIsEmployee(!hasAdminPrivileges);
    } catch {
      setIsEmployee(false);
    }
  }, [businessId]);

  const loadClientes = useCallback(async () => {
    setClientes([]);
  }, []);

  // ── Memoized Values (needed by hooks) ──
  const comboById = useMemo(() => {
    const map = new Map();
    combos.forEach((combo) => map.set(combo.id, combo));
    return map;
  }, [combos]);

  const catalogItems = useMemo(() => {
    const productItems = productos.map((producto) => ({
      item_type: ORDER_ITEM_TYPE.PRODUCT,
      id: producto.id,
      product_id: producto.id,
      combo_id: null,
      name: producto.name,
      code: producto.code || '',
      sale_price: Number(producto.sale_price || 0),
      stock: Number(producto.stock || 0),
      manage_stock: producto.manage_stock !== false,
    }));
    const comboItems = combos.map((combo) => ({
      item_type: ORDER_ITEM_TYPE.COMBO,
      id: combo.id,
      product_id: null,
      combo_id: combo.id,
      name: combo.nombre,
      code: `COMBO-${String(combo.id).slice(0, 4).toUpperCase()}`,
      sale_price: Number(combo.precio_venta || 0),
      stock: null,
      combo_items: combo.combo_items || [],
    }));
    return [...comboItems, ...productItems];
  }, [productos, combos]);

  // ── Edit Locks Hook ──
  const {
    getMesaLockState,
    acquireMesaEditLockWeb,
    refreshMesaEditLockHeartbeatWeb,
    releaseMesaEditLockWeb,
    refreshMesaLocks,
    applyRealtimeMesaLockRow,
    applyRealtimeMesaLockBroadcast,
  } = useMesaEditLocks({
    businessId,
    currentUser,
    isOfflineFirstRuntime,
    heldMesaLockRef,
    mesaSyncClientIdRef,
    activeMesaBroadcastRef,
    mesaLockHeartbeatTimerRef,
  });

  // ── Realtime Hook ──
  useMesaRealtime({
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
  });

  // ── Order Operations Hook ──
  const {
    handleCreateTable,
    loadOrderDetails,
    handleOpenTable,
    addCatalogItemToOrder,
    updateItemQuantity,
    handleRefreshOrder,
    handleCloseModal,
    updateOrderTotal,
    flushPendingRemoteOrderTotals,
    releaseEmptyOrderAndCloseModal,
    loadMesas,
  } = useMesaOrderOperations({
    businessId,
    userRole,
    mesas,
    setMesas,
    selectedMesa,
    setSelectedMesa,
    showOrderDetails,
    setShowOrderDetails,
    orderItems,
    setOrderItems,
    setPendingQuantityUpdatesSafe,
    productos,
    combos,
    catalogItems,
    productCatalogByIdRef,
    comboCatalogByIdRef,
    pendingQuantityUpdatesRef,
    orderItemsDirtyRef,
    orderItemsRef,
    selectedMesaRef,
    orderDetailsRequestRef,
    pendingRemoteOrderTotalsRef,
    orderTotalSyncQueueRef,
    lastSyncedOrderTotalsRef,
    optimisticTempItemQuantitiesRef,
    pendingOrderItemOpsRef,
    orderItemWriteQueueRef,
    markOrderItemOpStarted,
    markOrderItemOpFinished,
    waitForPendingOrderItemOps,
    enqueueOrderItemWrite,
    acquireMesaEditLockWeb,
    releaseMesaEditLockWeb,
    sendMesaSyncBroadcast,
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
    showAddForm,
    setShowAddForm,
    modalOpenIntent,
    setModalOpenIntent,
    canShowOrderModal,
    setCanShowOrderModal,
    quantityToAdd,
    setQuantityToAdd,
    searchProduct,
    setSearchProduct,
    canManageTables,
    isEmployee,
    currentUser,
    getCurrentUser,
    activeMesaBroadcastRef,
    heldMesaLockRef,
    mesaSyncClientIdRef,
    getMesaLockState,
  });

  // ── Payment Hook ──
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
    userRole,
    currentUser,
    mesas,
    setMesas,
    selectedMesa,
    setSelectedMesa,
    orderItems,
    setOrderItems,
    paymentMethod,
    setPaymentMethod,
    amountReceived,
    setAmountReceived,
    amountReceivedError,
    setAmountReceivedError,
    selectedCustomer,
    setSelectedCustomer,
    clientes,
    setClientes,
    isClosingOrder,
    setIsClosingOrder,
    setIsGeneratingSplitSales,
    showPaymentModal,
    setShowPaymentModal,
    showSplitBillModal,
    setShowSplitBillModal,
    showCloseOrderChoiceModal,
    setShowCloseOrderChoiceModal,
    showPrintModal,
    setShowPrintModal,
    printSaleDataList,
    setPrintSaleDataList,
    isPrintingReceipt,
    setIsPrintingReceipt,
    printCustomerName,
    setPrintCustomerName,
    setPrintSaleIds,
    pendingOrderItemOps,
    justCompletedSaleRef,
    acquireCloseOrderLock,
    releaseCloseOrderLock,
    acquireMesaEditLockWeb,
    releaseMesaEditLockWeb,
    refreshMesaLocks,
    applyRealtimeMesaLockRow,
    sendMesaSyncBroadcast,
    publishMesaLockBroadcast,
    loadMesas,
    loadOrderDetails,
    updateOrderTotal,
    flushPendingRemoteOrderTotals,
    waitForPendingOrderItemOps,
    persistPendingQuantityUpdates: handleRefreshOrder,
    releaseEmptyOrderAndCloseModal,
    setSuccess,
    setSuccessTitle,
    setSuccessDetails,
    setAlertType,
    setError,
    productCatalogByIdRef,
    comboCatalogByIdRef,
    pendingQuantityUpdatesRef,
    orderItemsDirtyRef,
    orderItemsRef,
    setModalOpenIntent,
    setShowOrderDetails,
    setCanShowOrderModal,
    insufficientItems,
    hasInsufficientComboStock,
    insufficientComboComponents,
    orderTotal,
    setPendingQuantityUpdatesSafe,
    setProductos,
  });

  // ── Ref Sync Effects ──
  useEffect(() => {
    orderItemsRef.current = Array.isArray(orderItems) ? orderItems : [];
  }, [orderItems]);

  useEffect(() => {
    selectedMesaRef.current = selectedMesa || null;
  }, [selectedMesa]);

  useEffect(() => {
    mesasLengthRef.current = Array.isArray(mesas) ? mesas.length : 0;
  }, [mesas]);

  // ── Lock Release on Modal Close ──
  useEffect(() => {
    if (showOrderDetails) return;
    const active = activeMesaBroadcastRef.current;
    const held = heldMesaLockRef.current;
    if (!active?.tableId && !held?.tableId) return;
    if (active?.tableId) {
      publishMesaLockBroadcast({
        tableId: active.tableId,
        locked: false,
        mode: 'confirmed',
        lockToken: active.lockToken || null,
      });
    }
    if (held?.tableId && held?.businessId) {
      void releaseMesaEditLockWeb({
        targetBusinessId: held.businessId,
        tableId: held.tableId,
        lockToken: held.lockToken || null,
      });
    }
    activeMesaBroadcastRef.current = null;
    heldMesaLockRef.current = null;
  }, [publishMesaLockBroadcast, releaseMesaEditLockWeb, showOrderDetails]);

  useEffect(() => () => {
    const active = activeMesaBroadcastRef.current;
    const held = heldMesaLockRef.current;
    if (!active?.tableId && !held?.tableId) return;
    if (active?.tableId) {
      publishMesaLockBroadcast({
        tableId: active.tableId,
        locked: false,
        mode: 'confirmed',
        lockToken: active.lockToken || null,
      });
    }
    if (held?.tableId && held?.businessId) {
      void releaseMesaEditLockWeb({
        targetBusinessId: held.businessId,
        tableId: held.tableId,
        lockToken: held.lockToken || null,
      });
    }
    activeMesaBroadcastRef.current = null;
    heldMesaLockRef.current = null;
  }, [publishMesaLockBroadcast, releaseMesaEditLockWeb]);

  // ── Lock Heartbeat ──
  useEffect(() => {
    if (!showOrderDetails) return undefined;
    if (mesaLockHeartbeatTimerRef.current) {
      clearInterval(mesaLockHeartbeatTimerRef.current);
      mesaLockHeartbeatTimerRef.current = null;
    }
    mesaLockHeartbeatTimerRef.current = setInterval(() => {
      const held = heldMesaLockRef.current;
      if (!held?.businessId || !held?.tableId) return;
      void refreshMesaEditLockHeartbeatWeb({
        targetBusinessId: held.businessId,
        tableId: held.tableId,
        lockToken: held.lockToken || null,
      }).then((result) => {
        if (!result || result.unsupported) return;
        if (!result.ok && result.lost) {
          heldMesaLockRef.current = null;
        }
      });
    }, MESA_LOCK_HEARTBEAT_MS);
    return () => {
      if (mesaLockHeartbeatTimerRef.current) {
        clearInterval(mesaLockHeartbeatTimerRef.current);
        mesaLockHeartbeatTimerRef.current = null;
      }
    };
  }, [refreshMesaEditLockHeartbeatWeb, showOrderDetails]);

  useEffect(() => {
    if (!canManageTables && showAddForm) {
      setShowAddForm(false);
    }
  }, [canManageTables, showAddForm]);

  useEffect(() => {
    const productMap = new Map();
    (Array.isArray(productos) ? productos : []).forEach((product) => {
      const productId = normalizeEntityId(product?.id);
      if (productId) productMap.set(productId, product);
    });
    productCatalogByIdRef.current = productMap;
  }, [productos]);

  useEffect(() => {
    const comboMap = new Map();
    (Array.isArray(combos) ? combos : []).forEach((combo) => {
      const comboId = normalizeEntityId(combo?.id);
      if (comboId) comboMap.set(comboId, combo);
    });
    comboCatalogByIdRef.current = comboMap;
  }, [combos]);

  // ── Initial Load ──
  useEffect(() => {
    if (businessId) {
      const loadData = async () => {
        try {
          const shouldShowLoading = mesasLengthRef.current === 0 && !hasLoadedOnceRef.current;
          if (shouldShowLoading) setLoading(true);
          await Promise.all([loadMesas(), loadClientes()]);
        } catch {
          setError('⚠️ No se pudo cargar la información de las mesas. Por favor, intenta recargar la página.');
        } finally {
          hasLoadedOnceRef.current = true;
          setLoading(false);
        }
      };
      loadData();
      getCurrentUser();
      checkIfEmployee();
    }
  }, [businessId, loadMesas, loadClientes, getCurrentUser, checkIfEmployee]);

  useEffect(() => {
    if (!businessId) {
      return;
    }
    refreshMesaLocks(businessId);
  }, [businessId, refreshMesaLocks]);

  // ── Broadcast Channel ──
  useEffect(() => {
    if (!businessId) return undefined;
    const channel = supabase
      .channel(`private:mobile-mesas-sync:${businessId}`)
      .on('broadcast', { event: 'mesa_lock_changed' }, ({ payload }) => {
        applyRealtimeMesaLockBroadcast(payload);
      });
    channel.subscribe((status) => {
      mesaSyncBroadcastReadyRef.current = status === 'SUBSCRIBED';
    });
    mesaSyncBroadcastChannelRef.current = channel;
    return () => {
      mesaSyncBroadcastReadyRef.current = false;
      if (mesaSyncBroadcastChannelRef.current) {
        supabase.removeChannel(mesaSyncBroadcastChannelRef.current);
        mesaSyncBroadcastChannelRef.current = null;
      }
    };
  }, [applyRealtimeMesaLockBroadcast, businessId]);

  // ── Remote Sync Polling ──
  useEffect(() => {
    if (!businessId) return undefined;
    const syncFromRemote = () => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      loadMesas().catch(() => {});
    };
    const handleVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        syncFromRemote();
      }
    };
    const timer = setInterval(syncFromRemote, MESAS_REMOTE_FALLBACK_POLL_MS);
    window.addEventListener('online', syncFromRemote);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(timer);
      window.removeEventListener('online', syncFromRemote);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [businessId, loadMesas]);

  // ── Snapshot Save ──
  useEffect(() => {
    if (!businessId || !Array.isArray(mesas)) return undefined;
    const runSnapshotSave = () => {
      const normalizedForSnapshot = mesas.map(normalizeTableRecord).sort(compareTableIdentifiers);
      saveOfflineSnapshot(`mesas.list:${businessId}`, normalizedForSnapshot);
    };
    if (mesasSnapshotTimerRef.current) {
      const { type, id } = mesasSnapshotTimerRef.current;
      if (type === 'idle' && typeof window !== 'undefined' && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(id);
      } else {
        clearTimeout(id);
      }
    }
    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
      const idleId = window.requestIdleCallback(runSnapshotSave, { timeout: 800 });
      mesasSnapshotTimerRef.current = { type: 'idle', id: idleId };
    } else {
      const timeoutId = setTimeout(runSnapshotSave, 200);
      mesasSnapshotTimerRef.current = { type: 'timeout', id: timeoutId };
    }
    return () => {
      if (!mesasSnapshotTimerRef.current) return;
      const { type, id } = mesasSnapshotTimerRef.current;
      if (type === 'idle' && typeof window !== 'undefined' && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(id);
      } else {
        clearTimeout(id);
      }
      mesasSnapshotTimerRef.current = null;
    };
  }, [businessId, mesas]);

  // ── Flush Pending Remote Totals ──
  useEffect(() => {
    if (!businessId) return undefined;
    const flushIfVisible = () => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      flushPendingRemoteOrderTotals().catch(() => {});
    };
    const handleVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        flushIfVisible();
      }
    };
    const timer = setInterval(flushIfVisible, MESAS_REMOTE_FALLBACK_POLL_MS);
    window.addEventListener('online', flushIfVisible);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(timer);
      window.removeEventListener('online', flushIfVisible);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [businessId, flushPendingRemoteOrderTotals]);

  // ── Additional Memoized Values ──
  const filteredCatalog = useMemo(() => {
    if (!debouncedSearch.trim()) return [];
    const search = debouncedSearch.toLowerCase();
    return catalogItems
      .filter((item) =>
        item.name.toLowerCase().includes(search) ||
        item.code.toLowerCase().includes(search)
      );
  }, [debouncedSearch, catalogItems]);

  const {
    visibleItems: visibleFilteredCatalog,
    hasMore: hasMoreFilteredCatalog,
    totalCount: totalFilteredCatalog,
    sentinelRef: filteredCatalogSentinelRef,
    loadMore: loadMoreFilteredCatalog,
  } = useProgressiveList(filteredCatalog, {
    initialCount: lowMotionMode ? 8 : 12,
    step: lowMotionMode ? 8 : 12,
    rootMargin: '220px',
    resetKey: `${searchProduct.trim().toLowerCase()}:${filteredCatalog.length}:${lowMotionMode ? 'low' : 'full'}`,
  });

  const {
    visibleItems: visibleOrderItems,
    hasMore: hasMoreOrderItems,
    totalCount: totalOrderItems,
    sentinelRef: orderItemsSentinelRef,
    loadMore: loadMoreOrderItems,
  } = useProgressiveList(orderItems, {
    initialCount: lowMotionMode ? 10 : 16,
    step: lowMotionMode ? 8 : 14,
    rootMargin: '240px',
    resetKey: `${selectedMesa?.id || 'none'}:${orderItems.length}:${lowMotionMode ? 'low' : 'full'}`,
  });

  const orderTotal = useMemo(() => calculateOrderItemsTotal(orderItems), [orderItems]);

  const cambioPago = useMemo(() => {
    if (paymentMethod !== 'cash') return null;
    if (amountReceived === '' || amountReceived === null) {
      return { isValid: false, reason: 'empty', change: 0, breakdown: [] };
    }
    return calcularCambio(orderTotal, amountReceived);
  }, [paymentMethod, orderTotal, amountReceived]);

  const isCashPaymentInvalid = useMemo(() => (
    paymentMethod === 'cash'
    && amountReceived !== ''
    && cambioPago
    && !cambioPago.isValid
  ), [paymentMethod, amountReceived, cambioPago]);

  const productById = useMemo(() => {
    const map = new Map();
    productos.forEach((product) => {
      const productId = normalizeEntityId(product?.id);
      if (productId) map.set(productId, product);
    });
    return map;
  }, [productos]);

  const insufficientItems = useMemo(() => {
    if (!orderItems || orderItems.length === 0) return [];
    return orderItems
      .filter((item) => !item.combo_id)
      .map((item) => {
        const prod = productById.get(normalizeEntityId(item?.product_id));
        if (!prod || prod.manage_stock === false) return null;
        return prod ? { ...item, available_stock: prod.stock, product_name: prod.name } : null;
      })
      .filter(Boolean)
      .filter((i) => typeof i.available_stock === 'number' && i.quantity > i.available_stock);
  }, [orderItems, productById]);

  const insufficientComboComponents = useMemo(() => {
    if (!orderItems || orderItems.length === 0) return [];
    const requiredByProduct = new Map();
    orderItems.forEach((item) => {
      if (!item?.combo_id) return;
      const combo = comboById.get(item.combo_id);
      if (!combo) return;
      const comboQty = Number(item.quantity || 0);
      if (!Number.isFinite(comboQty) || comboQty <= 0) return;
      (combo.combo_items || []).forEach((component) => {
        const productId = component?.producto_id;
        if (!productId) return;
        const componentQty = Number(component?.cantidad || 0);
        if (!Number.isFinite(componentQty) || componentQty <= 0) return;
        const currentRequired = Number(requiredByProduct.get(productId) || 0);
        requiredByProduct.set(productId, currentRequired + (comboQty * componentQty));
      });
    });
    const shortages = [];
    requiredByProduct.forEach((requiredQty, productId) => {
      const product = productById.get(normalizeEntityId(productId));
      if (product?.manage_stock === false) return;
      const stock = Number(product?.stock || 0);
      if (stock >= requiredQty) return;
      shortages.push({
        product_id: productId,
        product_name: product?.name || 'Producto',
        available_stock: stock,
        required_quantity: requiredQty,
      });
    });
    return shortages;
  }, [orderItems, comboById, productById]);

  const hasInsufficientComboStock = insufficientComboComponents.length > 0;

  useEffect(() => {
    let errorTimer, successTimer;
    if (error) errorTimer = setTimeout(() => setError(null), 5000);
    if (success) successTimer = setTimeout(() => setSuccess(null), 5000);
    return () => {
      if (errorTimer) clearTimeout(errorTimer);
      if (successTimer) clearTimeout(successTimer);
    };
  }, [error, success]);

  // ── Render ──
  return (
    <AsyncStateWrapper
      loading={loading}
      error={mesas.length === 0 ? error : null}
      dataCount={mesas.length}
      onRetry={() => {
        const loadData = async () => {
          try {
            const shouldShowLoading = mesasLengthRef.current === 0 && !hasLoadedOnceRef.current;
            if (shouldShowLoading) setLoading(true);
            await Promise.all([loadMesas(), loadClientes()]);
          } catch {
            setError('⚠️ No se pudo cargar la información de las mesas. Por favor, intenta recargar la página.');
          } finally {
            hasLoadedOnceRef.current = true;
            setLoading(false);
          }
        };
        loadData();
      }}
      skeletonType="mesas"
      emptyTitle="Aun no hay mesas creadas"
      emptyDescription="Crea tu primera mesa para empezar a registrar ordenes."
      emptyAction={canManageTables ? (
        <Button
          type="button"
          onClick={() => setShowAddForm(true)}
          className="gradient-primary text-white hover:opacity-90 transition-all duration-300 shadow-lg font-semibold px-4 py-2 rounded-xl"
        >
          Crear Primera Mesa
        </Button>
      ) : null}
      bypassStateRendering={showAddForm}
    >
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="space-y-6"
      >
        <Card className="border-accent-200 shadow-lg">
          <CardHeader className="border-b border-accent-100 bg-gradient-to-r from-primary-50 to-accent-50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl font-bold text-primary-900 flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center">
                  <Layers className="w-6 h-6 text-white" />
                </div>
                Gestión de Mesas
              </CardTitle>
              {canManageTables && (
                <Button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="gradient-primary text-white hover:opacity-90 text-sm sm:text-base px-3 sm:px-4 h-9 sm:h-11"
                >
                  <Plus className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2" />
                  Agregar Mesa
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent className="pt-6">
            <AnimatePresence>
              <SaleUpdateAlert
                key="split-sales-loading"
                isVisible={isGeneratingSplitSales}
                onClose={() => {}}
                title="Generando ventas..."
                details={[]}
                duration={600000}
              />
              <SaleUpdateAlert
                key="order-close-loading"
                isVisible={isClosingOrder && !isGeneratingSplitSales}
                onClose={() => {}}
                title="Generando venta..."
                details={[]}
                duration={600000}
              />
              <SaleSuccessAlert
                key="sale-success"
                isVisible={success && alertType === 'success'}
                onClose={() => setSuccess(false)}
                title={successTitle}
                details={successDetails}
                duration={6000}
              />
              <SaleSuccessAlert
                key="table-update-success"
                isVisible={success && alertType === 'update'}
                onClose={() => setSuccess(false)}
                title={successTitle}
                details={successDetails}
                duration={5000}
              />
              <SaleErrorAlert
                key="sale-error"
                isVisible={!!error}
                onClose={() => setError(null)}
                title="❌ Error"
                message={error || ''}
                details={[]}
                duration={7000}
              />
              <PrintReceiptConfirmModal
                key="print-receipt-confirm"
                isOpen={showPrintModal}
                onConfirm={handlePrintConfirm}
                onCancel={handlePrintCancel}
                isLoading={isPrintingReceipt}
                customerName={printCustomerName}
                onCustomerNameChange={setPrintCustomerName}
              />
            </AnimatePresence>

            <AnimatePresence>
              {showAddForm && canManageTables && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-6"
                >
                  <Card className="border-accent-200 bg-accent-50/30">
                    <CardContent className="pt-6">
                      <form onSubmit={handleCreateTable} className="flex flex-col sm:flex-row gap-4 sm:items-end">
                        <div className="flex-1">
                          <label className="block text-sm font-semibold text-primary-700 mb-2">
                            Identificador de Mesa *
                          </label>
                          <Input
                            type="text"
                            value={newTableNumber}
                            onChange={(e) => setNewTableNumber(e.target.value)}
                            placeholder="Ej: 1, A1, Terraza-2..."
                            className="h-12 border-accent-300"
                            required
                          />
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                          <Button
                            type="submit"
                            disabled={isCreatingTable}
                            className="gradient-primary text-white h-12 w-full sm:w-auto disabled:opacity-50"
                          >
                            {isCreatingTable ? 'Creando mesa...' : (<><Plus className="w-4 h-4 mr-2" />Crear Mesa</>)}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="border-2 border-accent-300 text-accent-700 hover:bg-accent-50 h-12 w-full sm:w-auto"
                            onClick={() => { setShowAddForm(false); setNewTableNumber(''); }}
                          >
                            <X className="w-4 h-4 mr-2" />
                            Cancelar
                          </Button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            <MesasGrid
              visibleMesas={visibleMesas}
              totalMesas={totalMesas}
              hasMoreMesas={hasMoreMesas}
              mesasSentinelRef={mesasSentinelRef}
              loadMoreMesas={loadMoreMesas}
              isEmployee={isEmployee}
              onOpenTable={handleOpenTable}
              onDeleteTable={(mesaId) => { setMesaToDelete(mesaId); setShowDeleteModal(true); }}
              selectedMesaId={modalOpenIntent && showOrderDetails ? null : (selectedMesa?.id || null)}
              selectedMesaUnits={modalOpenIntent && showOrderDetails
                ? null
                : (selectedMesa?.id ? getTotalProductUnits(orderItems) : null)}
              lowMotionMode={lowMotionMode}
              getMesaLockState={getMesaLockState}
            />

            {mesas.length === 0 && !loading && (
              <div className="text-center py-12">
                <div className="w-20 h-20 rounded-full bg-accent-100 flex items-center justify-center mx-auto mb-4">
                  <Layers className="w-10 h-10 text-accent-600" />
                </div>
                <h3 className="text-xl font-semibold text-primary-900 mb-2">No hay mesas creadas</h3>
                <p className="text-primary-600 mb-6">Comienza agregando tu primera mesa</p>
                {canManageTables && (
                  <Button onClick={() => setShowAddForm(true)} className="gradient-primary text-white hover:opacity-90">
                    <Plus className="w-5 h-5 mr-2" />
                    Agregar Mesa
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Order Details Modal */}
        <AnimatePresence>
          {modalOpenIntent && showOrderDetails && selectedMesa && canShowOrderModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full my-8"
              >
                <Card className="border-0 flex flex-col max-h-[85vh]">
                  <CardHeader className="border-b border-accent-100 bg-gradient-to-r from-primary-50 to-accent-50 shrink-0">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-2xl font-bold text-primary-900 flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center">
                          <ShoppingCart className="w-6 h-6 text-white" />
                        </div>
                        Mesa {selectedMesa.table_number} - Orden
                      </CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCloseModal}
                        className="h-10 w-10 p-0 hover:bg-red-100 hover:text-red-600 rounded-xl"
                      >
                        <X className="w-5 h-5" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6 overflow-y-auto flex-1">
                    <MesaCatalogSearch
                      searchProduct={searchProduct}
                      onSearchChange={setSearchProduct}
                      filteredCatalog={filteredCatalog}
                      visibleFilteredCatalog={visibleFilteredCatalog}
                      hasMoreFilteredCatalog={hasMoreFilteredCatalog}
                      totalFilteredCatalog={totalFilteredCatalog}
                      filteredCatalogSentinelRef={filteredCatalogSentinelRef}
                      lowMotionMode={lowMotionMode}
                      onAddItem={addCatalogItemToOrder}
                      onLoadMore={loadMoreFilteredCatalog}
                    />
                    <MesaOrderItemsGrid
                      orderItems={orderItems}
                      visibleOrderItems={visibleOrderItems}
                      hasMoreOrderItems={hasMoreOrderItems}
                      totalOrderItems={totalOrderItems}
                      orderItemsSentinelRef={orderItemsSentinelRef}
                      lowMotionMode={lowMotionMode}
                      isOrderItemsSyncing={isOrderItemsSyncing}
                      getOrderItemRenderKey={getOrderItemRenderKey}
                      getOrderItemName={getOrderItemName}
                      onUpdateQuantity={updateItemQuantity}
                      onLoadMore={loadMoreOrderItems}
                    />
                  </CardContent>
                  <MesaOrderFooter
                    orderTotal={orderTotal}
                    orderItemsCount={orderItems.length}
                    isOrderItemsSyncing={isOrderItemsSyncing}
                    onSave={handleRefreshOrder}
                    onPrintKitchen={handlePrintOrder}
                    onCloseOrder={handleCloseOrder}
                  />
                </Card>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Close Order Choice Modal */}
        <AnimatePresence>
          {showCloseOrderChoiceModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[58] p-4"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-3xl shadow-2xl max-w-md w-full"
              >
                <Card className="border-0">
                  <CardHeader className="border-b border-accent-100 bg-gradient-to-r from-primary-50 to-accent-50">
                    <CardTitle className="text-xl font-bold text-primary-900">
                      💳 ¿Cómo cerrar la orden?
                    </CardTitle>
                    <p className="text-sm text-primary-600 mt-1">Total: {formatPrice(orderTotal)}</p>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-3">
                    <Button onClick={handlePayAllTogether} className="w-full h-12 gradient-primary text-white hover:opacity-90">
                      <CheckCircle2 className="w-5 h-5 mr-2" />
                      Pagar todo junto
                    </Button>
                    <Button variant="outline" onClick={handleSplitBill} className="w-full h-12 border-2 border-accent-300 text-accent-700 hover:bg-accent-50">
                      <Layers className="w-5 h-5 mr-2" />
                      Dividir cuenta
                    </Button>
                    <Button variant="ghost" onClick={() => setShowCloseOrderChoiceModal(false)} className="w-full h-10 text-primary-600 hover:bg-accent-50">
                      Cancelar
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Split Bill Modal */}
        <AnimatePresence>
          {showSplitBillModal && (
            <SplitBillModal
              orderItems={orderItems}
              onConfirm={processSplitPaymentAndClose}
              onCancel={() => { setShowSplitBillModal(false); setShowCloseOrderChoiceModal(true); }}
            />
          )}
        </AnimatePresence>

        {/* Payment Modal */}
        <MesaPaymentModal
          isOpen={showPaymentModal}
          orderTotal={orderTotal}
          cambioPago={cambioPago}
          paymentMethod={paymentMethod}
          onPaymentMethodChange={setPaymentMethod}
          selectedCustomer={selectedCustomer}
          onCustomerChange={setSelectedCustomer}
          clientes={clientes}
          amountReceived={amountReceived}
          onAmountReceivedChange={setAmountReceived}
          amountReceivedError={amountReceivedError}
          setAmountReceivedError={setAmountReceivedError}
          insufficientItems={insufficientItems}
          insufficientComboComponents={insufficientComboComponents}
          hasInsufficientComboStock={hasInsufficientComboStock}
          isCashPaymentInvalid={isCashPaymentInvalid}
          isClosingOrder={isClosingOrder}
          onCancel={() => {
            setShowPaymentModal(false);
            setPaymentMethod('cash');
            setAmountReceived('');
            setAmountReceivedError('');
            setSelectedCustomer('');
          }}
          onConfirm={processPaymentAndClose}
          calcularCambio={calcularCambio}
        />

        {/* Delete Confirmation Modal */}
        <MesaDeleteModal
          isOpen={showDeleteModal}
          onCancel={() => { setShowDeleteModal(false); setMesaToDelete(null); }}
          onConfirm={async () => {
            if (!mesaToDelete) return;
            const mesaId = mesaToDelete;
            const snapshotMesas = mesas.slice();
            const deletedTable = snapshotMesas.find((m) => m.id === mesaId) || null;
            const deletedTableLabel = deletedTable?.table_number ? `#${deletedTable.table_number}` : '-';
            setMesas((prevMesas) => prevMesas.filter((m) => m.id !== mesaId));
            if (selectedMesa?.id === mesaId) {
              handleCloseModal();
            }
            setShowDeleteModal(false);
            setMesaToDelete(null);
            try {
              const deleteResult = await deleteTableCascadeOrders(mesaId, { businessId });
              setAlertType('success');
              setSuccessTitle('🗑️ Mesa Eliminada');
              setSuccessDetails([{ label: 'Mesa', value: deletedTableLabel }]);
              setSuccess(true);
              setTimeout(() => setSuccess(false), 3000);
              if (!deleteResult?.__localOnly) {
                await loadMesas();
              }
            } catch (err) {
              const message = String(err?.message || '').trim();
              const code = String(err?.code || '').trim();
              const details = String(err?.details || '').trim();
              const hint = String(err?.hint || '').trim();
              const diag = [code ? `code=${code}` : null, hint ? `hint=${hint}` : null, details ? `details=${details}` : null]
                .filter(Boolean).join(' | ');
              setError(`❌ No se pudo eliminar la mesa. Revirtiendo estado.${message ? ` ${message}` : ''}${diag ? ` [${diag}]` : ''}`);
              setMesas(snapshotMesas);
              setTimeout(() => setError(null), 5000);
            }
          }}
        />
      </motion.section>
    </AsyncStateWrapper>
  );
}

export default Mesas;
