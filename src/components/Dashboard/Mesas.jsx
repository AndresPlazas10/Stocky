import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { closeOrderAsSplit, closeOrderSingle } from '../../services/ordersService.js';
import { fetchComboCatalog } from '../../services/combosService.js';
import {
  createOrderAndOccupyTable,
  createTable,
  deleteOrderAndReleaseTable,
  deleteOrderItemById,
  deleteTableCascadeOrders,
  insertOrderItem,
  persistOrderItemQuantities,
  updateOrderItemQuantityById,
  updateOrderTotalById
} from '../../data/commands/ordersCommands.js';
import {
  getOpenOrdersByBusiness,
  getOrderForRealtimeById,
  getOrderItemsByOrderId,
  getOrderWithItemsById,
  getProductsForOrdersByBusiness,
  getSalePrintBundle,
  getTablesWithCurrentOrderByBusiness
} from '../../data/queries/ordersQueries.js';
import {
  getAuthenticatedUser as getAuthenticatedUserFromOrders,
  getEmployeeRoleInBusiness as getEmployeeRoleInBusinessForOrders,
  isEmployeeInBusiness as isEmployeeInBusinessForOrders
} from '../../data/queries/authQueries.js';
import { isAdminRole } from '../../utils/roles.js';
import { formatPrice, formatDateTimeTicket } from '../../utils/formatters.js';
import { useRealtimeSubscription } from '../../hooks/useRealtime.js';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { SaleSuccessAlert } from '../ui/SaleSuccessAlert';
import { SaleErrorAlert } from '../ui/SaleErrorAlert';
import { SaleUpdateAlert } from '../ui/SaleUpdateAlert';
import { 
  Plus, 
  Layers, 
  Trash2, 
  X, 
  Search, 
  ShoppingCart,
  CheckCircle2,
  AlertCircle,
  Save,
  Printer
} from 'lucide-react';
import SplitBillModal from './SplitBillModal';
import { closeModalImmediate } from '../../utils/closeModalImmediate';
import { AsyncStateWrapper } from '../../ui/system/async-state/index.js';
import { normalizeTableRecord } from '../../utils/tableStatus.js';
import { getThermalPaperWidthMm, isAutoPrintReceiptEnabled } from '../../utils/printer.js';
import { printSaleReceipt } from '../../utils/saleReceiptPrint.js';
import { isOfflineMode, readOfflineSnapshot, saveOfflineSnapshot } from '../../utils/offlineSnapshot.js';
import { invalidateOrderCache } from '../../data/adapters/cacheInvalidation.js';
import LOCAL_SYNC_CONFIG from '../../config/localSync.js';

const getPaymentMethodLabel = (method) => {
  if (method === 'cash') return 'Efectivo';
  if (method === 'card') return 'Tarjeta';
  if (method === 'transfer') return 'Transferencia';
  if (method === 'mixed') return 'Mixto';
  return method || '-';
};

const toFiniteNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeOrderItemNumericFields = (item) => {
  if (!item || typeof item !== 'object') return item;

  const quantity = toFiniteNumber(item.quantity, 0);
  const price = toFiniteNumber(item.price, 0);
  const subtotalFromRow = Number(item.subtotal);
  const subtotal = Number.isFinite(subtotalFromRow) ? subtotalFromRow : (quantity * price);

  return {
    ...item,
    quantity,
    price,
    subtotal
  };
};

const getTotalProductUnits = (items = []) =>
  items.reduce((sum, item) => sum + toFiniteNumber(item?.quantity, 0), 0);

const calculateOrderItemsTotal = (items = []) =>
  items.reduce((sum, item) => {
    const subtotal = Number(item?.subtotal);
    if (Number.isFinite(subtotal)) return sum + subtotal;

    const quantity = toFiniteNumber(item?.quantity, 0);
    const price = toFiniteNumber(item?.price, 0);
    return sum + (quantity * price);
  }, 0);

const SHOULD_DEFER_REMOTE_MESAS_RELOAD_AFTER_LOCAL_SAVE = Boolean(
  LOCAL_SYNC_CONFIG.enabled
  && LOCAL_SYNC_CONFIG.shadowWritesEnabled
  && (
    LOCAL_SYNC_CONFIG.localWrites?.allLocalFirst
    || LOCAL_SYNC_CONFIG.localWrites?.ordersLocalFirst
    || LOCAL_SYNC_CONFIG.localWrites?.tablesLocalFirst
  )
);
const MESAS_REMOTE_FALLBACK_POLL_MS = 5000;

const getMesaProductUnits = (mesa, { selectedMesa = null, orderItems = [] } = {}) => {
  if (selectedMesa?.id && mesa?.id === selectedMesa.id && Array.isArray(orderItems) && orderItems.length > 0) {
    return getTotalProductUnits(orderItems);
  }

  const mesaItems = Array.isArray(mesa?.orders?.order_items) ? mesa.orders.order_items : [];
  if (mesaItems.length > 0) {
    return getTotalProductUnits(mesaItems);
  }

  const localUnits = Number(
    mesa?.orders?.local_units
    ?? mesa?.orders?.items_units
    ?? mesa?.orders?.items_count
    ?? 0
  );

  return Number.isFinite(localUnits) ? localUnits : 0;
};

const getOrderItemRenderKey = (item, index = 0) => {
  const comboId = normalizeEntityId(item?.combo_id);
  if (comboId) return `combo:${comboId}`;

  const productId = normalizeEntityId(item?.product_id);
  if (productId) return `product:${productId}`;

  const itemId = normalizeEntityId(item?.id);
  if (itemId) return `id:${itemId}`;

  return `fallback:${index}`;
};

const mergeOrderItemsPreservingPosition = (previousItems = [], incomingItems = []) => {
  const normalizedIncoming = Array.isArray(incomingItems) ? incomingItems.filter(Boolean) : [];
  if (!Array.isArray(previousItems) || previousItems.length === 0) {
    return normalizedIncoming;
  }

  const incomingById = new Map(
    normalizedIncoming
      .filter((item) => item?.id)
      .map((item) => [item.id, item])
  );
  const previousIds = new Set(previousItems.map((item) => item?.id).filter(Boolean));

  const preserved = previousItems
    .filter((item) => item?.id && incomingById.has(item.id))
    .map((item) => incomingById.get(item.id));

  const newItemsFirst = normalizedIncoming.filter((item) => !item?.id || !previousIds.has(item.id));

  return [...newItemsFirst, ...preserved];
};

const COLOMBIAN_DENOMINATIONS = [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50];

const parseCopAmount = (value) => {
  if (value === null || value === undefined) return NaN;
  if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value) : NaN;

  const raw = String(value).trim().replace(/\s/g, '').replace(/\$/g, '');
  if (!raw) return NaN;

  // Formato es-CO con miles "." y decimal "," (si llega decimal se redondea a pesos).
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(raw)) {
    const parsed = Number(raw.replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(parsed) ? Math.round(parsed) : NaN;
  }

  // Formato en-US con miles "," y decimal ".".
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(raw)) {
    const parsed = Number(raw.replace(/,/g, ''));
    return Number.isFinite(parsed) ? Math.round(parsed) : NaN;
  }

  // Número simple (admite coma decimal).
  const simpleParsed = Number(raw.replace(',', '.'));
  if (Number.isFinite(simpleParsed)) return Math.round(simpleParsed);

  // Último fallback: tomar solo dígitos.
  const digitsOnly = raw.replace(/[^\d]/g, '');
  if (!digitsOnly) return NaN;
  const digitsParsed = Number(digitsOnly);
  return Number.isFinite(digitsParsed) ? Math.round(digitsParsed) : NaN;
};

// Calcula cambio usando greedy para minimizar cantidad de billetes/monedas.
const calcularCambio = (total, pagado) => {
  const normalizedTotal = Math.round(Number(total) || 0);
  const normalizedPaid = parseCopAmount(pagado);

  if (normalizedTotal <= 0) {
    return { isValid: false, reason: 'invalid_total', change: 0, breakdown: [] };
  }

  if (!Number.isFinite(normalizedPaid) || normalizedPaid <= 0) {
    return { isValid: false, reason: 'invalid_paid', change: 0, breakdown: [] };
  }

  if (normalizedPaid < normalizedTotal) {
    return { isValid: false, reason: 'insufficient', change: 0, breakdown: [] };
  }

  let remaining = normalizedPaid - normalizedTotal;
  const breakdown = [];

  for (const denomination of COLOMBIAN_DENOMINATIONS) {
    const count = Math.floor(remaining / denomination);
    if (count > 0) {
      breakdown.push({ denomination, count });
      remaining -= count * denomination;
    }
  }

  return {
    isValid: true,
    reason: null,
    change: normalizedPaid - normalizedTotal,
    breakdown
  };
};

const normalizeTableIdentifier = (value) => String(value ?? '').trim();

const compareTableIdentifiers = (left, right) => {
  const a = normalizeTableIdentifier(left?.table_number);
  const b = normalizeTableIdentifier(right?.table_number);

  const aIsInteger = /^\d+$/.test(a);
  const bIsInteger = /^\d+$/.test(b);

  if (aIsInteger && bIsInteger) {
    return Number(a) - Number(b);
  }
  if (aIsInteger && !bIsInteger) return -1;
  if (!aIsInteger && bIsInteger) return 1;

  return a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' });
};

// eslint helper: `no-unused-vars` no detecta consistentemente `<motion.* />` en esta config.
const _motionLintUsage = motion;

const applyPendingQuantities = (items = [], pendingUpdates = {}) => {
  if (!Array.isArray(items) || items.length === 0) return [];
  if (!pendingUpdates || Object.keys(pendingUpdates).length === 0) {
    return items.map((item) => normalizeOrderItemNumericFields(item));
  }

  return items.map((item) => {
    const normalizedItem = normalizeOrderItemNumericFields(item);
    const pendingQuantity = pendingUpdates[normalizedItem?.id];
    if (pendingQuantity === undefined || pendingQuantity === null) return normalizedItem;

    const normalizedQuantity = Number(pendingQuantity);
    if (!Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) return normalizedItem;

    const normalizedPrice = toFiniteNumber(normalizedItem?.price, 0);
    return {
      ...normalizedItem,
      quantity: normalizedQuantity,
      subtotal: normalizedQuantity * normalizedPrice
    };
  });
};

const ORDER_ITEMS_SELECT = `
  id,
  order_id,
  product_id,
  combo_id,
  quantity,
  price,
  subtotal,
  products (id, name, code, category),
  combos (id, nombre, descripcion)
`;

const ORDER_ITEM_TYPE = {
  PRODUCT: 'product',
  COMBO: 'combo'
};

const getOrderItemName = (item) => item?.products?.name || item?.combos?.nombre || 'Item';

const buildDiagnosticAlertMessage = (errorLike, fallback = 'Error desconocido') => {
  const message = String(errorLike?.message || errorLike || fallback).trim() || fallback;
  const code = String(errorLike?.code || '').trim();
  const status = String(errorLike?.status || errorLike?.statusCode || '').trim();
  const hint = String(errorLike?.hint || '').trim();
  const details = String(errorLike?.details || '').trim();

  const diagnosticParts = [
    code ? `code=${code}` : null,
    status ? `status=${status}` : null,
    hint ? `hint=${hint}` : null,
    details ? `details=${details}` : null
  ].filter(Boolean);

  if (diagnosticParts.length === 0) return `❌ ${message}`;
  return `❌ ${message} [diag: ${diagnosticParts.join(' | ')}]`;
};

const normalizeEntityId = (value) => {
  const normalized = String(value ?? '').trim();
  return normalized || null;
};

function sanitizeMesaOrderAssociation(mesa) {
  if (!mesa || typeof mesa !== 'object') return mesa;

  const mesaId = normalizeEntityId(mesa?.id);
  const currentOrderId = normalizeEntityId(mesa?.current_order_id);
  const order = mesa?.orders && typeof mesa.orders === 'object' ? mesa.orders : null;

  if (!currentOrderId) {
    return normalizeTableRecord({
      ...mesa,
      status: 'available',
      current_order_id: null,
      orders: null
    });
  }

  if (!order) {
    return normalizeTableRecord(mesa);
  }

  const orderId = normalizeEntityId(order?.id);
  const orderTableId = normalizeEntityId(order?.table_id);
  const orderStatus = String(order?.status || '').trim().toLowerCase();

  const mismatchedOrderId = Boolean(orderId && orderId !== currentOrderId);
  const mismatchedOrderTable = Boolean(orderTableId && mesaId && orderTableId !== mesaId);
  const closedOrder = orderStatus === 'closed' || orderStatus === 'cancelled';

  if (mismatchedOrderId || mismatchedOrderTable || closedOrder) {
    return normalizeTableRecord({
      ...mesa,
      status: 'available',
      current_order_id: null,
      orders: null
    });
  }

  return normalizeTableRecord(mesa);
}

async function reconcileClosedOrdersFromOutbox(mesas = []) {
  if (!Array.isArray(mesas) || mesas.length === 0) return mesas;
  return mesas;
}

function pickCanonicalOpenOrderForTable(openOrders = []) {
  if (!Array.isArray(openOrders) || openOrders.length === 0) return null;
  return openOrders
    .filter((order) => normalizeEntityId(order?.id))
    .sort((a, b) => {
      const aTs = Date.parse(String(a?.opened_at || a?.updated_at || ''));
      const bTs = Date.parse(String(b?.opened_at || b?.updated_at || ''));
      const safeA = Number.isFinite(aTs) ? aTs : Number.MAX_SAFE_INTEGER;
      const safeB = Number.isFinite(bTs) ? bTs : Number.MAX_SAFE_INTEGER;
      if (safeA !== safeB) return safeA - safeB;
      return String(a?.id || '').localeCompare(String(b?.id || ''));
    })[0] || null;
}

function orderHasProducts(order) {
  const items = Array.isArray(order?.order_items) ? order.order_items : [];
  if (items.length > 0) return true;
  const total = Number(order?.total);
  return Number.isFinite(total) && total > 0;
}

async function reconcileTablesWithOpenOrders({ mesas = [], businessId }) {
  if (!Array.isArray(mesas) || mesas.length === 0) return mesas;
  if (!businessId) return mesas;

  try {
    const openOrders = await getOpenOrdersByBusiness(
      businessId,
      'id, business_id, table_id, status, total, opened_at, updated_at, order_items(id)'
    );

    const openOrdersByTableId = new Map();
    (Array.isArray(openOrders) ? openOrders : []).forEach((order) => {
      const tableId = normalizeEntityId(order?.table_id);
      const orderId = normalizeEntityId(order?.id);
      const status = String(order?.status || '').trim().toLowerCase();
      if (!tableId || !orderId || status !== 'open') return;
      if (!openOrdersByTableId.has(tableId)) openOrdersByTableId.set(tableId, []);
      openOrdersByTableId.get(tableId).push(order);
    });

    return mesas.map((mesa) => {
      const tableId = normalizeEntityId(mesa?.id);
      if (!tableId) return mesa;

      const currentOrderId = normalizeEntityId(mesa?.current_order_id);
      if (currentOrderId) return mesa;

      const candidates = openOrdersByTableId.get(tableId) || [];
      const canonicalOrder = pickCanonicalOpenOrderForTable(candidates);
      if (!canonicalOrder?.id) return mesa;
      if (!orderHasProducts(canonicalOrder)) return mesa;

      return normalizeTableRecord({
        ...mesa,
        status: 'occupied',
        current_order_id: canonicalOrder.id,
        orders: {
          ...(mesa?.orders || {}),
          id: canonicalOrder.id,
          status: 'open',
          total: Number(canonicalOrder?.total || mesa?.orders?.total || 0),
          opened_at: canonicalOrder?.opened_at || mesa?.orders?.opened_at || null
        }
      });
    });
  } catch {
    return mesas;
  }
}

function Mesas({ businessId, userRole = 'admin' }) {
  const MODAL_REOPEN_GUARD_MS = 600;
  const canManageTables = isAdminRole(userRole);
  const [mesas, setMesas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [successDetails, setSuccessDetails] = useState([]);
  const [successTitle, setSuccessTitle] = useState('✨ Acción Completada');
  const [alertType, setAlertType] = useState('success'); // 'success', 'update', 'error'
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedMesa, setSelectedMesa] = useState(null);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  // Nueva bandera: intención explícita de abrir el modal (evita aperturas automáticas)
  const [modalOpenIntent, setModalOpenIntent] = useState(false);
  const [isEmployee, setIsEmployee] = useState(false); // Verificar si es empleado
  
  // Estados para la orden
  const [orderItems, setOrderItems] = useState([]);
  const [, setPendingQuantityUpdates] = useState({});
  const [productos, setProductos] = useState([]);
  const [combos, setCombos] = useState([]);
  const [searchProduct, setSearchProduct] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [quantityToAdd, setQuantityToAdd] = useState(1);

  // Estados para cerrar orden
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

  // Form data para crear mesa
  const [newTableNumber, setNewTableNumber] = useState('');

  // Estado para modal de confirmación de eliminación
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [mesaToDelete, setMesaToDelete] = useState(null);
  
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
  const orderRealtimeRefreshTimersRef = useRef({});
  const optimisticTempItemQuantitiesRef = useRef({});
  const pendingOrderItemOpsRef = useRef(0);
  const orderItemWriteQueueRef = useRef({});

  // Ref para prevenir que el modal se reabra después de completar una venta
  const justCompletedSaleRef = useRef(false);
  
  // Estado para bloquear completamente el renderizado del modal mientras se procesa la venta
  const [canShowOrderModal, setCanShowOrderModal] = useState(true);
  const isOrderItemsSyncing = pendingOrderItemOps > 0;

  const setPendingQuantityUpdatesSafe = useCallback((updater) => {
    const prev = pendingQuantityUpdatesRef.current || {};
    const next = typeof updater === 'function' ? updater(prev) : updater;
    const normalizedNext = next && typeof next === 'object' ? next : {};
    pendingQuantityUpdatesRef.current = normalizedNext;
    setPendingQuantityUpdates(normalizedNext);
  }, []);

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
    const next = previous
      .catch(() => {})
      .then(() => task());

    queueByItem[normalizedItemId] = next;
    orderItemWriteQueueRef.current = queueByItem;

    return next.finally(() => {
      if (orderItemWriteQueueRef.current?.[normalizedItemId] === next) {
        delete orderItemWriteQueueRef.current[normalizedItemId];
      }
    });
  }, []);

  useEffect(() => {
    orderItemsRef.current = Array.isArray(orderItems) ? orderItems : [];
  }, [orderItems]);

  useEffect(() => {
    selectedMesaRef.current = selectedMesa || null;
  }, [selectedMesa]);

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

  const getCurrentUser = useCallback(async () => {
    try {
      const user = await getAuthenticatedUserFromOrders();
      if (user) {
        // Tabla users (public) no existe, usar auth.users
        setCurrentUser({ id: user.id, role: 'admin' });
      }
    } catch {
      // no-op
    }
  }, []);

  // Verificar si el usuario autenticado es empleado
  const checkIfEmployee = useCallback(async () => {
    try {
      const user = await getAuthenticatedUserFromOrders();
      if (!user) {
        setIsEmployee(false);
        return;
      }

      const isEmployeeInBusiness = await isEmployeeInBusinessForOrders({ userId: user.id, businessId });
      if (!isEmployeeInBusiness) {
        // Owner fuera de tabla employees u otros casos administrativos: permitir eliminar.
        setIsEmployee(false);
        return;
      }

      const role = await getEmployeeRoleInBusinessForOrders({ userId: user.id, businessId });
      const hasAdminPrivileges = isAdminRole(role);
      // Solo bloquear eliminación a empleados no administradores.
      setIsEmployee(!hasAdminPrivileges);
    } catch {
      // Si hay error, asumimos que NO es empleado (es admin)
      setIsEmployee(false);
    }
  }, [businessId]);

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
  }, [businessId]);

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

    await invalidateOrderCache({
      businessId,
      tableId: normalizedTableId,
      orderId: normalizeEntityId(orderId)
    });
  }, [businessId]);

  const loadProductos = useCallback(async () => {
    const offline = isOfflineMode();
    const offlineSnapshotKey = `mesas.productos:${businessId}`;
    const offlineSnapshot = readOfflineSnapshot(offlineSnapshotKey, []);

    if (offline && Array.isArray(offlineSnapshot) && offlineSnapshot.length > 0) {
      setProductos(offlineSnapshot);
    }

    try {
      const data = await getProductsForOrdersByBusiness(businessId);
      const normalizedData = Array.isArray(data) ? data : [];
      const hasLocalData = normalizedData.length > 0;

      if (offline && !hasLocalData && Array.isArray(offlineSnapshot) && offlineSnapshot.length > 0) {
        setProductos(offlineSnapshot);
        return;
      }

      // Removido el filtro de stock para permitir ventas incluso con stock negativo
      setProductos(normalizedData);
      if (!offline || hasLocalData) {
        saveOfflineSnapshot(offlineSnapshotKey, normalizedData);
      }
    } catch {
      const cached = readOfflineSnapshot(offlineSnapshotKey, []);
      if (Array.isArray(cached) && cached.length > 0) {
        setProductos(cached);
        return;
      }

      if (offline) {
        setProductos([]);
      } else {
        setError('No se pudo cargar los productos. Revisa tu conexión e intenta de nuevo.');
      }
    }
  }, [businessId]);

  const loadCombos = useCallback(async () => {
    const offline = isOfflineMode();
    const offlineSnapshotKey = `mesas.combos:${businessId}`;
    const offlineSnapshot = readOfflineSnapshot(offlineSnapshotKey, []);

    if (offline && Array.isArray(offlineSnapshot) && offlineSnapshot.length > 0) {
      setCombos(offlineSnapshot);
    }

    try {
      const data = await fetchComboCatalog(businessId);
      const normalizedData = Array.isArray(data) ? data : [];
      const hasLocalData = normalizedData.length > 0;

      if (offline && !hasLocalData && Array.isArray(offlineSnapshot) && offlineSnapshot.length > 0) {
        setCombos(offlineSnapshot);
        return;
      }

      setCombos(normalizedData);
      if (!offline || hasLocalData) {
        saveOfflineSnapshot(offlineSnapshotKey, normalizedData);
      }
    } catch {
      const cached = readOfflineSnapshot(offlineSnapshotKey, []);
      if (Array.isArray(cached) && cached.length > 0) {
        setCombos(cached);
        return;
      }

      if (offline) {
        setCombos([]);
      } else {
        setError('No se pudo cargar los combos. Revisa tu conexión e intenta de nuevo.');
      }
    }
  }, [businessId]);

  const loadClientes = useCallback(async () => {
    // Tabla customers eliminada - no hacer nada
    setClientes([]);
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadMesas(),
        loadProductos(),
        loadCombos(),
        loadClientes()
      ]);
    } catch {
      setError('⚠️ No se pudo cargar la información de las mesas. Por favor, intenta recargar la página.');
    } finally {
      setLoading(false);
    }
  }, [loadMesas, loadProductos, loadCombos, loadClientes]);

  useEffect(() => {
    if (businessId) {
      loadData();
      getCurrentUser();
      checkIfEmployee();
    }
  }, [businessId, loadData, getCurrentUser, checkIfEmployee]);

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

  useEffect(() => {
    if (!businessId || !Array.isArray(mesas)) return;
    const normalizedForSnapshot = mesas.map(normalizeTableRecord).sort(compareTableIdentifiers);
    saveOfflineSnapshot(`mesas.list:${businessId}`, normalizedForSnapshot);
  }, [businessId, mesas]);

  // Callbacks memoizados para Realtime
  const handleTableInsert = useCallback((newTable) => {
    const normalizedTable = normalizeTableRecord(newTable);
    setMesas(prev => {
      const exists = prev.some(m => m.id === normalizedTable.id);
      if (exists) {
        return prev;
      }
      return [...prev, normalizedTable].sort(compareTableIdentifiers);
    });
    setAlertType('success');
    setSuccessTitle('✨ Mesa Agregada');
    setSuccessDetails([
      { label: 'Mesa', value: `#${normalizedTable.table_number}` }
    ]);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  }, []);

  const handleTableUpdate = useCallback((updatedTable) => {
    const normalizedTable = normalizeTableRecord(updatedTable);
    // ❌ IGNORAR COMPLETAMENTE cualquier actualización si acabamos de completar una venta
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
        // Realtime de tables no incluye relación orders; preservar solo si la mesa sigue ocupada.
        orders: resolvedOrders
      });
    }));
    // Si estamos viendo esta mesa, actualizar sus detalles
    setSelectedMesa(prev => {
      if (prev?.id === normalizedTable.id) {
        // Si la mesa se liberó (pasó a available), cerrar el modal
        if (normalizedTable.status === 'available' && !normalizedTable.current_order_id) {
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
  }, []);

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
  }, []);

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
  }, []);

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
          } catch {
            // no-op
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
          } catch {
            // no-op
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
      } catch {
        // no-op
      }
    }, 100);
  }, []);

  // 🔥 TIEMPO REAL: Suscripción a cambios en mesas
  useRealtimeSubscription('tables', {
    filter: { business_id: businessId },
    enabled: !!businessId,
    onInsert: handleTableInsert,
    onUpdate: handleTableUpdate,
    onDelete: handleTableDelete
  });

  // 🔥 TIEMPO REAL: Suscripción a cambios en órdenes
  useRealtimeSubscription('orders', {
    filter: { business_id: businessId },
    enabled: !!businessId,
    onUpdate: async (updatedOrder) => {
      // NO procesar actualizaciones si acabamos de completar una venta
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

      // Actualizar la mesa correspondiente en el estado global
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

      setSelectedMesa((prevSelected) => {
        if (normalizeEntityId(prevSelected?.current_order_id) !== normalizedOrderId) return prevSelected;
        if (normalizedOrderStatus !== 'open') return prevSelected;

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

      if (normalizedOrderStatus === 'open' && affectedMesaId) {
        // Producción: refuerza consistencia cuando llegan eventos fuera de orden o parciales.
        scheduleOrderRealtimeRefresh(normalizedOrderId, affectedMesaId);
      }

      // Los items se sincronizan exclusivamente desde la suscripción de `order_items`
      // para evitar doble fetch en background por cada cambio.
    }
  });

  // 🔥 TIEMPO REAL: Suscripción a cambios en items de orden (NIVEL NEGOCIO)
  // Callback para manejar cambios en order_items
  const handleOrderItemChange = useCallback((item, eventType = 'UPDATE') => {
    const orderId = normalizeEntityId(item?.order_id);
    if (!orderId) return;
    if (justCompletedSaleRef.current) return;

    let mesaAfectadaId = null;

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

    if (normalizeEntityId(selectedMesaRef.current?.current_order_id) === orderId) {
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

    if (mesaAfectadaId) {
      // Reconciliación en background para blindar consistencia si llega evento parcial.
      scheduleOrderRealtimeRefresh(orderId, mesaAfectadaId);
    }
  }, [applyRealtimeOrderItemChange, scheduleOrderRealtimeRefresh]);

  // Suscripción a order_items a nivel de negocio (sin filtrar por order_id específico)
  // Nota: RLS automáticamente filtra por business_id del usuario autenticado
  useRealtimeSubscription('order_items', {
    enabled: !!businessId,
    filter: {}, // RLS se encarga del filtrado por business_id
    onInsert: (newItem) => handleOrderItemChange(newItem, 'INSERT'),
    onUpdate: (updatedItem) => handleOrderItemChange(updatedItem, 'UPDATE'),
    onDelete: (deletedItem) => handleOrderItemChange(deletedItem, 'DELETE')
  });

  useEffect(() => () => {
    const timers = orderRealtimeRefreshTimersRef.current || {};
    Object.values(timers).forEach((timerId) => clearTimeout(timerId));
  }, []);

  useRealtimeSubscription('combos', {
    filter: { business_id: businessId },
    enabled: !!businessId,
    onInsert: () => { loadCombos().catch(() => {}); },
    onUpdate: () => { loadCombos().catch(() => {}); },
    onDelete: () => { loadCombos().catch(() => {}); }
  });

  const handleCreateTable = useCallback(async (e) => {
    e.preventDefault();

    if (!canManageTables || isEmployee) {
      setShowAddForm(false);
      setError('⚠️ Solo el administrador puede crear mesas.');
      return;
    }
    
    if (isCreatingTable) return; // Prevenir doble click
    
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

      // Código de éxito
      setAlertType('success');
      setSuccessTitle('✅ Mesa Creada');
      setSuccessDetails([
        { label: 'Mesa', value: `#${tableIdentifier}` }
      ]);
      setSuccess(true);
      setNewTableNumber('');
      setShowAddForm(false);
      
    } catch (error) {
      setError(error?.message || '❌ No se pudo crear la mesa. Por favor, intenta de nuevo.');
    } finally {
      setIsCreatingTable(false); // SIEMPRE desbloquear
    }
  }, [canManageTables, isEmployee, isCreatingTable, newTableNumber, businessId, loadMesas]);

  // IMPORTANTE: Definir estas funciones ANTES de handleOpenTable
  const createNewOrder = useCallback(async (mesa) => {
    try {
      setError(null);
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
      // Recuperación best-effort: si hubo carrera y la orden sí quedó creada/asignada,
      // abrirla en lugar de mostrar fallo.
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

      setShowOrderDetails(false);
      setModalOpenIntent(false);
      setSelectedMesa(null);
      setError(`❌ No se pudo abrir la mesa: ${error?.message || 'Error desconocido'}`);
    }
  }, [businessId, currentUser, loadMesas, setPendingQuantityUpdatesSafe]);

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

      // Evitar lecturas cacheadas viejas al reingresar a una mesa.
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
  }, [setPendingQuantityUpdatesSafe]);

  const handleOpenTable = useCallback(async (mesa) => {
    const requestId = orderDetailsRequestRef.current + 1;
    orderDetailsRequestRef.current = requestId;

    // Evitar arrastrar items de otra mesa mientras carga la orden actual.
    orderItemsDirtyRef.current = false;
    setPendingQuantityUpdatesSafe({});

    const normalizedMesa = normalizeTableRecord(mesa);
    const preloadedOrderItems = Array.isArray(normalizedMesa?.orders?.order_items)
      ? normalizedMesa.orders.order_items
      : [];

    // Actualizar estado local inmediatamente para UI responsive
    setSelectedMesa(normalizedMesa);
    setModalOpenIntent(true);
    setShowOrderDetails(true);

    if (normalizedMesa.status === 'occupied' && normalizedMesa.current_order_id) {
      // Pintado inmediato con datos ya presentes en la card y refresh remoto en background.
      const initialOrderItems = applyPendingQuantities(
        preloadedOrderItems,
        pendingQuantityUpdatesRef.current
      );
      orderItemsRef.current = initialOrderItems;
      setOrderItems(initialOrderItems);
      loadOrderDetails(normalizedMesa, { requestId }).catch(() => {});
    } else {
      // Crear nueva orden
      orderItemsRef.current = [];
      setOrderItems([]);
      await createNewOrder(normalizedMesa);
    }
  }, [loadOrderDetails, createNewOrder, setPendingQuantityUpdatesSafe]);

  // IMPORTANTE: Definir updateOrderTotal PRIMERO (otras funciones dependen de esta)
  const updateOrderTotal = useCallback(async (orderId, itemsSnapshot = orderItems) => {
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

      // Actualizar estado local primero (instantáneo)
      setMesas(prevMesas => 
        prevMesas.map(mesa => 
          normalizeEntityId(mesa?.current_order_id) === normalizedOrderId
            ? { ...mesa, orders: { ...mesa.orders, total } }
            : mesa
        )
      );

      // Serializar escrituras por orden para evitar desorden por latencia en producción.
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
  }, [orderItems, businessId]);

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
  }, [businessId]);

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
  }, [setPendingQuantityUpdatesSafe, businessId]);

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
          businessId
        });
        if (
          !releaseResult?.__localOnly
          && !SHOULD_DEFER_REMOTE_MESAS_RELOAD_AFTER_LOCAL_SAVE
        ) {
          await loadMesas();
        }
      } catch {
        if (!SHOULD_DEFER_REMOTE_MESAS_RELOAD_AFTER_LOCAL_SAVE) {
          try { await loadMesas(); } catch { /* no-op */ }
        }
      }
    });
  }, [businessId, clearClosedMesaCache, loadMesas, setPendingQuantityUpdatesSafe]);

  const removeItem = useCallback(async (itemId) => {
    if (pendingOrderItemOpsRef.current > 0) {
      setError('⚠️ Espera un momento. Estamos sincronizando los cambios de la orden.');
      return;
    }

    markOrderItemOpStarted();
    try {
      await deleteOrderItemById(itemId, {
        businessId,
        orderId: selectedMesa?.current_order_id || null
      });

      // Actualización optimista: remover del estado local
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

      updateOrderTotal(selectedMesa.current_order_id, nextOrderItems).catch(() => {});
    } catch {
      setError('❌ No se pudo eliminar el producto. Por favor, intenta de nuevo.');
      // Revertir solo los items si se puede consultar remoto.
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
  }, [selectedMesa, updateOrderTotal, setPendingQuantityUpdatesSafe, businessId, markOrderItemOpStarted, markOrderItemOpFinished]);

  const handleRefreshOrder = useCallback(async () => {
    if (!selectedMesa) return;
    
    try {
      const hasSettledPendingOps = await waitForPendingOrderItemOps();
      if (!hasSettledPendingOps) {
        setError('⚠️ Espera un momento. Aún estamos aplicando el último cambio en la orden.');
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

      // Defensa ante snapshots vacíos transitorios en realtime (más frecuente en producción con latencia).
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

      // Si no hay productos, la mesa debe quedar disponible.
      if (!hasSavedItems) {
        if (hasOrderTotalSignal) {
          setError('⚠️ Detectamos una orden en sincronización. No se liberó la mesa automáticamente.');
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
      
      // Actualización optimista: actualizar solo la mesa actual en el estado
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
      
      // Cerrar el modal
      orderItemsDirtyRef.current = false;
      setShowOrderDetails(false);
      setModalOpenIntent(false);
      setSelectedMesa(null);
      orderItemsRef.current = [];
      setOrderItems([]);
      setSearchProduct('');
      
      setSuccessTitle('✨ Mesa Actualizada');
      setSuccessDetails([
        { label: 'Mesa', value: `#${mesaSnapshot.table_number}` },
        { label: 'Estado', value: 'Actualizada' }
      ]);
      setAlertType('update');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);

      // Persistencia en background para que "Guardar" sea inmediato en UI.
      (async () => {
        try {
          await persistPendingQuantityUpdates(mesaSnapshot.current_order_id, { refreshItems: false });
          await updateOrderTotal(mesaSnapshot.current_order_id, effectiveOrderItemsSnapshot);

          if (
            (typeof navigator === 'undefined' || navigator.onLine)
            && !SHOULD_DEFER_REMOTE_MESAS_RELOAD_AFTER_LOCAL_SAVE
          ) {
            loadMesas().catch(() => {});
          }
        } catch {
          // Mantener recuperación silenciosa para evitar alertas intrusivas.
          if (!SHOULD_DEFER_REMOTE_MESAS_RELOAD_AFTER_LOCAL_SAVE) {
            try { await loadMesas(); } catch { /* no-op */ }
          }
        }
      })();
    } catch {
      setError('❌ No se pudo guardar la orden');
    }
  }, [
    selectedMesa,
    updateOrderTotal,
    persistPendingQuantityUpdates,
    loadMesas,
    releaseEmptyOrderAndCloseModal,
    waitForPendingOrderItemOps
  ]);

  const addCatalogItemToOrder = useCallback(async (catalogItem) => {
    try {
      if (!selectedMesa?.current_order_id) return;

      const itemType = catalogItem?.item_type || ORDER_ITEM_TYPE.PRODUCT;
      const isCombo = itemType === ORDER_ITEM_TYPE.COMBO;
      const itemId = isCombo
        ? (catalogItem?.combo_id || catalogItem?.id)
        : (catalogItem?.product_id || catalogItem?.id);
      const itemName = catalogItem?.name || catalogItem?.nombre || 'Item';

      if (!itemId) {
        setError('⚠️ No se pudo identificar el item seleccionado.');
        return;
      }

      // Validar que el item tenga precio
      const precio = Number(catalogItem?.sale_price ?? catalogItem?.price ?? 0);
      if (!Number.isFinite(precio) || precio < 0) {
        setError(`⚠️ El item "${itemName}" no tiene un precio válido`);
        return;
      }

      // Validar cantidad
      const qty = parseInt(quantityToAdd);
      if (isNaN(qty) || qty <= 0) {
        setError('⚠️ La cantidad debe ser mayor a 0');
        return;
      }

      // Aviso transitorio si la cantidad solicitada supera el stock disponible (solo producto simple)
      if (
        !isCombo
        && catalogItem.manage_stock !== false
        && typeof catalogItem.stock === 'number'
        && qty > catalogItem.stock
      ) {
        setError(`⚠️ Stock insuficiente para ${itemName}. Disponibles: ${catalogItem.stock}. Considera crear una compra.`);
      }

      const currentOrderItems = Array.isArray(orderItemsRef.current) ? orderItemsRef.current : [];
      let nextOrderItems = currentOrderItems;
      let orderItemsChanged = false;

      // Verificar si el item ya está en la orden
      const existingItem = currentOrderItems.find((item) => (
        isCombo ? item.combo_id === itemId : item.product_id === itemId
      ));

      if (existingItem) {
        // Incrementar cantidad con la cantidad especificada
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
        if (isOptimisticExistingItem) {
          optimisticTempItemQuantitiesRef.current[existingItem.id] = nextQuantity;
          setPendingQuantityUpdatesSafe((prev) => ({
            ...(prev || {}),
            [existingItem.id]: nextQuantity
          }));
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
            setError('❌ No se pudo agregar el item. Por favor, intenta de nuevo.');
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
            // subtotal se calcula automáticamente con trigger
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
            setError('❌ No se pudo sincronizar la cantidad del item. Por favor, intenta guardar la orden.');
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
          setError('❌ No se pudo agregar el item. Por favor, intenta de nuevo.');
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

      // Actualizar el total de forma optimista
      if (orderItemsChanged) {
        updateOrderTotal(selectedMesa.current_order_id, nextOrderItems).catch(() => {});
      }
      setSearchProduct('');
      setQuantityToAdd(1); // Resetear cantidad
    } catch {
      setError('❌ No se pudo agregar el item. Por favor, intenta de nuevo.');
      // Revertir solo los items si se puede consultar remoto.
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
  }, [selectedMesa, quantityToAdd, updateOrderTotal, setPendingQuantityUpdatesSafe, businessId, markOrderItemOpStarted, markOrderItemOpFinished, enqueueOrderItemWrite]);

  const updateItemQuantity = useCallback(async (itemId, newQuantity) => {
    try {
      if (pendingOrderItemOpsRef.current > 0) {
        setError('⚠️ Espera un momento. Estamos sincronizando los cambios de la orden.');
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

      // Actualizar solo estado local. Se persiste al presionar "Guardar".
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
      setError('❌ No se pudo actualizar la cantidad. Por favor, intenta de nuevo.');
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
      setPendingQuantityUpdatesSafe({});
    }
  }, [selectedMesa, removeItem, setPendingQuantityUpdatesSafe]);

  const handleCloseModal = () => {
    // Capturar snapshot para uso en background o rollback
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

    // Si no hay productos, la mesa debe quedar disponible.
    if (effectiveItemsSnapshot.length === 0) {
      if (hasOrderTotalSignal) {
        setError('⚠️ Detectamos una orden en sincronización. No se liberó la mesa automáticamente.');
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

    // Función que ejecuta la limpieza en background (elim/actualiza en DB)
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

        await updateOrderTotal(mesaSnapshot.current_order_id, effectiveItemsSnapshot);
      } catch {
        // Rollback: recargar mesas para sincronizar estado
        try { await loadMesas(); } catch { /* no-op */ }
      }
    };

    if (mesaSnapshot && effectiveItemsSnapshot.length > 0) {
      setSuccessTitle('✨ Mesa Actualizada');
      setSuccessDetails([
        { label: 'Mesa', value: `#${mesaSnapshot.table_number}` },
        { label: 'Estado', value: 'Actualizada' }
      ]);
      setAlertType('update');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    }

    // Cerrar modal y limpiar estado local inmediatamente, delegando trabajo a background
    closeModalImmediate(() => {
      orderItemsDirtyRef.current = false;
      setShowOrderDetails(false);
      setModalOpenIntent(false);
      setSelectedMesa(null);
      orderItemsRef.current = [];
      setOrderItems([]);
      setPendingQuantityUpdatesSafe({});
    }, backgroundWork);
  };

  const handleCloseOrder = () => {
    // Mostrar elección: pagar todo junto o dividir cuenta
    setShowCloseOrderChoiceModal(true);
  };

  const handlePayAllTogether = () => {
    setShowCloseOrderChoiceModal(false);
    setShowSplitBillModal(false);
    setAmountReceived(String(Math.round(orderTotal || 0)));
    setAmountReceivedError('');
    setShowPaymentModal(true);
  };

  const handleSplitBill = () => {
    setShowCloseOrderChoiceModal(false);
    setShowSplitBillModal(true);
  };

  const tryAutoPrintReceiptBySaleId = useCallback(async (saleId) => {
    if (!isAutoPrintReceiptEnabled() || !saleId) return;

    try {
      const { saleRow, saleDetails } = await getSalePrintBundle({
        businessId,
        saleId
      });

      if (!saleRow || !Array.isArray(saleDetails) || saleDetails.length === 0) return;

      const printResult = printSaleReceipt({
        sale: saleRow,
        saleDetails,
        sellerName: saleRow.seller_name || 'Empleado'
      });

      if (!printResult.ok) {
        setError('⚠️ La venta se cerró, pero no se pudo imprimir el recibo automáticamente.');
      }
    } catch {
      setError('⚠️ La venta se cerró, pero no se pudo imprimir el recibo automáticamente.');
    }
  }, [businessId]);

  const processSplitPaymentAndClose = async ({ subAccounts }) => {
    if (isClosingOrder) return;

    if (insufficientItems.length > 0) {
      const firstShortage = insufficientItems[0];
      setError(
        `❌ Stock insuficiente para "${firstShortage.product_name}" ` +
        `(disp: ${firstShortage.available_stock}, req: ${firstShortage.quantity}).`
      );
      return;
    }

    if (hasInsufficientComboStock) {
      const firstShortage = insufficientComboComponents[0];
      setError(
        `❌ Stock insuficiente para "${firstShortage.product_name}" ` +
        `(disp: ${firstShortage.available_stock}, req: ${firstShortage.required_quantity}).`
      );
      return;
    }

    setIsClosingOrder(true);
    setIsGeneratingSplitSales(true);
    setError(null);

    const mesaSnapshot = selectedMesa ? { ...selectedMesa } : null;
    if (!mesaSnapshot?.id || !mesaSnapshot?.current_order_id) {
      setError('❌ No se encontró una orden activa para cerrar.');
      setIsGeneratingSplitSales(false);
      setIsClosingOrder(false);
      return;
    }
    const optimisticSplitTotal = (subAccounts || []).reduce(
      (sum, sub) => sum + Number(sub?.total || 0),
      0
    );

    // Cierre optimista inmediato (igual que cierre normal): no bloquear UX.
    setMesas((prevMesas) =>
      prevMesas.map((mesa) => (
        mesa.id === mesaSnapshot.id
          ? { ...mesa, status: 'available', current_order_id: null, orders: null }
          : mesa
      ))
    );
    clearClosedMesaCache({
      tableId: mesaSnapshot.id,
      orderId: mesaSnapshot.current_order_id
    }).catch(() => {});
    justCompletedSaleRef.current = true;
    setCanShowOrderModal(false);
    setShowSplitBillModal(false);
    setShowCloseOrderChoiceModal(false);
    setShowPaymentModal(false);
    setShowOrderDetails(false);
    setModalOpenIntent(false);
    setSelectedMesa(null);
    orderItemsDirtyRef.current = false;
    orderItemsRef.current = [];
    setOrderItems([]);
    setPendingQuantityUpdatesSafe({});
    setIsGeneratingSplitSales(false);
    setIsClosingOrder(false);
    setSuccessDetails([
      { label: 'Total', value: formatPrice(optimisticSplitTotal) },
      { label: 'Mesa', value: `#${mesaSnapshot.table_number}` },
      { label: 'Cuentas', value: subAccounts.length },
      { label: 'Sincronización', value: 'Procesando en segundo plano' }
    ]);
    setSuccessTitle('✨ Venta Registrada');
    setAlertType('success');
    setSuccess(true);

    try {
      const closeResult = await closeOrderAsSplit(businessId, {
        subAccounts,
        orderId: mesaSnapshot.current_order_id,
        tableId: mesaSnapshot.id
      });
      const {
        saleIds = [],
        localOnly = false
      } = closeResult || {};

      // En local-first ya quedó encolado; no mantener alerta de "generando".
      if (localOnly) {
        setIsGeneratingSplitSales(false);
        setIsClosingOrder(false);
      }

      if (!localOnly) {
        for (const saleId of saleIds) {
          // best-effort: no bloquear cierre si falla la impresión de alguno
          await tryAutoPrintReceiptBySaleId(saleId);
        }
      }

      if (!localOnly) {
        loadMesas().catch(() => {});
      }

      setTimeout(() => {
        justCompletedSaleRef.current = false;
        setCanShowOrderModal(true);
      }, MODAL_REOPEN_GUARD_MS);
      } catch (error) {
        setError(buildDiagnosticAlertMessage(error, 'No se pudo cerrar la orden. Revirtiendo estado.'));
        try { await loadMesas(); } catch { /* no-op */ }
        try { justCompletedSaleRef.current = false; setCanShowOrderModal(true); } catch { /* no-op */ }
      } finally {
        setIsGeneratingSplitSales(false);
        setIsClosingOrder(false);
    }
  };

  const processPaymentAndClose = async () => {
    // Prevenir doble click
    if (isClosingOrder) return;

    if (insufficientItems.length > 0) {
      const firstShortage = insufficientItems[0];
      setError(
        `❌ Stock insuficiente para "${firstShortage.product_name}" ` +
        `(disp: ${firstShortage.available_stock}, req: ${firstShortage.quantity}).`
      );
      return;
    }

    if (hasInsufficientComboStock) {
      const firstShortage = insufficientComboComponents[0];
      setError(
        `❌ Stock insuficiente para "${firstShortage.product_name}" ` +
        `(disp: ${firstShortage.available_stock}, req: ${firstShortage.required_quantity}).`
      );
      return;
    }

    const paymentSnapshot = paymentMethod;
    const amountReceivedSnapshot = amountReceived;
    const normalizedAmountReceived = parseCopAmount(amountReceivedSnapshot);
    const cashChangeData = paymentSnapshot === 'cash'
      ? calcularCambio(orderTotal, amountReceivedSnapshot)
      : null;

    if (paymentSnapshot === 'cash') {
      if (!cashChangeData?.isValid) {
        setError(cashChangeData?.reason === 'insufficient'
          ? '❌ El monto recibido es menor al total de la cuenta.'
          : '❌ Ingresa un monto recibido válido.');
        return;
      }
    }

    setIsClosingOrder(true);
    setError(null);

    // Snapshot
    const mesaSnapshot = selectedMesa ? { ...selectedMesa } : null;
    const orderItemsSnapshot = Array.isArray(orderItemsRef.current) ? [...orderItemsRef.current] : [];
    const optimisticSaleTotal = calculateOrderItemsTotal(orderItemsSnapshot);

    // Optimistic UI: mark mesa available and close modal immediately
    if (mesaSnapshot) {
      setMesas(prevMesas => prevMesas.map(m => (
        m.id === mesaSnapshot.id
          ? { ...m, status: 'available', current_order_id: null, orders: null }
          : m
      )));
      clearClosedMesaCache({
        tableId: mesaSnapshot.id,
        orderId: mesaSnapshot.current_order_id
      }).catch(() => {});
    }
    setShowPaymentModal(false);
    setShowOrderDetails(false);
    setModalOpenIntent(false);
    setSelectedMesa(null);
    orderItemsDirtyRef.current = false;
    orderItemsRef.current = [];
    setOrderItems([]);
    setPendingQuantityUpdatesSafe({});
    setPaymentMethod('cash');
    setAmountReceived('');
    setAmountReceivedError('');
    setSelectedCustomer('');

    // Prevent realtime reopens while background processes
    justCompletedSaleRef.current = true;
    setCanShowOrderModal(false);
    // No bloquear UX con alerta "generando" mientras encola localmente.
    setIsClosingOrder(false);
    setSuccessDetails([
      { label: 'Total', value: formatPrice(optimisticSaleTotal) },
      { label: 'Mesa', value: `#${mesaSnapshot?.table_number || '-'}` },
      { label: 'Método', value: getPaymentMethodLabel(paymentSnapshot) },
      { label: 'Sincronización', value: 'Procesando en segundo plano' }
    ]);
    setSuccessTitle('✨ Venta Registrada');
    setAlertType('success');
    setSuccess(true);

    (async () => {
      try {
        const closeResult = await closeOrderSingle(businessId, {
          orderId: mesaSnapshot.current_order_id,
          tableId: mesaSnapshot.id,
          paymentMethod: paymentSnapshot,
          amountReceived: paymentSnapshot === 'cash' ? normalizedAmountReceived : null,
          changeBreakdown: paymentSnapshot === 'cash' ? cashChangeData?.breakdown || [] : [],
          orderItems: orderItemsSnapshot
        });
        const { saleId, localOnly = false } = closeResult || {};

        // En local-first ya quedó encolado; no mantener alerta de "generando".
        if (localOnly) {
          setIsClosingOrder(false);
        }

        if (!localOnly && saleId) {
          await tryAutoPrintReceiptBySaleId(saleId);
        }

        if (!localOnly) {
          loadMesas().catch(() => {});
        }

        setTimeout(() => {
          justCompletedSaleRef.current = false;
          setCanShowOrderModal(true);
        }, MODAL_REOPEN_GUARD_MS);
      } catch (error) {
        setError(buildDiagnosticAlertMessage(error, 'No se pudo cerrar la orden. Revirtiendo estado.'));
        try { await loadMesas(); } catch { /* no-op */ }
        try { justCompletedSaleRef.current = false; setCanShowOrderModal(true); } catch { /* no-op */ }
      } finally {
        setIsClosingOrder(false);
      }
    })();
  };

  // Función para imprimir la orden (formato para cocina)
  const handlePrintOrder = () => {
    if (!selectedMesa || orderItems.length === 0) {
      setError('No hay productos en la orden para imprimir');
      setTimeout(() => setError(null), 3000);
      return;
    }

    // Filtrar solo productos que van a cocina (solo Platos)
    const categoriasParaCocina = ['Platos'];
    const itemsParaCocina = orderItems.filter(item => 
      item.combo_id || categoriasParaCocina.includes(item.products?.category)
    );

    // Si no hay nada para cocina, mostrar mensaje
    if (itemsParaCocina.length === 0) {
      setError('No hay productos que requieran preparación en cocina');
      setTimeout(() => setError(null), 3000);
      return;
    }

    // Crear contenido HTML para impresión
    const printerWidthMm = getThermalPaperWidthMm();
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Orden Mesa ${selectedMesa.table_number}</title>
        <style>
          @media print {
            @page {
              size: ${printerWidthMm}mm auto;
              margin: 2mm;
            }
            html, body {
              width: ${printerWidthMm}mm !important;
              height: auto !important;
              margin: 0;
              padding: 0;
            }
            .receipt {
              break-inside: avoid;
              page-break-inside: avoid;
            }
          }
          
          body {
            font-family: 'Courier New', monospace;
            font-size: 12px;
            line-height: 1.4;
            width: ${printerWidthMm}mm;
            max-width: ${printerWidthMm}mm;
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            background: #fff;
          }

          .receipt {
            display: block;
            width: 100%;
            margin: 0;
            padding: 2mm;
            box-sizing: border-box;
          }
          
          .header {
            text-align: center;
            border-bottom: 2px dashed #000;
            padding-bottom: 10px;
            margin-bottom: 10px;
          }
          
          .header h1 {
            font-size: 20px;
            margin: 0 0 5px 0;
            font-weight: bold;
          }
          
          .header p {
            margin: 2px 0;
            font-size: 11px;
          }
          
          .info {
            margin: 10px 0;
            font-size: 13px;
          }
          
          .info strong {
            font-weight: bold;
          }
          
          .items {
            margin: 15px 0;
          }
          
          .item {
            display: flex;
            justify-content: space-between;
            margin: 8px 0;
            padding: 5px 0;
            border-bottom: 1px dashed #ccc;
          }
          
          .item-name {
            flex: 1;
            font-weight: bold;
            font-size: 13px;
          }
          
          .item-qty {
            width: 60px;
            text-align: right;
            font-size: 13px;
            font-weight: bold;
          }
          
          .total {
            display: none;
          }
          
          .footer {
            text-align: center;
            margin-top: 20px;
            padding-top: 10px;
            border-top: 2px dashed #000;
            font-size: 11px;
          }
          
          .separator {
            border-top: 2px dashed #000;
            margin: 10px 0;
          }
        </style>
      </head>
      <body>
        <div class="receipt">
        <div class="header">
          <h1>ORDEN DE COCINA</h1>
          <p>Mesa #${selectedMesa.table_number}</p>
          <p>${formatDateTimeTicket(new Date())}</p>
        </div>
        
        <div class="info">
          <p><strong>Estado:</strong> ${selectedMesa.status === 'occupied' ? 'Ocupada' : 'Disponible'}</p>
          <p><strong>Productos:</strong> ${getTotalProductUnits(itemsParaCocina)} item${getTotalProductUnits(itemsParaCocina) !== 1 ? 's' : ''}</p>
        </div>
        
        <div class="separator"></div>
        
        <div class="items">
          ${itemsParaCocina.map(item => `
            <div class="item">
              <div class="item-name">${getOrderItemName(item)}</div>
              <div class="item-qty">x${item.quantity}</div>
            </div>
          `).join('')}
        </div>
        
        <div class="total">
          TOTAL: ${formatPrice(orderTotal)}
        </div>
        
        <div class="footer">
          <p>*** ORDEN PARA COCINA ***</p>
          <p>Sistema Stocky</p>
        </div>
        </div>
        
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() {
              window.close();
            }, 100);
          };
        </script>
      </body>
      </html>
    `;

    // Abrir ventana de impresión
    const printWindow = window.open('', '_blank', 'width=300,height=600');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
    } else {
      setError('No se pudo abrir la ventana de impresión. Verifica los permisos del navegador.');
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleDeleteTable = async (mesaId) => {
    setMesaToDelete(mesaId);
    setShowDeleteModal(true);
  };

  const confirmDeleteTable = async () => {
    if (!mesaToDelete) return;

    // Snapshot antes de eliminar
    const mesaId = mesaToDelete;
    const snapshotMesas = mesas.slice();
    const deletedTable = snapshotMesas.find((m) => m.id === mesaId) || null;
    const deletedTableLabel = deletedTable?.table_number ? `#${deletedTable.table_number}` : '-';

    // Aplicar cambio optimista: remover de UI inmediatamente
    setMesas(prevMesas => prevMesas.filter(m => m.id !== mesaId));
    if (selectedMesa?.id === mesaId) {
      closeModalImmediate(() => {
        orderItemsDirtyRef.current = false;
        setShowOrderDetails(false);
        setModalOpenIntent(false);
        setSelectedMesa(null);
        orderItemsRef.current = [];
        setOrderItems([]);
        setPendingQuantityUpdatesSafe({});
      });
    }
    setShowDeleteModal(false);
    setMesaToDelete(null);

    try {
      const deleteResult = await deleteTableCascadeOrders(mesaId, { businessId });

      setAlertType('success');
      setSuccessTitle('🗑️ Mesa Eliminada');
      setSuccessDetails([
        { label: 'Mesa', value: deletedTableLabel }
      ]);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);

      // Recargar mesas para asegurar sincronización con servidor (cuando aplica).
      if (!deleteResult?.__localOnly) {
        await loadMesas();
      }
    } catch (error) {
      const message = String(error?.message || '').trim();
      const code = String(error?.code || '').trim();
      const details = String(error?.details || '').trim();
      const hint = String(error?.hint || '').trim();
      const diag = [code ? `code=${code}` : null, hint ? `hint=${hint}` : null, details ? `details=${details}` : null]
        .filter(Boolean)
        .join(' | ');
      setError(`❌ No se pudo eliminar la mesa. Revirtiendo estado.${message ? ` ${message}` : ''}${diag ? ` [${diag}]` : ''}`);
      // Rollback: restaurar snapshot
      setMesas(snapshotMesas);
      setTimeout(() => setError(null), 5000);
    }
  };

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
      manage_stock: producto.manage_stock !== false
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
      combo_items: combo.combo_items || []
    }));

    return [...comboItems, ...productItems];
  }, [productos, combos]);

  const filteredCatalog = useMemo(() => {
    if (!searchProduct.trim()) return [];
    const search = searchProduct.toLowerCase();
    return catalogItems
      .filter((item) =>
        item.name.toLowerCase().includes(search) ||
        item.code.toLowerCase().includes(search)
      )
      .slice(0, 8);
  }, [searchProduct, catalogItems]);

  const orderTotal = useMemo(() => {
    return calculateOrderItemsTotal(orderItems);
  }, [orderItems]);

  useEffect(() => {
    if (!selectedMesa?.id) return;
    if (!selectedMesa?.current_order_id) return;

    const selectedOrderId = String(selectedMesa.current_order_id);
    const scopedOrderItems = Array.isArray(orderItems)
      ? orderItems.filter((item) => {
        const itemOrderId = String(item?.order_id || '').trim();
        if (!itemOrderId) return true;
        return itemOrderId === selectedOrderId;
      })
      : [];

    const localUnits = getTotalProductUnits(scopedOrderItems);
    const localTotal = calculateOrderItemsTotal(scopedOrderItems);

    setMesas((prevMesas) => prevMesas.map((mesa) => {
      if (mesa.id !== selectedMesa.id) return mesa;

      const currentOrderItems = Array.isArray(mesa?.orders?.order_items) ? mesa.orders.order_items : [];
      const shouldReplaceOrderItems = scopedOrderItems.length > 0 || currentOrderItems.length === 0;
      const forceEmptyFromLocalEdits = orderItemsDirtyRef.current && scopedOrderItems.length === 0;

      return {
        ...mesa,
        orders: {
          ...(mesa.orders || {}),
          id: mesa?.orders?.id || selectedMesa.current_order_id || null,
          total: Number.isFinite(localTotal) ? localTotal : Number(mesa?.orders?.total || 0),
          local_units: localUnits,
          ...((shouldReplaceOrderItems || forceEmptyFromLocalEdits) ? { order_items: scopedOrderItems } : {})
        }
      };
    }));
  }, [selectedMesa, orderItems]);

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

  // Items simples que exceden stock disponible (informativo).
  const insufficientItems = useMemo(() => {
    if (!orderItems || orderItems.length === 0) return [];
    return orderItems
      .filter((item) => !item.combo_id)
      .map((item) => {
        const prod = productos.find(p => p.id === item.product_id);
        if (!prod || prod.manage_stock === false) return null;
        return prod ? { ...item, available_stock: prod.stock, product_name: prod.name } : null;
      })
      .filter(Boolean)
      .filter(i => typeof i.available_stock === 'number' && i.quantity > i.available_stock);
  }, [orderItems, productos]);

  // Validación crítica: stock interno requerido por combos.
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
      const product = productos.find((p) => p.id === productId);
      if (product?.manage_stock === false) return;
      const stock = Number(product?.stock || 0);
      if (stock >= requiredQty) return;

      shortages.push({
        product_id: productId,
        product_name: product?.name || 'Producto',
        available_stock: stock,
        required_quantity: requiredQty
      });
    });

    return shortages;
  }, [orderItems, comboById, productos]);

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


  return (
    <AsyncStateWrapper
      loading={loading}
      error={mesas.length === 0 ? error : null}
      dataCount={mesas.length}
      onRetry={loadData}
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
          {/* Alertas */}
          <AnimatePresence>
            {/* Alerta de procesamiento de ventas divididas */}
            <SaleUpdateAlert
              isVisible={isGeneratingSplitSales}
              onClose={() => {}}
              title="Generando ventas..."
              details={[]}
              duration={600000}
            />

            {/* Alerta de procesamiento para cierre normal (sin división) */}
            <SaleUpdateAlert
              isVisible={isClosingOrder && !isGeneratingSplitSales}
              onClose={() => {}}
              title="Generando venta..."
              details={[]}
              duration={600000}
            />

            {/* Alerta de éxito - verde */}
            <SaleSuccessAlert 
              isVisible={success && alertType === 'success'}
              onClose={() => setSuccess(false)}
              title={successTitle}
              details={successDetails}
              duration={6000}
            />
            
            {/* Alerta de actualización de mesa con icono de check */}
            <SaleSuccessAlert 
              isVisible={success && alertType === 'update'}
              onClose={() => setSuccess(false)}
              title={successTitle}
              details={successDetails}
              duration={5000}
            />
            
            {/* Alerta de error - rojo */}
            <SaleErrorAlert 
              isVisible={!!error}
              onClose={() => setError(null)}
              title="❌ Error"
              message={error || ''}
              details={[]}
              duration={7000}
            />
          </AnimatePresence>

          {/* Formulario para agregar mesa */}
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
                          {isCreatingTable ? (
                            <>
                              Creando mesa...
                            </>
                          ) : (
                            <>
                              <Plus className="w-4 h-4 mr-2" />
                              Crear Mesa
                            </>
                          )}
                        </Button>
                        <Button 
                          type="button" 
                          variant="outline"
                          className="border-2 border-accent-300 text-accent-700 hover:bg-accent-50 h-12 w-full sm:w-auto"
                          onClick={() => {
                            setShowAddForm(false);
                            setNewTableNumber('');
                          }}
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

          {/* Grid de mesas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {mesas.map((mesa, index) => (
              <motion.div
                key={mesa.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card
                  className={`relative cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${
                    mesa.status === 'occupied' 
                      ? 'border-yellow-400 bg-yellow-50/30' 
                      : 'border-green-400 bg-green-50/30'
                  }`}
                  onClick={() => handleOpenTable(mesa)}
                >
                  <CardContent className="pt-6 text-center">
                    {/* Botón eliminar (solo si está disponible y no es empleado) */}
                    {mesa.status === 'available' && !isEmployee && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTable(mesa.id);
                        }}
                        className="absolute top-2 right-2 h-8 w-8 p-0 hover:bg-red-100 hover:text-red-600 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}

                    {/* Icono de estado */}
                    <div className="mb-4 flex justify-center">
                      <div className={`w-20 h-20 rounded-2xl flex items-center justify-center ${
                        mesa.status === 'occupied' 
                          ? 'bg-yellow-100 text-yellow-600' 
                          : 'bg-green-100 text-green-600'
                      }`}>
                        <Layers className="w-10 h-10" />
                      </div>
                    </div>

                    {/* Número de mesa */}
                    <h3 className="text-2xl font-bold text-primary-900 mb-2">
                      Mesa {mesa.table_number}
                    </h3>

                    {/* Estado */}
                    <Badge 
                      variant={mesa.status === 'occupied' ? 'warning' : 'success'}
                      className="mb-3 text-sm font-semibold"
                    >
                      {mesa.status === 'occupied' ? '🔴 Ocupada' : '🟢 Disponible'}
                    </Badge>

                    {/* Información de la orden si está ocupada */}
                    {mesa.status === 'occupied' && mesa.orders && (
                      <div className="mt-4 pt-4 border-t border-accent-200">
                        <p className="text-lg font-bold text-primary-900">
                          {formatPrice(parseFloat(mesa.orders.total || 0))}
                        </p>
                        <p className="text-sm text-primary-600">
                          {getMesaProductUnits(mesa, { selectedMesa, orderItems })} productos
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Mensaje si no hay mesas */}
          {mesas.length === 0 && !loading && (
            <div className="text-center py-12">
              <div className="w-20 h-20 rounded-full bg-accent-100 flex items-center justify-center mx-auto mb-4">
                <Layers className="w-10 h-10 text-accent-600" />
              </div>
              <h3 className="text-xl font-semibold text-primary-900 mb-2">
                No hay mesas creadas
              </h3>
              <p className="text-primary-600 mb-6">
                Comienza agregando tu primera mesa
              </p>
              {canManageTables && (
                <Button 
                  onClick={() => setShowAddForm(true)}
                  className="gradient-primary text-white hover:opacity-90"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Agregar Mesa
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de detalles de la orden */}
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
                  {/* Buscar producto o combo */}
                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-primary-700 mb-3">
                      <Search className="w-4 h-4 inline mr-2" />
                      Agregar Producto o Combo
                    </label>
                    <Input
                      type="text"
                      placeholder="Buscar por nombre..."
                      value={searchProduct}
                      onChange={(e) => setSearchProduct(e.target.value)}
                      className="h-12 border-accent-300"
                    />
                    
                    <AnimatePresence>
                      {searchProduct && filteredCatalog.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="mt-2 border-2 border-accent-200 rounded-2xl overflow-hidden max-h-60 overflow-y-auto shadow-lg"
                        >
                          {filteredCatalog.map((catalogItem, index) => (
                            <motion.div
                              key={`${catalogItem.item_type}:${catalogItem.id}`}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: index * 0.02 }}
                              onClick={() => {
                                addCatalogItemToOrder(catalogItem);
                              }}
                              className="p-4 border-b border-accent-100 last:border-0 transition-colors flex cursor-pointer justify-between items-center hover:bg-accent-50"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-semibold text-primary-900 truncate">
                                  {catalogItem.name}
                                </span>
                                {catalogItem.item_type === ORDER_ITEM_TYPE.COMBO && (
                                  <Badge className="bg-blue-100 text-blue-700">Combo</Badge>
                                )}
                              </div>
                              <span className="text-lg font-bold text-green-600">
                                {formatPrice(catalogItem.sale_price || 0)}
                              </span>
                            </motion.div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Items de la orden */}
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-primary-900 mb-4">Items en la orden</h3>
                    {orderItems.length === 0 ? (
                      <div className="text-center py-12">
                        <div className="w-16 h-16 rounded-full bg-accent-100 flex items-center justify-center mx-auto mb-3">
                          <ShoppingCart className="w-8 h-8 text-accent-600" />
                        </div>
                        <p className="text-accent-600">No hay items en esta orden</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        {orderItems.map((item, index) => (
                          <motion.div
                            key={getOrderItemRenderKey(item, index)}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                          >
                            <Card className="border-accent-200 hover:shadow-md transition-shadow">
                              <CardContent className="pt-4">
                                <div className="flex flex-col gap-3">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                      <h4 className="font-semibold text-primary-900 text-sm sm:text-base leading-tight">
                                        {getOrderItemName(item)}
                                      </h4>
                                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                                        {item.combo_id && (
                                          <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 font-medium">
                                            Combo
                                          </span>
                                        )}
                                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium">
                                          {formatPrice(parseFloat(item.price))} por unidad
                                        </span>
                                      </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                      <p className="text-lg font-bold text-primary-900">
                                        {formatPrice(parseFloat(item.subtotal))}
                                      </p>
                                      <p className="text-[11px] text-accent-600">Subtotal</p>
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-between pt-2 border-t border-accent-100">
                                    <div className="inline-flex items-center gap-1.5 rounded-xl border border-accent-200 bg-white p-1">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => updateItemQuantity(item.id, toFiniteNumber(item.quantity, 0) - 1)}
                                        disabled={isOrderItemsSyncing}
                                        className="h-8 w-8 p-0 border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                      >
                                        -
                                      </Button>
                                      <span className="w-10 text-center font-bold text-primary-900">
                                        {item.quantity}
                                      </span>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => updateItemQuantity(item.id, toFiniteNumber(item.quantity, 0) + 1)}
                                        disabled={isOrderItemsSyncing}
                                        className="h-8 w-8 p-0 border-green-300 text-green-600 hover:bg-green-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                      >
                                        +
                                      </Button>
                                    </div>

                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>

                {/* Total y acciones */}
                <div className="border-t-2 border-accent-200 bg-accent-50/30 p-4 sm:p-6 shrink-0">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <p className="text-sm text-primary-600 mb-1">Total a pagar</p>
                      <h3 className="text-2xl sm:text-3xl font-bold text-primary-900">
                        {formatPrice(orderTotal)}
                      </h3>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                      <Button
                        onClick={handleRefreshOrder}
                        variant="outline"
                        disabled={isOrderItemsSyncing}
                        className="border-2 border-accent-300 text-accent-700 hover:bg-accent-50 h-12 px-6 w-full sm:w-auto"
                      >
                        <Save className="w-5 h-5 mr-2" />
                        {isOrderItemsSyncing ? 'Sincronizando...' : 'Guardar'}
                      </Button>
                      <Button
                        onClick={handlePrintOrder}
                        variant="outline"
                        className="border-2 border-blue-300 text-blue-700 hover:bg-blue-50 h-12 px-6 w-full sm:w-auto"
                        disabled={orderItems.length === 0}
                      >
                        <Printer className="w-5 h-5 mr-2" />
                        Imprimir para cocina
                      </Button>
                      <Button
                        onClick={handleCloseOrder}
                        disabled={orderItems.length === 0}
                        className="gradient-primary text-white hover:opacity-90 h-12 px-8 text-lg w-full sm:w-auto"
                      >
                        <CheckCircle2 className="w-5 h-5 mr-2" />
                        Cerrar Orden
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de elección: pagar todo junto o dividir cuenta */}
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
                  <p className="text-sm text-primary-600 mt-1">
                    Total: {formatPrice(orderTotal)}
                  </p>
                </CardHeader>
                <CardContent className="pt-6 space-y-3">
                  <Button
                    onClick={handlePayAllTogether}
                    className="w-full h-12 gradient-primary text-white hover:opacity-90"
                  >
                    <CheckCircle2 className="w-5 h-5 mr-2" />
                    Pagar todo junto
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleSplitBill}
                    className="w-full h-12 border-2 border-accent-300 text-accent-700 hover:bg-accent-50"
                  >
                    <Layers className="w-5 h-5 mr-2" />
                    Dividir cuenta
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setShowCloseOrderChoiceModal(false)}
                    className="w-full h-10 text-primary-600 hover:bg-accent-50"
                  >
                    Cancelar
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal dividir cuenta */}
      <AnimatePresence>
        {showSplitBillModal && (
          <SplitBillModal
            orderItems={orderItems}
            onConfirm={processSplitPaymentAndClose}
            onCancel={() => {
              setShowSplitBillModal(false);
              setShowCloseOrderChoiceModal(true);
            }}
          />
        )}
      </AnimatePresence>

      {/* Modal de pago */}
      <AnimatePresence>
        {showPaymentModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start sm:items-center justify-center z-[60] p-3 sm:p-4 overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl max-w-6xl w-full my-2 sm:my-4"
            >
              <Card className="border-0">
                <CardHeader className="border-b border-accent-100 bg-gradient-to-r from-primary-50 to-accent-50">
                  <CardTitle className="text-xl sm:text-2xl font-bold text-primary-900">
                    💳 Confirmar Pago
                  </CardTitle>
                </CardHeader>

                <CardContent className="pt-4 sm:pt-6 space-y-4 sm:space-y-5">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-1 bg-accent-50 rounded-2xl border-2 border-accent-200 p-4 sm:p-5">
                      <p className="text-xs uppercase tracking-wide text-primary-600 mb-1">Total a pagar</p>
                      <h3 className="text-3xl sm:text-4xl font-bold text-primary-900">
                        {formatPrice(orderTotal)}
                      </h3>
                      <div className="mt-4 space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-primary-600">Cambio a devolver</span>
                          <span className={`font-bold ${paymentMethod === 'cash' && cambioPago?.isValid ? 'text-green-700' : 'text-primary-900'}`}>
                            {paymentMethod === 'cash' && cambioPago?.isValid ? formatPrice(cambioPago.change) : formatPrice(0)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="lg:col-span-1 space-y-3">
                      <div>
                        <label className="block text-sm font-semibold text-primary-700 mb-1.5">
                          Método de Pago *
                        </label>
                        <select
                          value={paymentMethod}
                          onChange={(e) => {
                            const nextMethod = e.target.value;
                            setPaymentMethod(nextMethod);
                            if (nextMethod !== 'cash') {
                              setAmountReceivedError('');
                            }
                          }}
                          className="w-full h-11 px-3 rounded-xl border-2 border-accent-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-all"
                        >
                          <option value="cash">💵 Efectivo</option>
                          <option value="card">💳 Tarjeta</option>
                          <option value="transfer">🏦 Transferencia</option>
                          <option value="mixed">🔄 Mixto</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-primary-700 mb-1.5">
                          Cliente (Opcional)
                        </label>
                        <select
                          value={selectedCustomer}
                          onChange={(e) => setSelectedCustomer(e.target.value)}
                          className="w-full h-11 px-3 rounded-xl border-2 border-accent-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-all"
                        >
                          <option value="">Venta general</option>
                          {clientes.map(cliente => (
                            <option key={cliente.id} value={cliente.id}>
                              {cliente.full_name} - {cliente.email}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-primary-700 mb-1.5">
                          Monto recibido
                        </label>
                        <Input
                          type="number"
                          inputMode="numeric"
                          min="0"
                          step="50"
                          value={amountReceived}
                          onChange={(e) => {
                            const nextValue = e.target.value;
                            setAmountReceived(nextValue);

                            if (paymentMethod !== 'cash') {
                              setAmountReceivedError('');
                              return;
                            }

                            if (nextValue === '') {
                              setAmountReceivedError('Ingresa el monto recibido.');
                              return;
                            }

                            const validation = calcularCambio(orderTotal, nextValue);
                            if (!validation.isValid) {
                              if (validation.reason === 'insufficient') {
                                setAmountReceivedError('El monto recibido es menor al total.');
                                return;
                              }
                              setAmountReceivedError('Ingresa un monto recibido válido.');
                              return;
                            }

                            setAmountReceivedError('');
                          }}
                          className={`h-11 border-2 ${amountReceivedError ? 'border-red-400 focus:border-red-500 focus:ring-red-200' : 'border-accent-300 focus:border-primary-500 focus:ring-primary-200'} transition-all`}
                          placeholder="Ej: 100000"
                        />
                        {amountReceivedError && paymentMethod === 'cash' && (
                          <p className="mt-1.5 text-xs text-red-600">{amountReceivedError}</p>
                        )}
                      </div>
                    </div>

                    <div className="lg:col-span-1 rounded-xl border border-accent-200 bg-white p-4 space-y-2">
                      <p className="text-xs uppercase tracking-wide text-primary-600">Desglose del cambio</p>
                      {paymentMethod === 'cash' && cambioPago?.isValid && cambioPago.change > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-1">
                          {cambioPago.breakdown.map(({ denomination, count }) => (
                            <p key={denomination} className="text-sm text-primary-700">
                              {count} x {formatPrice(denomination)}
                            </p>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-primary-600">Sin cambio para devolver.</p>
                      )}
                    </div>
                  </div>

                  {insufficientItems.length > 0 && (
                    <div className="p-3 rounded-lg border border-red-200 bg-red-50 flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-600" />
                        <div>
                          <p className="text-sm font-semibold text-red-800">Stock insuficiente ({insufficientItems.length})</p>
                          <p className="text-xs text-red-700">Corrige antes de cerrar la orden.</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {insufficientItems.map(it => (
                          <div key={it.id || `${it.product_id}-${it.quantity}`} className="text-xs text-red-700">
                            <strong className="text-primary-900">{it.product_name}</strong>
                            <div>Disp: {it.available_stock} / Ped: {it.quantity}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {insufficientComboComponents.length > 0 && (
                    <div className="p-3 rounded-lg border border-red-300 bg-red-50 flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-700" />
                        <div>
                          <p className="text-sm font-semibold text-red-900">Stock insuficiente en componentes de combos ({insufficientComboComponents.length})</p>
                          <p className="text-xs text-red-800">No se puede confirmar la venta hasta corregir estas cantidades.</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {insufficientComboComponents.map((item) => (
                          <div key={item.product_id} className="text-xs text-red-800">
                            <strong className="text-primary-900">{item.product_name}</strong>
                            <div>Disp: {item.available_stock} / Req: {item.required_quantity}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 pt-1">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowPaymentModal(false);
                        setPaymentMethod('cash');
                        setAmountReceived('');
                        setAmountReceivedError('');
                        setSelectedCustomer('');
                      }}
                      disabled={isClosingOrder}
                      className="flex-1 h-12 border-2 border-accent-300 text-accent-700 hover:bg-accent-50 disabled:opacity-50"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={processPaymentAndClose}
                      disabled={
                        isClosingOrder
                        || insufficientItems.length > 0
                        || hasInsufficientComboStock
                        || (paymentMethod === 'cash' && (amountReceived === '' || isCashPaymentInvalid))
                      }
                      className="flex-1 h-12 gradient-primary text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isClosingOrder ? (
                        <>
                          <div className="w-5 h-5 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Procesando venta...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-5 h-5 mr-2" />
                          Confirmar Venta
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de confirmación de eliminación */}
      <AnimatePresence>
        {showDeleteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70] p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl max-w-md w-full"
            >
              <Card className="border-0">
                <CardHeader className="border-b border-accent-100 bg-gradient-to-r from-red-50 to-orange-50">
                  <CardTitle className="text-2xl font-bold text-red-900 flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-red-500 flex items-center justify-center">
                      <AlertCircle className="w-6 h-6 text-white" />
                    </div>
                    Confirmar Eliminación
                  </CardTitle>
                </CardHeader>

                <CardContent className="pt-6 space-y-6">
                  <p className="text-lg text-primary-700">
                    ¿Estás seguro de que deseas eliminar esta mesa?
                  </p>
                  <p className="text-sm text-primary-600">
                    Esta acción no se puede deshacer.
                  </p>

                  <div className="flex gap-3 pt-4">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowDeleteModal(false);
                        setMesaToDelete(null);
                      }}
                      className="flex-1 h-12 border-2 border-accent-300 text-accent-700 hover:bg-accent-50"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={confirmDeleteTable}
                      className="flex-1 h-12 bg-red-500 hover:bg-red-600 text-white"
                    >
                      <Trash2 className="w-5 h-5 mr-2" />
                      Eliminar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      </motion.section>
    </AsyncStateWrapper>
  );
}

export default Mesas;
