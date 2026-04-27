import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, Alert, Image, Keyboard, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { STOCKY_COLORS, STOCKY_RADIUS } from '../../theme/tokens';
import { StockyDeleteConfirmModal } from '../../ui/StockyDeleteConfirmModal';
import { StockyMoneyText } from '../../ui/StockyMoneyText';
import { StockyModal } from '../../ui/StockyModal';
import { StockyStatusToast } from '../../ui/StockyStatusToast';
import { PrintReceiptConfirmModal } from '../../ui/PrintReceiptConfirmModal';
import { buildKitchenOrderHtml, buildSaleReceiptHtml } from '../../utils/printTemplates';
import {
  addCatalogItemToOrder,
  calculateCashChange,
  calculateOrderTotal,
  buildCatalogLookup,
  evaluateOrderStockShortagesWithLookup,
  getOrderItemName,
  getOrderItemsCacheSnapshot,
  listCatalogItems,
  listOrderItemUnitsByOrderIds,
  listOrderItems,
  loadOpenOrderSnapshot,
  persistOrderSnapshot,
  removeOrderItemFromOrder,
  setOrderItemsCacheSnapshot,
  syncOrderItemQuantity,
  type ComboComponentShortage,
  type MesaOrderCatalogItem,
  type MesaOrderItem,
  type StockShortage,
} from '../../services/mesaOrderService';
import {
  closeOrderAsSplit,
  closeOrderSingle,
  type PaymentMethod,
  type SplitSubAccount,
} from '../../services/mesaCheckoutService';
import {
  acquireMesaEditLock,
  createMesa,
  deleteMesaCascade,
  fetchMesasByBusinessId,
  listActiveMesaEditLocks,
  openCloseMesa,
  formatCop,
  refreshMesaEditLockHeartbeat,
  releaseMesaEditLock,
  resolveBusinessContext,
  resolveMesaEditorDisplayName,
  type BusinessContext,
  type MesaEditLock,
  type MesaRecord,
} from '../../services/mesasService';
import { listVentaDetails, type VentaRecord } from '../../services/ventasService';
import { SplitBillModalRN } from './SplitBillModalRN';
import { getSupabaseClient } from '../../lib/supabase';
import { getBankLogoSource, isBankPaymentMethod } from '../../utils/paymentMethodBranding';
import { getThermalPaperWidthMm, isAutoPrintReceiptEnabled } from '../../utils/printer';

type Props = {
  session: Session;
  businessContext?: BusinessContext | null;
};

type HeldMesaLock = {
  businessId: string;
  tableId: string;
  lockToken: string | null;
};

const COLOMBIAN_DENOMINATIONS = [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50];
const CATALOG_LOCAL_TTL_MS = 180_000;
const MESA_IN_USE_MESSAGE = 'Alguien esta usando esta mesa.';
const CATALOG_STORAGE_PREFIX = 'stocky:mesa-catalog:';
const MESA_SYNC_TRACE_ENABLED = __DEV__;

type RealtimeUiTrace = {
  source: 'tables' | 'orders' | 'order_items' | 'mesa_broadcast' | 'mesa_lock';
  eventType: string;
  rowRef: string;
  receivedAt: number;
  commitLagMs: number | null;
};

function parseCommitLagMs(payload: any): number | null {
  const commitTimestamp = String(payload?.commit_timestamp || '').trim();
  if (!commitTimestamp) return null;
  const commitMs = Date.parse(commitTimestamp);
  if (!Number.isFinite(commitMs)) return null;
  return Math.max(0, Date.now() - commitMs);
}

function resolveRealtimeRowRef(payload: any): string {
  const rowId = String(payload?.new?.id || payload?.old?.id || '').trim();
  if (rowId) return rowId;
  const tableId = String(payload?.new?.table_id || payload?.old?.table_id || '').trim();
  if (tableId) return `table:${tableId}`;
  const orderId = String(payload?.new?.order_id || payload?.old?.order_id || '').trim();
  if (orderId) return `order:${orderId}`;
  return 'unknown';
}

function traceMesaSync(label: string, data: Record<string, unknown>) {
  if (!MESA_SYNC_TRACE_ENABLED) return;
  const safeData = Object.entries(data || {}).reduce<Record<string, unknown>>((acc, [key, value]) => {
    if (value === undefined) return acc;
    acc[key] = value;
    return acc;
  }, {});
  console.info(`[mesa-sync] ${label}`, safeData);
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

async function writeCatalogToStorage(businessId: string, items: MesaOrderCatalogItem[]) {
  const storageKey = `${CATALOG_STORAGE_PREFIX}${businessId}`;
  const payload: StoredCatalogSnapshot = {
    cachedAt: Date.now(),
    items,
  };
  try {
    await AsyncStorage.setItem(storageKey, JSON.stringify(payload));
  } catch {
    // no-op
  }
}

function isMesaOccupied(status: string | null | undefined) {
  return String(status || '').trim().toLowerCase() === 'occupied';
}

function normalizeTableIdentifier(value: string | number | null | undefined) {
  return String(value ?? '').trim();
}

function compareMesaTableIdentifiers(left: MesaRecord, right: MesaRecord) {
  const leftId = normalizeTableIdentifier(left?.table_number ?? left?.name ?? left?.id);
  const rightId = normalizeTableIdentifier(right?.table_number ?? right?.name ?? right?.id);

  return leftId.localeCompare(rightId, 'es', {
    numeric: true,
    sensitivity: 'base',
  });
}

function resolveMesaSyncVersion(mesa: Partial<MesaRecord> | null | undefined): number {
  const raw = Number((mesa as any)?.sync_version);
  if (!Number.isFinite(raw)) return 0;
  return Math.max(0, Math.floor(raw));
}

function mesaDisplayName(mesa: MesaRecord): string {
  if (mesa.name && String(mesa.name).trim()) return String(mesa.name).trim();
  if (mesa.table_number !== null && mesa.table_number !== undefined && String(mesa.table_number).trim()) {
    return `Mesa ${String(mesa.table_number).trim()}`;
  }
  return `Mesa ${mesa.id.slice(0, 6)}`;
}

function resolveSessionDisplayName(session: Session): string {
  const metadata = session?.user?.user_metadata && typeof session.user.user_metadata === 'object'
    ? session.user.user_metadata as Record<string, unknown>
    : {};

  const candidates = [
    metadata?.full_name,
    metadata?.name,
    metadata?.display_name,
    metadata?.username,
    session?.user?.email,
  ];

  for (const candidate of candidates) {
    const normalized = String(candidate ?? '').trim();
    if (normalized) return normalized;
  }

  return 'Usuario';
}

function getPaymentMethodLabel(method: PaymentMethod) {
  if (method === 'cash') return 'Efectivo';
  if (method === 'card') return 'Tarjeta';
  if (method === 'transfer') return 'Transferencia';
  if (method === 'mixed') return 'Mixto';
  if (method === 'nequi') return 'Nequi';
  if (method === 'bancolombia') return 'Bancolombia';
  if (method === 'banco_bogota') return 'Banco de Bogotá';
  if (method === 'nu') return 'Nu';
  if (method === 'davivienda') return 'Davivienda';
  return method;
}

function getPaymentMethodIcon(method: PaymentMethod): keyof typeof Ionicons.glyphMap {
  if (method === 'cash') return 'cash-outline';
  if (method === 'card') return 'card-outline';
  if (method === 'transfer') return 'swap-horizontal-outline';
  if (method === 'mixed') return 'wallet-outline';
  if (['nequi', 'bancolombia', 'banco_bogota', 'nu', 'davivienda'].includes(method)) return 'business-outline';
  return 'help-circle-outline';
}

const PAYMENT_METHOD_OPTIONS: Array<{ value: PaymentMethod; label: string }> = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'card', label: 'Tarjeta' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'mixed', label: 'Mixto' },
  { value: 'nequi', label: 'Nequi' },
  { value: 'bancolombia', label: 'Bancolombia' },
  { value: 'banco_bogota', label: 'Banco de Bogotá' },
  { value: 'nu', label: 'Nu' },
  { value: 'davivienda', label: 'Davivienda' },
];

function buildCashBreakdown(change: number) {
  let remaining = Math.round(Number(change || 0));
  const breakdown: Array<{ denomination: number; count: number }> = [];

  for (const denomination of COLOMBIAN_DENOMINATIONS) {
    const count = Math.floor(remaining / denomination);
    if (count > 0) {
      breakdown.push({ denomination, count });
      remaining -= count * denomination;
    }
  }

  return breakdown;
}

function sumOrderItemsQuantity(items: MesaOrderItem[]) {
  return (Array.isArray(items) ? items : []).reduce(
    (sum, item) => sum + Math.max(0, Number(item.quantity || 0)),
    0,
  );
}

function normalizeOrderReference(value: unknown): string {
  return String(value || '').trim();
}

function normalizeOrderItemQuantity(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
}

function normalizeOrderItemSubtotal(row: any): number {
  const subtotal = Number(row?.subtotal);
  if (Number.isFinite(subtotal)) {
    return Math.max(0, subtotal);
  }
  const quantity = normalizeOrderItemQuantity(row?.quantity);
  const price = Number(row?.price);
  const safePrice = Number.isFinite(price) ? price : 0;
  return Math.max(0, quantity * safePrice);
}

function formatCatalogItemMeta(item: MesaOrderCatalogItem) {
  const code = item.code ? `${item.code} · ` : '';
  if (item.item_type === 'combo') {
    const parts = Array.isArray(item.combo_items) ? item.combo_items.length : 0;
    return `${code}Combo (${parts} items)`;
  }

  return `${code}${item.manage_stock ? `Stock ${item.stock}` : 'Sin control de stock'}`;
}

function isSameOrderItemIdentity(left: MesaOrderItem, right: MesaOrderItem) {
  const leftProduct = String(left.product_id || '');
  const rightProduct = String(right.product_id || '');
  const leftCombo = String(left.combo_id || '');
  const rightCombo = String(right.combo_id || '');

  if (leftProduct && rightProduct) return leftProduct === rightProduct;
  if (leftCombo && rightCombo) return leftCombo === rightCombo;
  return false;
}

function reconcileOrderItemsFromServer(current: MesaOrderItem[], fromServer: MesaOrderItem[]) {
  const local = Array.isArray(current) ? current : [];
  const server = Array.isArray(fromServer) ? fromServer : [];

  const serverById = new Map(server.map((item) => [String(item.id || ''), item]));
  const serverByIdentity = new Map<string, MesaOrderItem>();
  server.forEach((item) => {
    const key = item.product_id ? `p:${item.product_id}` : item.combo_id ? `c:${item.combo_id}` : '';
    if (!key) return;
    if (!serverByIdentity.has(key)) {
      serverByIdentity.set(key, item);
    }
  });

  const usedServerIds = new Set<string>();

  const merged = local.map((localItem) => {
    const localId = String(localItem.id || '');
    const exact = localId ? serverById.get(localId) : null;
    if (exact) {
      usedServerIds.add(String(exact.id || ''));
      return exact;
    }

    const identityKey = localItem.product_id
      ? `p:${localItem.product_id}`
      : localItem.combo_id
        ? `c:${localItem.combo_id}`
        : '';
    if (identityKey) {
      const byIdentity = serverByIdentity.get(identityKey);
      if (byIdentity) {
        usedServerIds.add(String(byIdentity.id || ''));
        return byIdentity;
      }
    }

    return localItem;
  });

  server.forEach((serverItem) => {
    const serverId = String(serverItem.id || '');
    if (!serverId || usedServerIds.has(serverId)) return;
    merged.push(serverItem);
  });

  return merged;
}

function StatusPill({
  occupied,
  lockedByOther,
}: {
  occupied: boolean;
  lockedByOther: boolean;
}) {
  const locked = lockedByOther;
  return (
    <View style={[
      styles.statusPill,
      locked ? styles.statusLocked : (occupied ? styles.statusOccupied : styles.statusAvailable),
    ]}
    >
      <View style={[
        styles.statusDot,
        locked ? styles.statusDotLocked : (occupied ? styles.statusDotOccupied : styles.statusDotAvailable),
      ]}
      />
      <Text style={[
        styles.statusText,
        locked ? styles.statusLockedText : (occupied ? styles.statusOccupiedText : styles.statusAvailableText),
      ]}
      >
        {locked ? 'En uso' : (occupied ? 'Ocupada' : 'Disponible')}
      </Text>
    </View>
  );
}

const OrderItemRow = memo(function OrderItemRow({
  item,
  itemName,
  busy,
  disabled,
  onChangeQuantity,
}: {
  item: MesaOrderItem;
  itemName: string;
  busy: boolean;
  disabled: boolean;
  onChangeQuantity: (item: MesaOrderItem, delta: number) => void;
}) {
  return (
    <View style={styles.orderItemCard}>
      <View style={styles.orderItemTopRow}>
        <Text numberOfLines={1} style={styles.orderItemName}>{itemName}</Text>
        <StockyMoneyText value={Number(item.subtotal || 0)} style={styles.orderItemTotal} />
      </View>

      <View style={styles.orderItemMetaRow}>
        <View style={styles.orderItemUnitChip}>
          <Text style={styles.orderItemUnitChipText}>
            <StockyMoneyText value={Number(item.price || 0)} style={styles.orderItemUnitChipText} />
            {' '}por unidad
          </Text>
        </View>
        <Text style={styles.orderItemSubtotalLabel}>Subtotal</Text>
      </View>

      <View style={styles.orderItemDivider} />

      <View style={styles.orderItemControlsRow}>
        <View style={styles.orderItemStepper}>
          <Pressable
            style={[styles.orderItemStepperButton, busy && styles.actionButtonDisabled]}
            onPressIn={() => onChangeQuantity(item, -1)}
            disabled={busy || disabled}
            hitSlop={10}
            pressRetentionOffset={10}
          >
            <Text style={styles.orderItemMinusText}>-</Text>
          </Pressable>

          <Text style={styles.orderItemQtyText}>{item.quantity}</Text>

          <Pressable
            style={[styles.orderItemStepperButton, busy && styles.actionButtonDisabled]}
            onPressIn={() => onChangeQuantity(item, 1)}
            disabled={busy || disabled}
            hitSlop={10}
            pressRetentionOffset={10}
          >
            <Text style={styles.orderItemPlusText}>+</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
});

function StockShortageBanner({
  insufficientItems,
  insufficientComboComponents,
}: {
  insufficientItems: StockShortage[];
  insufficientComboComponents: ComboComponentShortage[];
}) {
  if (insufficientItems.length === 0 && insufficientComboComponents.length === 0) return null;

  return (
    <View style={styles.shortageContainer}>
      {insufficientItems.length > 0 ? (
        <View style={styles.shortageBlock}>
          <Text style={styles.shortageTitle}>Stock insuficiente en productos ({insufficientItems.length})</Text>
          {insufficientItems.slice(0, 5).map((item) => (
            <Text key={`${item.product_id}-${item.quantity}`} style={styles.shortageItem}>
              {item.product_name}: disp {item.available_stock} / req {item.quantity}
            </Text>
          ))}
        </View>
      ) : null}

      {insufficientComboComponents.length > 0 ? (
        <View style={styles.shortageBlock}>
          <Text style={styles.shortageTitle}>
            Stock insuficiente en componentes de combos ({insufficientComboComponents.length})
          </Text>
          {insufficientComboComponents.slice(0, 5).map((item) => (
            <Text key={item.product_id} style={styles.shortageItem}>
              {item.product_name}: disp {item.available_stock} / req {item.required_quantity}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function MesasPanel({ session, businessContext }: Props) {
  const [context, setContext] = useState<BusinessContext | null>(null);
  const [mesas, setMesas] = useState<MesaRecord[]>([]);
  const mesasLengthRef = useRef(0);
  const hasLoadedOnceRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingMesaId, setActingMesaId] = useState<string | null>(null);

  const [showCreateMesaModal, setShowCreateMesaModal] = useState(false);
  const [newTableNumber, setNewTableNumber] = useState('');
  const [isCreatingMesa, setIsCreatingMesa] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  const [showDeleteMesaModal, setShowDeleteMesaModal] = useState(false);
  const [mesaToDelete, setMesaToDelete] = useState<MesaRecord | null>(null);
  const [isDeletingMesa, setIsDeletingMesa] = useState(false);

  const [showOrderModal, setShowOrderModal] = useState(false);
  const [selectedMesa, setSelectedMesa] = useState<MesaRecord | null>(null);
  const [catalogItems, setCatalogItems] = useState<MesaOrderCatalogItem[]>([]);
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);
  const [orderItems, setOrderItems] = useState<MesaOrderItem[]>([]);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [orderModalError, setOrderModalError] = useState<string | null>(null);
  const [searchCatalog, setSearchCatalog] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [mutatingOrderItemId, setMutatingOrderItemId] = useState<string | null>(null);
  const [releasingEmptyOrder, setReleasingEmptyOrder] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const addCatalogQueueRef = useRef<Promise<void>>(Promise.resolve());
  const latestOrderItemsRef = useRef<MesaOrderItem[]>([]);
  const orderItemsCacheRef = useRef(new Map<string, MesaOrderItem[]>());
  const catalogBusinessIdRef = useRef<string | null>(null);
  const catalogUpdatedAtRef = useRef(0);
  const catalogItemsRef = useRef<MesaOrderCatalogItem[]>([]);
  const catalogLoadPromiseRef = useRef<Promise<MesaOrderCatalogItem[]> | null>(null);
  const orderModalOpenIntentRef = useRef(false);
  const mesasRealtimeRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mesaLocksRealtimeRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const orderRealtimeSummaryTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const mesasSyncBroadcastChannelRef = useRef<any>(null);
  const mesasSyncBroadcastReadyRef = useRef(false);
  const realtimeClientInstanceIdRef = useRef(`mesa-client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const selectedMesaIdRef = useRef<string>('');
  const mesaLockPlaceholderTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const pendingQuantityUpdatesRef = useRef(new Map<string, {
    orderId: string;
    itemId: string;
    quantity: number;
    price: number;
    total: number;
  }>());
  const quantitySyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingUiTraceRef = useRef<RealtimeUiTrace | null>(null);
  const mesaActionVersionRef = useRef<Record<string, number>>({});

  const [showCloseOrderChoiceModal, setShowCloseOrderChoiceModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showSplitBillModal, setShowSplitBillModal] = useState(false);
  const [isClosingOrder, setIsClosingOrder] = useState(false);
  const [showPaymentMethodMenu, setShowPaymentMethodMenu] = useState(false);
  const [showMesaCreatedToast, setShowMesaCreatedToast] = useState(false);
  const [mesaCreatedLabel, setMesaCreatedLabel] = useState('Mesa');
  const [showMesaDeletedToast, setShowMesaDeletedToast] = useState(false);
  const [mesaDeletedLabel, setMesaDeletedLabel] = useState('Mesa');
  const [showSaleToast, setShowSaleToast] = useState(false);
  const [saleMesaLabel, setSaleMesaLabel] = useState('Mesa');
  const [saleTotalLabel, setSaleTotalLabel] = useState('');
  const [showMesaSavedToast, setShowMesaSavedToast] = useState(false);
  const [mesaSavedLabel, setMesaSavedLabel] = useState('Mesa');

  // Estados para modal de impresión
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printSalesData, setPrintSalesData] = useState<Array<{ saleRecord: VentaRecord; saleDetails: any[] }>>([]);
  const [isPrintingReceipt, setIsPrintingReceipt] = useState(false);
  const [isPrintInProgress, setIsPrintInProgress] = useState(false);
  const printInFlightRef = useRef(false);

  const isOrderFlowActive = showOrderModal
    || showCloseOrderChoiceModal
    || showPaymentModal
    || showSplitBillModal
    || showPaymentMethodMenu;

  const beginPrintFlow = useCallback(() => {
    if (printInFlightRef.current) return false;
    printInFlightRef.current = true;
    setIsPrintInProgress(true);
    return true;
  }, []);

  const endPrintFlow = useCallback(() => {
    printInFlightRef.current = false;
    setIsPrintInProgress(false);
  }, []);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [amountReceived, setAmountReceived] = useState('');
  const [orderUnitsByOrderId, setOrderUnitsByOrderId] = useState<Record<string, number>>({});
  const [mesaLocksByTableId, setMesaLocksByTableId] = useState<Record<string, MesaEditLock>>({});
  const [actorDisplayName, setActorDisplayName] = useState(() => resolveSessionDisplayName(session));
  const sessionDisplayName = useMemo(() => resolveSessionDisplayName(session), [session]);
  const heldMesaLockRef = useRef<HeldMesaLock | null>(null);
  const canDeleteMesas = context?.source !== 'employee';

  const patchMesaOrderUnits = useCallback((orderId: string, units: number) => {
    const key = String(orderId || '').trim();
    if (!key) return;
    setOrderUnitsByOrderId((prev) => ({
      ...prev,
      [key]: Math.max(0, Math.floor(Number(units || 0))),
    }));
  }, []);

  const clearMesaOrderUnits = useCallback((orderId: string | null | undefined) => {
    const key = String(orderId || '').trim();
    if (!key) return;
    setOrderUnitsByOrderId((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

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

  const markRealtimeIngress = useCallback((
    source: RealtimeUiTrace['source'],
    payload: any,
  ) => {
    const eventType = String(payload?.eventType || '').trim().toUpperCase() || 'UNKNOWN';
    const rowRef = resolveRealtimeRowRef(payload);
    const commitLagMs = parseCommitLagMs(payload);
    const receivedAt = Date.now();
    pendingUiTraceRef.current = {
      source,
      eventType,
      rowRef,
      receivedAt,
      commitLagMs,
    };
    traceMesaSync('realtime_in', {
      source,
      eventType,
      rowRef,
      commitLagMs,
    });
  }, []);

  const traceAsyncDuration = useCallback((
    label: string,
    startMs: number,
    extra?: Record<string, unknown>,
  ) => {
    traceMesaSync(label, {
      durationMs: Math.max(0, Date.now() - startMs),
      ...(extra || {}),
    });
  }, []);

  const extractOrderUnitsSnapshot = useCallback((mesasRows: MesaRecord[]) => {
    const unitsByOrderId: Record<string, number> = {};
    const missingOrderIdsSet = new Set<string>();
    (Array.isArray(mesasRows) ? mesasRows : []).forEach((mesa) => {
      const orderId = String(mesa?.current_order_id || '').trim();
      if (!orderId) return;
      const rawUnits = Number((mesa as any)?.order_units);
      if (Number.isFinite(rawUnits)) {
        unitsByOrderId[orderId] = Math.max(0, Math.floor(rawUnits));
      } else {
        missingOrderIdsSet.add(orderId);
      }
    });
    return { unitsByOrderId, missingOrderIds: Array.from(missingOrderIdsSet) };
  }, []);

  const applyOrderUnitsSnapshot = useCallback((mesasRows: MesaRecord[]) => {
    const { unitsByOrderId, missingOrderIds } = extractOrderUnitsSnapshot(mesasRows);
    const activeOrderIds = new Set(
      (Array.isArray(mesasRows) ? mesasRows : [])
        .map((mesa) => String(mesa?.current_order_id || '').trim())
        .filter(Boolean),
    );

    setOrderUnitsByOrderId((prev) => {
      const next: Record<string, number> = {};
      activeOrderIds.forEach((orderId) => {
        if (Object.prototype.hasOwnProperty.call(unitsByOrderId, orderId)) {
          next[orderId] = unitsByOrderId[orderId];
          return;
        }

        const prevValue = prev[orderId];
        if (Number.isFinite(Number(prevValue))) {
          next[orderId] = Math.max(0, Math.floor(Number(prevValue)));
        }
      });
      return next;
    });

    if (missingOrderIds.length > 0) {
      void listOrderItemUnitsByOrderIds(missingOrderIds)
        .then((resolvedUnits) => {
          setOrderUnitsByOrderId((prev) => ({ ...prev, ...resolvedUnits }));
        })
        .catch(() => {
          // no-op
        });
    }
  }, [extractOrderUnitsSnapshot]);

  const ensureCatalogLoaded = useCallback(async (
    businessId: string,
    options?: { forceRefresh?: boolean },
  ) => {
    const normalizedBusinessId = String(businessId || '').trim();
    if (!normalizedBusinessId) return [] as MesaOrderCatalogItem[];
    const forceRefresh = options?.forceRefresh === true;
    const localCatalog = catalogItemsRef.current;

    const catalogAgeMs = Date.now() - Number(catalogUpdatedAtRef.current || 0);
    const hasLocalCatalogForBusiness = (
      !forceRefresh
      && catalogBusinessIdRef.current === normalizedBusinessId
      && localCatalog.length > 0
    );

    if (hasLocalCatalogForBusiness && catalogAgeMs <= CATALOG_LOCAL_TTL_MS) {
      return localCatalog;
    }

    if (hasLocalCatalogForBusiness && catalogAgeMs > CATALOG_LOCAL_TTL_MS) {
      // Stale-while-revalidate: mantener catalogo visible mientras refrescamos.
      if (!catalogLoadPromiseRef.current) {
        setIsCatalogLoading(true);
        const refreshPromise = listCatalogItems(normalizedBusinessId, { forceRefresh: true })
          .then((items) => {
            catalogBusinessIdRef.current = normalizedBusinessId;
            catalogUpdatedAtRef.current = Date.now();
            setCatalogItems(items);
            void writeCatalogToStorage(normalizedBusinessId, items);
            return items;
          })
          .finally(() => {
            catalogLoadPromiseRef.current = null;
            setIsCatalogLoading(false);
          });
        catalogLoadPromiseRef.current = refreshPromise;
      }
      return localCatalog;
    }

    if (catalogLoadPromiseRef.current) {
      return catalogLoadPromiseRef.current;
    }

    setIsCatalogLoading(true);
    const promise = listCatalogItems(
      normalizedBusinessId,
      forceRefresh ? { forceRefresh: true } : undefined,
    )
      .then((items) => {
        catalogBusinessIdRef.current = normalizedBusinessId;
        catalogUpdatedAtRef.current = Date.now();
        setCatalogItems(items);
        void writeCatalogToStorage(normalizedBusinessId, items);
        return items;
      })
      .finally(() => {
        catalogLoadPromiseRef.current = null;
        setIsCatalogLoading(false);
      });

    catalogLoadPromiseRef.current = promise;
    return promise;
  }, []);

  const applyMesaLocks = useCallback((locks: MesaEditLock[]) => {
    const next: Record<string, MesaEditLock> = {};
    (Array.isArray(locks) ? locks : []).forEach((lock) => {
      const tableId = String(lock?.table_id || '').trim();
      if (!tableId) return;
      next[tableId] = lock;
    });
    setMesaLocksByTableId((prev) => {
      if (!prev || Object.keys(prev).length === 0) return next;
      const nowMs = Date.now();
      Object.entries(prev).forEach(([tableId, lock]) => {
        if (next[tableId]) return;
        const token = String(lock?.lock_token || '').trim();
        const expiresAtMs = Date.parse(String(lock?.lock_expires_at || '').trim());
        if (!Number.isFinite(expiresAtMs) || expiresAtMs <= nowMs) return;
        const isPending = token.startsWith('pending-') || token.startsWith('broadcast-');
        const updatedAtMs = Date.parse(String(lock?.updated_at || '').trim());
        const isFresh = Number.isFinite(updatedAtMs) && (nowMs - updatedAtMs) <= 4000;
        if (isPending || isFresh) {
          next[tableId] = lock;
        }
      });
      return next;
    });
  }, []);


  const clearMesaLockPlaceholderTimer = useCallback((mesaId: string) => {
    const timers = mesaLockPlaceholderTimersRef.current;
    const existing = timers[mesaId];
    if (existing) {
      clearTimeout(existing);
      delete timers[mesaId];
    }
  }, []);

  const applyMesaLockPlaceholder = useCallback((mesaId: string, businessId: string) => {
    if (!mesaId || !businessId) return;
    const token = `pending-${mesaId}-${Date.now()}`;
    const expiresAt = new Date(Date.now() + 3500).toISOString();
    const updatedAt = new Date().toISOString();

    setMesaLocksByTableId((prev) => {
      if (prev[mesaId]) return prev;
      return {
        ...prev,
        [mesaId]: {
          table_id: mesaId,
          business_id: businessId,
          lock_owner_user_id: '',
          lock_owner_name: 'Alguien',
          lock_token: token,
          lock_expires_at: expiresAt,
          updated_at: updatedAt,
        },
      };
    });

    clearMesaLockPlaceholderTimer(mesaId);
    mesaLockPlaceholderTimersRef.current[mesaId] = setTimeout(() => {
      setMesaLocksByTableId((prev) => {
        const current = prev[mesaId];
        if (!current) return prev;
        if (String(current.lock_token || '') !== token) return prev;
        const next = { ...prev };
        delete next[mesaId];
        return next;
      });
      clearMesaLockPlaceholderTimer(mesaId);
    }, 3800);
  }, [clearMesaLockPlaceholderTimer]);

  const refreshMesaLocks = useCallback(async (businessId: string) => {
    const normalizedBusinessId = String(businessId || '').trim();
    if (!normalizedBusinessId) {
      setMesaLocksByTableId({});
      return;
    }
    try {
      const locks = await listActiveMesaEditLocks(normalizedBusinessId);
      applyMesaLocks(locks);
    } catch {
      // no-op: no bloquear flujo principal por locks
    }
  }, [applyMesaLocks]);

  const applyRealtimeMesaLockHint = useCallback((payload: any) => {
    const mesaId = String(payload?.mesa_id || '').trim();
    if (!mesaId) return;

    const status = String(payload?.status || '').trim().toLowerCase();
    if (status === 'available') {
      setMesaLocksByTableId((prev) => {
        if (!prev[mesaId]) return prev;
        const next = { ...prev };
        delete next[mesaId];
        return next;
      });
      return;
    }

    const ownerUserId = String(payload?.editing_user_id || payload?.sender_user_id || '').trim();
    if (!ownerUserId) return;

    const ownerName = String(
      payload?.editing_user_name
      || payload?.sender_user_name
      || 'Usuario',
    ).trim() || 'Usuario';
    const businessId = String(payload?.business_id || '').trim();
    const lockToken = String(payload?.editing_lock_token || '').trim() || null;
    const expiresAtRaw = String(payload?.editing_lock_expires_at || '').trim();
    const lockTtlMs = Math.max(15_000, Number(payload?.editing_lock_ttl_ms || 45_000));
    const lockExpiresAt = expiresAtRaw || new Date(Date.now() + lockTtlMs).toISOString();
    const updatedAt = new Date().toISOString();

    setMesaLocksByTableId((prev) => ({
      ...prev,
      [mesaId]: {
        table_id: mesaId,
        business_id: businessId || String(prev[mesaId]?.business_id || '').trim(),
        lock_owner_user_id: ownerUserId,
        lock_owner_name: ownerName,
        lock_token: lockToken,
        lock_expires_at: lockExpiresAt,
        updated_at: updatedAt,
      },
    }));
  }, []);

  const applyRealtimeMesaLockEvent = useCallback((payload: any) => {
    const eventType = String(payload?.eventType || '').trim().toUpperCase();
    const nextRow = payload?.new && typeof payload.new === 'object' ? payload.new : null;
    const prevRow = payload?.old && typeof payload.old === 'object' ? payload.old : null;
    const tableId = String(nextRow?.table_id || prevRow?.table_id || '').trim();
    if (!tableId) return;

    if (eventType === 'DELETE') {
      setMesaLocksByTableId((prev) => {
        if (!prev[tableId]) return prev;
        const next = { ...prev };
        delete next[tableId];
        return next;
      });
      return;
    }

    const lockOwnerUserId = String(nextRow?.lock_owner_user_id || '').trim();
    if (!lockOwnerUserId) {
      setMesaLocksByTableId((prev) => {
        if (!prev[tableId]) return prev;
        const next = { ...prev };
        delete next[tableId];
        return next;
      });
      return;
    }

    const rawExpiresAt = String(nextRow?.lock_expires_at || '').trim();
    if (rawExpiresAt) {
      const expiresAtMs = Date.parse(rawExpiresAt);
      if (Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now()) {
        setMesaLocksByTableId((prev) => {
          if (!prev[tableId]) return prev;
          const next = { ...prev };
          delete next[tableId];
          return next;
        });
        return;
      }
    }

    const lock: MesaEditLock = {
      table_id: tableId,
      business_id: String(nextRow?.business_id || prevRow?.business_id || '').trim(),
      lock_owner_user_id: lockOwnerUserId,
      lock_owner_name: String(nextRow?.lock_owner_name || 'Usuario').trim() || 'Usuario',
      lock_token: String(nextRow?.lock_token || '').trim() || null,
      lock_expires_at: rawExpiresAt || null,
      updated_at: String(nextRow?.updated_at || '').trim() || new Date().toISOString(),
    };

    setMesaLocksByTableId((prev) => ({
      ...prev,
      [tableId]: lock,
    }));
  }, []);

  const applyRealtimeMesaLockBroadcast = useCallback((payload: any) => {
    const senderClientId = String(payload?.sender_client_id || '').trim();
    if (senderClientId && senderClientId === String(realtimeClientInstanceIdRef.current || '').trim()) return;

    const activeBusinessId = String(context?.businessId || '').trim();
    const payloadBusinessId = String(payload?.business_id || '').trim();
    if (activeBusinessId && (!payloadBusinessId || payloadBusinessId !== activeBusinessId)) {
      return;
    }

    const mesaId = String(payload?.mesa_id || '').trim();
    if (!mesaId) return;

    const locked = (
      payload?.locked === true
      || String(payload?.locked || '').trim().toLowerCase() === 'true'
    );

    if (!locked) {
      setMesaLocksByTableId((prev) => {
        if (!prev[mesaId]) return prev;
        const next = { ...prev };
        delete next[mesaId];
        return next;
      });
      return;
    }

    const ownerUserId = String(payload?.lock_owner_user_id || payload?.sender_user_id || '').trim();
    if (!ownerUserId) return;

    const resolvedBusinessId = activeBusinessId || String(payload?.business_id || '').trim();
    const lockToken = String(payload?.lock_token || '').trim() || null;
    const rawExpiresAt = String(payload?.lock_expires_at || '').trim();
    const lockTtlMs = Math.min(120_000, Math.max(15_000, Number(payload?.lock_ttl_ms || 45_000)));
    const nowMs = Date.now();
    const parsedExpiresAt = rawExpiresAt ? Date.parse(rawExpiresAt) : Number.NaN;
    const safeExpiresAtMs = Number.isFinite(parsedExpiresAt)
      ? Math.min(parsedExpiresAt, nowMs + lockTtlMs)
      : nowMs + lockTtlMs;
    const lockExpiresAt = new Date(safeExpiresAtMs).toISOString();

    setMesaLocksByTableId((prev) => ({
      ...prev,
      [mesaId]: {
        table_id: mesaId,
        business_id: resolvedBusinessId || String(prev[mesaId]?.business_id || '').trim(),
        lock_owner_user_id: ownerUserId,
        lock_owner_name: 'Alguien',
        lock_token: lockToken,
        lock_expires_at: lockExpiresAt,
        updated_at: new Date().toISOString(),
      },
    }));
  }, [context?.businessId]);

  const sendMesaSyncBroadcast = useCallback((event: string, payload: Record<string, any>) => {
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
  }, []);

  const publishMesaLockBroadcast = useCallback((
    input: {
      businessId: string;
      tableId: string;
      locked: boolean;
      mode?: 'optimistic' | 'confirmed' | 'rollback';
      lockToken?: string | null;
      lockExpiresAt?: string | null;
    },
  ) => {
    const businessId = String(input.businessId || '').trim();
    const tableId = String(input.tableId || '').trim();
    if (!businessId || !tableId) return;

    const locked = Boolean(input.locked);
    const lockTtlMs = 45_000;
    const lockExpiresAt = locked
      ? (String(input.lockExpiresAt || '').trim() || new Date(Date.now() + lockTtlMs).toISOString())
      : null;

    sendMesaSyncBroadcast('mesa_lock_changed', {
      sender_user_id: session.user.id,
      sender_client_id: realtimeClientInstanceIdRef.current,
      mesa_id: tableId,
      business_id: businessId,
      locked,
      mode: input.mode || 'confirmed',
      lock_owner_user_id: locked ? session.user.id : null,
      lock_token: locked ? (String(input.lockToken || '').trim() || null) : null,
      lock_expires_at: lockExpiresAt,
      lock_ttl_ms: locked ? lockTtlMs : null,
      emitted_at: Date.now(),
    });
  }, [sendMesaSyncBroadcast, session.user.id]);

  const releaseHeldMesaLock = useCallback(async (lockSnapshot?: HeldMesaLock | null) => {
    const snapshot = lockSnapshot || heldMesaLockRef.current;
    if (!snapshot) return;
    if (!lockSnapshot) {
      heldMesaLockRef.current = null;
    } else {
      const current = heldMesaLockRef.current;
      if (
        current
        && current.businessId === snapshot.businessId
        && current.tableId === snapshot.tableId
        && current.lockToken === snapshot.lockToken
      ) {
        heldMesaLockRef.current = null;
      }
    }

    publishMesaLockBroadcast({
      businessId: snapshot.businessId,
      tableId: snapshot.tableId,
      locked: false,
      mode: 'optimistic',
    });

    let releaseFailed = false;
    try {
      await releaseMesaEditLock({
        businessId: snapshot.businessId,
        tableId: snapshot.tableId,
        userId: session.user.id,
        lockToken: snapshot.lockToken,
      });
    } catch {
      releaseFailed = true;
    } finally {
      setMesaLocksByTableId((prev) => {
        const current = prev[snapshot.tableId];
        if (!current) return prev;
        if (String(current.lock_owner_user_id || '') !== String(session.user.id || '')) return prev;
        const next = { ...prev };
        delete next[snapshot.tableId];
        return next;
      });
      publishMesaLockBroadcast({
        businessId: snapshot.businessId,
        tableId: snapshot.tableId,
        locked: releaseFailed,
        mode: releaseFailed ? 'rollback' : 'confirmed',
        lockToken: snapshot.lockToken,
      });
      void refreshMesaLocks(snapshot.businessId);
    }
  }, [publishMesaLockBroadcast, refreshMesaLocks, session.user.id]);

  const acquireMesaLockForEdition = useCallback(async (mesa: MesaRecord): Promise<boolean> => {
    if (!context?.businessId) return true;
    const tableId = String(mesa?.id || '').trim();
    if (!tableId) return false;

    const held = heldMesaLockRef.current;
    if (held && (held.tableId !== tableId || held.businessId !== context.businessId)) {
      await releaseHeldMesaLock(held);
    }

    publishMesaLockBroadcast({
      businessId: context.businessId,
      tableId,
      locked: true,
      mode: 'optimistic',
    });

    const result = await acquireMesaEditLock({
      businessId: context.businessId,
      tableId,
      userId: session.user.id,
      userName: actorDisplayName,
      ttlSeconds: 45,
    });

    if (result.unsupported) {
      publishMesaLockBroadcast({
        businessId: context.businessId,
        tableId,
        locked: false,
        mode: 'rollback',
      });
      return true;
    }

    if (!result.ok) {
      publishMesaLockBroadcast({
        businessId: context.businessId,
        tableId,
        locked: false,
        mode: 'rollback',
      });
      setError(MESA_IN_USE_MESSAGE);
      if (result.lock) {
        setMesaLocksByTableId((prev) => ({
          ...prev,
          [tableId]: result.lock as MesaEditLock,
        }));
      }
      void refreshMesaLocks(context.businessId);
      return false;
    }

    if (result.lock) {
      setMesaLocksByTableId((prev) => ({
        ...prev,
        [tableId]: result.lock as MesaEditLock,
      }));
    }
    heldMesaLockRef.current = {
      businessId: context.businessId,
      tableId,
      lockToken: result.lockToken || null,
    };
    publishMesaLockBroadcast({
      businessId: context.businessId,
      tableId,
      locked: true,
      mode: 'confirmed',
      lockToken: result.lockToken || null,
      lockExpiresAt: result.lock?.lock_expires_at || null,
    });
    return true;
  }, [actorDisplayName, context?.businessId, publishMesaLockBroadcast, refreshMesaLocks, releaseHeldMesaLock, session.user.id]);

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
        setOrderUnitsByOrderId({});
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
      }).then((name) => {
        setActorDisplayName(name);
      }).catch(() => {
        setActorDisplayName(fallbackName);
      });
      if (catalogBusinessIdRef.current !== nextContext.businessId) {
        catalogBusinessIdRef.current = null;
        catalogUpdatedAtRef.current = 0;
        setCatalogItems([]);
        orderItemsCacheRef.current.clear();
      }
      void readCatalogFromStorage(nextContext.businessId).then((cached) => {
        if (!cached) return;
        if (
          catalogBusinessIdRef.current === nextContext.businessId
          && catalogItemsRef.current.length > 0
        ) {
          return;
        }
        catalogBusinessIdRef.current = nextContext.businessId;
        catalogUpdatedAtRef.current = cached.cachedAt || 0;
        setCatalogItems(cached.items);
      }).catch(() => {
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

      applyOrderUnitsSnapshot(sortedMesas);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las mesas.');
    } finally {
      hasLoadedOnceRef.current = true;
      if (shouldShowLoading) {
        setLoading(false);
      }
    }
  }, [
    applyOrderUnitsSnapshot,
    businessContext,
    ensureCatalogLoaded,
    refreshMesaLocks,
    session.user.id,
    sessionDisplayName,
    traceAsyncDuration,
  ]);

  const refreshMesasRealtime = useCallback(async () => {
    const businessId = String(context?.businessId || '').trim();
    if (!businessId) return;

    try {
      const refreshStart = Date.now();
      const incoming = (await fetchMesasByBusinessId(businessId)).sort(compareMesaTableIdentifiers);
      traceAsyncDuration('refresh_fetch_mesas', refreshStart, {
        businessId,
        rows: incoming.length,
      });
      const selectedMesaId = isOrderFlowActive ? String(selectedMesa?.id || '').trim() : '';

      setMesas((prev) => {
        const previousById = new Map(prev.map((mesa) => [String(mesa.id || ''), mesa]));
        return incoming.map((mesa) => {
          const mesaId = String(mesa.id || '').trim();
          const previousMesa = previousById.get(mesaId);
          if (selectedMesaId && String(mesa.id || '') === selectedMesaId) {
            return previousById.get(selectedMesaId) || mesa;
          }
          if (previousMesa) {
            const previousSyncVersion = resolveMesaSyncVersion(previousMesa);
            const incomingSyncVersion = resolveMesaSyncVersion(mesa);
            if (previousSyncVersion > incomingSyncVersion) {
              traceMesaSync('refresh_drop_stale_row', {
                mesaId,
                previousSyncVersion,
                incomingSyncVersion,
              });
              return previousMesa;
            }
          }
          return mesa;
        });
      });

      applyOrderUnitsSnapshot(incoming);
    } catch {
      // no-op
    }
  }, [
    applyOrderUnitsSnapshot,
    context?.businessId,
    isOrderFlowActive,
    selectedMesa?.id,
    traceAsyncDuration,
  ]);

  const scheduleMesasRealtimeRefresh = useCallback(() => {
    if (mesasRealtimeRefreshTimerRef.current) return;
    mesasRealtimeRefreshTimerRef.current = setTimeout(() => {
      mesasRealtimeRefreshTimerRef.current = null;
      void refreshMesasRealtime();
    }, 80);
  }, [refreshMesasRealtime]);

  const scheduleMesaLocksRefresh = useCallback((businessId: string) => {
    const normalizedBusinessId = String(businessId || '').trim();
    if (!normalizedBusinessId) return;
    if (mesaLocksRealtimeRefreshTimerRef.current) return;
    mesaLocksRealtimeRefreshTimerRef.current = setTimeout(() => {
      mesaLocksRealtimeRefreshTimerRef.current = null;
      void refreshMesaLocks(normalizedBusinessId);
    }, 140);
  }, [refreshMesaLocks]);

  const hydrateOrderRealtimeSummary = useCallback(async (orderId: string) => {
    const normalizedOrderId = normalizeOrderReference(orderId);
    if (!normalizedOrderId) return;

    try {
      const hydrateStart = Date.now();
      const snapshot = await loadOpenOrderSnapshot(normalizedOrderId, { forceRefresh: true });
      traceAsyncDuration('hydrate_order_summary', hydrateStart, {
        orderId: normalizedOrderId,
      });
      const total = Math.max(0, Number(snapshot?.total || 0));
      const units = Math.max(0, Math.floor(Number(snapshot?.units || 0)));

      setOrderUnitsByOrderId((prev) => {
        if (Math.max(0, Math.floor(Number(prev?.[normalizedOrderId] || 0))) === units) return prev;
        return {
          ...prev,
          [normalizedOrderId]: units,
        };
      });

      setMesas((prev) => {
        let changed = false;
        const next = prev.map((mesa) => {
          if (normalizeOrderReference(mesa?.current_order_id) !== normalizedOrderId) return mesa;
          changed = true;
          return {
            ...mesa,
            status: 'occupied',
            order_units: units,
            orders: {
              ...(mesa.orders || {}),
              id: normalizedOrderId,
              status: String(mesa?.orders?.status || 'open'),
              total,
            },
          };
        });
        return changed ? next : prev;
      });

      setSelectedMesa((prev) => {
        if (!prev || normalizeOrderReference(prev?.current_order_id) !== normalizedOrderId) return prev;
        return {
          ...prev,
          status: 'occupied',
          order_units: units,
          orders: {
            ...(prev.orders || {}),
            id: normalizedOrderId,
            status: String(prev?.orders?.status || 'open'),
            total,
          },
        };
      });
    } catch {
      // no-op
    }
  }, [traceAsyncDuration]);

  const scheduleOrderRealtimeSummaryHydration = useCallback((orderId: string) => {
    const normalizedOrderId = normalizeOrderReference(orderId);
    if (!normalizedOrderId) return;

    const timers = orderRealtimeSummaryTimersRef.current;
    const previousTimer = timers[normalizedOrderId];
    if (previousTimer) {
      clearTimeout(previousTimer);
    }

    timers[normalizedOrderId] = setTimeout(() => {
      delete timers[normalizedOrderId];
      void hydrateOrderRealtimeSummary(normalizedOrderId);
    }, 40);
  }, [hydrateOrderRealtimeSummary]);

  const applyRealtimeTableEvent = useCallback((payload: any) => {
    const eventType = String(payload?.eventType || '').trim().toUpperCase();
    const nextRow = payload?.new && typeof payload.new === 'object' ? payload.new : null;
    const prevRow = payload?.old && typeof payload.old === 'object' ? payload.old : null;
    const mesaId = String(nextRow?.id || prevRow?.id || '').trim();
    if (!mesaId) return;

    const hasNextCurrentOrderId = Boolean(nextRow && Object.prototype.hasOwnProperty.call(nextRow, 'current_order_id'));
    const nextCurrentOrderId = hasNextCurrentOrderId
      ? (String(nextRow?.current_order_id || '').trim() || null)
      : undefined;
    const hasNextStatus = Boolean(nextRow && Object.prototype.hasOwnProperty.call(nextRow, 'status'));
    const nextStatus = hasNextStatus
      ? (String(nextRow?.status || '').trim().toLowerCase() || undefined)
      : undefined;

    const hasNextTableNumber = Boolean(nextRow && Object.prototype.hasOwnProperty.call(nextRow, 'table_number'));
    const hasNextName = Boolean(nextRow && Object.prototype.hasOwnProperty.call(nextRow, 'name'));
    const hasNextSyncVersion = Boolean(nextRow && Object.prototype.hasOwnProperty.call(nextRow, 'sync_version'));
    const nextSyncVersion = hasNextSyncVersion
      ? resolveMesaSyncVersion({ sync_version: nextRow?.sync_version } as Partial<MesaRecord>)
      : undefined;

    setMesas((prev) => {
      const index = prev.findIndex((mesa) => String(mesa?.id || '').trim() === mesaId);

      if (eventType === 'DELETE') {
        if (index === -1) return prev;
        const next = prev.filter((mesa) => String(mesa?.id || '').trim() !== mesaId);
        return next;
      }

      if (index === -1) {
        if (!nextRow) return prev;
        const insertedMesa: MesaRecord = {
          id: mesaId,
          business_id: String(nextRow?.business_id || '').trim(),
          table_number: hasNextTableNumber ? (nextRow?.table_number ?? null) : null,
          name: hasNextName ? (nextRow?.name ?? null) : null,
          status: String(nextStatus || 'available'),
          current_order_id: hasNextCurrentOrderId ? nextCurrentOrderId : null,
          sync_version: hasNextSyncVersion ? nextSyncVersion : undefined,
          orders: null,
        };
        return [...prev, insertedMesa].sort(compareMesaTableIdentifiers);
      }

      const current = prev[index];
      if (hasNextSyncVersion) {
        const currentSyncVersion = resolveMesaSyncVersion(current);
        const incomingSyncVersion = nextSyncVersion || 0;
        if (incomingSyncVersion < currentSyncVersion) {
          traceMesaSync('drop_stale_table_event', {
            mesaId,
            currentSyncVersion,
            incomingSyncVersion,
            eventType,
          });
          return prev;
        }
      }
      const resolvedCurrentOrderId = hasNextCurrentOrderId ? nextCurrentOrderId : (current.current_order_id ?? null);
      const resolvedStatus = String(nextStatus || current.status || 'available');
      const nextMesa: MesaRecord = {
        ...current,
        status: resolvedStatus,
        current_order_id: resolvedCurrentOrderId,
        table_number: hasNextTableNumber ? (nextRow?.table_number ?? null) : current.table_number,
        name: hasNextName ? (nextRow?.name ?? null) : current.name,
        sync_version: hasNextSyncVersion ? nextSyncVersion : current.sync_version,
        orders: (() => {
          if (!resolvedCurrentOrderId || resolvedStatus === 'available') return null;
          if (String(current?.orders?.id || '').trim() === String(resolvedCurrentOrderId || '').trim()) {
            return current.orders || null;
          }
          return {
            ...(current.orders || {}),
            id: resolvedCurrentOrderId,
            status: String(current?.orders?.status || 'open'),
            total: Number(current?.orders?.total || 0),
          };
        })(),
      };

      const next = [...prev];
      next[index] = nextMesa;
      return next.sort(compareMesaTableIdentifiers);
    });

    setSelectedMesa((prev) => {
      if (!prev || String(prev?.id || '').trim() !== mesaId || eventType === 'DELETE') return prev;
      if (hasNextSyncVersion) {
        const currentSyncVersion = resolveMesaSyncVersion(prev);
        const incomingSyncVersion = nextSyncVersion || 0;
        if (incomingSyncVersion < currentSyncVersion) return prev;
      }
      const resolvedCurrentOrderId = hasNextCurrentOrderId ? nextCurrentOrderId : (prev.current_order_id ?? null);
      const resolvedStatus = String(nextStatus || prev.status || 'available');
      return {
        ...prev,
        status: resolvedStatus,
        current_order_id: resolvedCurrentOrderId,
        table_number: hasNextTableNumber ? (nextRow?.table_number ?? null) : prev.table_number,
        name: hasNextName ? (nextRow?.name ?? null) : prev.name,
        sync_version: hasNextSyncVersion ? nextSyncVersion : prev.sync_version,
        orders: (!resolvedCurrentOrderId || resolvedStatus === 'available')
          ? null
          : prev.orders,
      };
    });

    const previousOrderId = String(prevRow?.current_order_id || '').trim();
    const updatedOrderId = hasNextCurrentOrderId ? String(nextCurrentOrderId || '').trim() : '';
    if (previousOrderId || updatedOrderId || eventType === 'DELETE') {
      setOrderUnitsByOrderId((prev) => {
        const next = { ...prev };
        if (previousOrderId && previousOrderId !== updatedOrderId) {
          delete next[previousOrderId];
        }
        if (eventType === 'DELETE' || (!updatedOrderId && hasNextCurrentOrderId)) {
          delete next[updatedOrderId];
        }
        return next;
      });
    }

    if (eventType !== 'DELETE' && hasNextStatus) {
      const normalizedStatus = String(nextStatus || '').trim().toLowerCase();
      const businessId = String(nextRow?.business_id || prevRow?.business_id || context?.businessId || '').trim();
      if (normalizedStatus === 'available') {
        clearMesaLockPlaceholderTimer(mesaId);
        setMesaLocksByTableId((prev) => {
          if (!prev[mesaId]) return prev;
          const next = { ...prev };
          delete next[mesaId];
          return next;
        });
      }
      if (normalizedStatus === 'occupied' && businessId) {
        const selectedMesaId = String(selectedMesaIdRef.current || '').trim();
        const held = heldMesaLockRef.current;
        const hasHeldLock = Boolean(
          held
          && held.tableId === mesaId
          && held.businessId === businessId,
        );
        if (!hasHeldLock && (!selectedMesaId || selectedMesaId !== mesaId)) {
          applyMesaLockPlaceholder(mesaId, businessId);
        }
      }
    }
    if (eventType !== 'DELETE' && (hasNextStatus || hasNextCurrentOrderId)) {
      const businessId = String(nextRow?.business_id || prevRow?.business_id || context?.businessId || '').trim();
      if (businessId) {
        scheduleMesaLocksRefresh(businessId);
      }
    }
  }, [
    applyMesaLockPlaceholder,
    clearMesaLockPlaceholderTimer,
    context?.businessId,
    scheduleMesaLocksRefresh,
  ]);

  const applyRealtimeOrderEvent = useCallback((payload: any) => {
    const nextRow = payload?.new && typeof payload.new === 'object' ? payload.new : null;
    const prevRow = payload?.old && typeof payload.old === 'object' ? payload.old : null;
    const orderId = String(nextRow?.id || prevRow?.id || '').trim();
    if (!orderId) return;

    const nextStatus = String(nextRow?.status || prevRow?.status || '').trim().toLowerCase() || undefined;
    const hasNextTotal = Boolean(nextRow && Object.prototype.hasOwnProperty.call(nextRow, 'total'));
    const nextTotal = hasNextTotal ? Number(nextRow?.total || 0) : null;
    const tableId = String(nextRow?.table_id || prevRow?.table_id || '').trim();
    const businessId = String(nextRow?.business_id || prevRow?.business_id || context?.businessId || '').trim();

    if (tableId && businessId) {
      const normalizedStatus = String(nextStatus || '').trim().toLowerCase();
      if (normalizedStatus === 'open') {
        const selectedMesaId = String(selectedMesaIdRef.current || '').trim();
        const held = heldMesaLockRef.current;
        const hasHeldLock = Boolean(
          held
          && held.tableId === tableId
          && held.businessId === businessId,
        );
        if (!hasHeldLock && (!selectedMesaId || selectedMesaId !== tableId)) {
          applyMesaLockPlaceholder(tableId, businessId);
        }
      } else if (normalizedStatus) {
        clearMesaLockPlaceholderTimer(tableId);
        setMesaLocksByTableId((prev) => {
          const current = prev[tableId];
          if (!current) return prev;
          const currentToken = String(current.lock_token || '').trim();
          if (!currentToken.startsWith('pending-')) return prev;
          const next = { ...prev };
          delete next[tableId];
          return next;
        });
      }
    }

    setMesas((prev) => prev.map((mesa) => {
      if (String(mesa?.current_order_id || '').trim() !== orderId) return mesa;
      return {
        ...mesa,
        orders: {
          ...(mesa.orders || {}),
          id: orderId,
          status: nextStatus || String(mesa?.orders?.status || 'open'),
          total: nextTotal === null ? Number(mesa?.orders?.total || 0) : Number(nextTotal || 0),
        },
      };
    }));
  }, [
    applyMesaLockPlaceholder,
    clearMesaLockPlaceholderTimer,
    context?.businessId,
  ]);

  const applyRealtimeOrderItemDelta = useCallback((payload: any) => {
    const eventType = String(payload?.eventType || '').trim().toUpperCase();
    const nextRow = payload?.new && typeof payload.new === 'object' ? payload.new : null;
    const prevRow = payload?.old && typeof payload.old === 'object' ? payload.old : null;

    const deltasByOrderId = new Map<string, { deltaUnits: number; deltaTotal: number }>();
    const pushDelta = (orderId: unknown, deltaUnits: number, deltaTotal: number) => {
      const normalizedOrderId = normalizeOrderReference(orderId);
      if (!normalizedOrderId) return;
      const previous = deltasByOrderId.get(normalizedOrderId) || { deltaUnits: 0, deltaTotal: 0 };
      deltasByOrderId.set(normalizedOrderId, {
        deltaUnits: previous.deltaUnits + deltaUnits,
        deltaTotal: previous.deltaTotal + deltaTotal,
      });
    };

    const nextOrderId = normalizeOrderReference(nextRow?.order_id);
    const previousOrderId = normalizeOrderReference(prevRow?.order_id);

    if (eventType === 'INSERT') {
      pushDelta(
        nextOrderId,
        normalizeOrderItemQuantity(nextRow?.quantity),
        normalizeOrderItemSubtotal(nextRow),
      );
    } else if (eventType === 'DELETE') {
      pushDelta(
        previousOrderId,
        -normalizeOrderItemQuantity(prevRow?.quantity),
        -normalizeOrderItemSubtotal(prevRow),
      );
    } else {
      const nextQuantity = normalizeOrderItemQuantity(nextRow?.quantity);
      const previousQuantity = normalizeOrderItemQuantity(prevRow?.quantity);
      const nextSubtotal = normalizeOrderItemSubtotal(nextRow);
      const previousSubtotal = normalizeOrderItemSubtotal(prevRow);

      if (nextOrderId && previousOrderId && nextOrderId !== previousOrderId) {
        pushDelta(previousOrderId, -previousQuantity, -previousSubtotal);
        pushDelta(nextOrderId, nextQuantity, nextSubtotal);
      } else {
        pushDelta(
          nextOrderId || previousOrderId,
          nextQuantity - previousQuantity,
          nextSubtotal - previousSubtotal,
        );
      }
    }

    if (deltasByOrderId.size === 0) return;

    setOrderUnitsByOrderId((prev) => {
      let changed = false;
      const next = { ...prev };

      deltasByOrderId.forEach((delta, orderId) => {
        const currentUnits = Math.max(0, Math.floor(Number(next[orderId] || 0)));
        const resolvedUnits = Math.max(0, currentUnits + Math.trunc(delta.deltaUnits));
        if (resolvedUnits === currentUnits) return;
        changed = true;
        if (resolvedUnits === 0) {
          delete next[orderId];
        } else {
          next[orderId] = resolvedUnits;
        }
      });

      return changed ? next : prev;
    });

    const normalizeTotal = (value: number) => Math.max(0, Math.round(value * 100) / 100);

    setMesas((prev) => {
      let changed = false;
      const next = prev.map((mesa) => {
        const orderId = normalizeOrderReference(mesa?.current_order_id);
        if (!orderId) return mesa;
        const delta = deltasByOrderId.get(orderId);
        if (!delta) return mesa;

        const currentTotal = Number(mesa?.orders?.total || 0);
        const safeCurrentTotal = Number.isFinite(currentTotal) ? currentTotal : 0;
        const nextTotal = normalizeTotal(safeCurrentTotal + delta.deltaTotal);

        const currentUnitsRaw = Number((mesa as any)?.order_units);
        const safeCurrentUnits = Number.isFinite(currentUnitsRaw)
          ? Math.max(0, Math.floor(currentUnitsRaw))
          : 0;
        const nextUnits = Math.max(0, safeCurrentUnits + Math.trunc(delta.deltaUnits));

        if (nextTotal === safeCurrentTotal && nextUnits === safeCurrentUnits) return mesa;
        changed = true;
        return {
          ...mesa,
          status: 'occupied',
          order_units: nextUnits,
          orders: {
            ...(mesa.orders || {}),
            id: orderId,
            status: String(mesa?.orders?.status || 'open'),
            total: nextTotal,
          },
        };
      });
      return changed ? next : prev;
    });

    setSelectedMesa((prev) => {
      if (!prev) return prev;
      const selectedOrderId = normalizeOrderReference(prev?.current_order_id);
      if (!selectedOrderId) return prev;
      const delta = deltasByOrderId.get(selectedOrderId);
      if (!delta) return prev;

      const currentTotal = Number(prev?.orders?.total || 0);
      const safeCurrentTotal = Number.isFinite(currentTotal) ? currentTotal : 0;
      const nextTotal = normalizeTotal(safeCurrentTotal + delta.deltaTotal);

      const currentUnitsRaw = Number((prev as any)?.order_units);
      const safeCurrentUnits = Number.isFinite(currentUnitsRaw)
        ? Math.max(0, Math.floor(currentUnitsRaw))
        : 0;
      const nextUnits = Math.max(0, safeCurrentUnits + Math.trunc(delta.deltaUnits));

      if (nextTotal === safeCurrentTotal && nextUnits === safeCurrentUnits) return prev;

      return {
        ...prev,
        status: 'occupied',
        order_units: nextUnits,
        orders: {
          ...(prev.orders || {}),
          id: selectedOrderId,
          status: String(prev?.orders?.status || 'open'),
          total: nextTotal,
        },
      };
    });
  }, []);

  const applyRealtimeMesaBroadcast = useCallback((payload: any) => {
    const senderClientId = String(payload?.sender_client_id || '').trim();
    if (senderClientId && senderClientId === String(realtimeClientInstanceIdRef.current || '').trim()) return;

    const mesaId = String(payload?.mesa_id || '').trim();
    if (!mesaId) return;

    const activeBusinessId = String(context?.businessId || '').trim();
    const payloadBusinessId = String(payload?.business_id || '').trim();
    if (activeBusinessId && (!payloadBusinessId || payloadBusinessId !== activeBusinessId)) {
      return;
    }

    applyRealtimeMesaLockHint(payload);

    applyRealtimeTableEvent({
      eventType: 'UPDATE',
      old: {
        current_order_id: payload?.previous_order_id ?? null,
      },
      new: {
        id: mesaId,
        business_id: payload?.business_id ?? null,
        status: payload?.status ?? null,
        current_order_id: payload?.current_order_id ?? null,
        table_number: payload?.table_number ?? null,
        name: payload?.name ?? null,
        sync_version: payload?.sync_version ?? null,
      },
    });

    if (payload?.current_order_id) {
      const orderId = String(payload.current_order_id || '').trim();
      const orderUnits = Number(payload?.order_units);
      if (orderId && Number.isFinite(orderUnits)) {
        setOrderUnitsByOrderId((prev) => ({
          ...prev,
          [orderId]: Math.max(0, Math.floor(orderUnits)),
        }));
      }
      applyRealtimeOrderEvent({
        eventType: 'UPDATE',
        new: {
          id: payload.current_order_id,
          status: payload?.order_status ?? 'open',
          total: payload?.order_total ?? 0,
        },
      });
    }
  }, [applyRealtimeMesaLockHint, applyRealtimeOrderEvent, applyRealtimeTableEvent, context?.businessId]);

  const publishMesaStateBroadcast = useCallback((
    mesa: MesaRecord,
    options?: {
      previousOrderId?: string | null;
      mode?: 'optimistic' | 'confirmed' | 'rollback';
      orderUnits?: number | null;
    },
  ) => {
    if (!mesa?.id) return;
    const normalizedMesaStatus = String(mesa?.status || '').trim().toLowerCase();
    const isMesaOccupiedNow = normalizedMesaStatus === 'occupied';
    const held = heldMesaLockRef.current;
    const hasHeldLockForMesa = Boolean(
      held
      && held.businessId === String(mesa.business_id || '').trim()
      && held.tableId === String(mesa.id || '').trim(),
    );
    const lockTokenHint = hasHeldLockForMesa ? held?.lockToken || null : null;
    const lockTtlMs = 45_000;
    const lockExpiresAt = isMesaOccupiedNow ? new Date(Date.now() + lockTtlMs).toISOString() : null;

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
      name: mesa.name ?? null,
      order_status: mesa.orders?.status ?? null,
      order_total: Number(mesa.orders?.total || 0),
      order_units: Number.isFinite(Number(options?.orderUnits))
        ? Math.max(0, Math.floor(Number(options?.orderUnits || 0)))
        : null,
      sync_version: Number.isFinite(Number((mesa as any)?.sync_version))
        ? Math.max(0, Math.floor(Number((mesa as any)?.sync_version)))
        : null,
      emitted_at: Date.now(),
    });
  }, [actorDisplayName, sendMesaSyncBroadcast, session.user.id]);

  useEffect(() => {
    loadData();
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
  }, [mesas]);


  useEffect(() => {
    const businessId = String(context?.businessId || '').trim();
    if (!businessId) {
      setMesaLocksByTableId({});
      return undefined;
    }

    let cancelled = false;
    let fallbackTimer: ReturnType<typeof setInterval> | null = null;

    let client;
    try {
      client = getSupabaseClient();
    } catch {
      return undefined;
    }

    const scheduleRefresh = () => {
      if (cancelled) return;
      scheduleMesasRealtimeRefresh();
    };

    const scheduleLocks = () => {
      if (cancelled) return;
      scheduleMesaLocksRefresh(businessId);
    };

    const channel = client
      .channel(`mobile-mesas:${businessId}:${session.user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tables',
        filter: `business_id=eq.${businessId}`,
      }, (payload) => {
        if (cancelled) return;
        markRealtimeIngress('tables', payload);
        applyRealtimeTableEvent(payload);
        scheduleRefresh();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders',
        filter: `business_id=eq.${businessId}`,
      }, (payload) => {
        if (cancelled) return;
        markRealtimeIngress('orders', payload);
        applyRealtimeOrderEvent(payload);
        scheduleRefresh();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'order_items',
      }, (payload) => {
        if (cancelled) return;
        markRealtimeIngress('order_items', payload);
        const orderPayload = payload as any;
        const nextOrderId = normalizeOrderReference(orderPayload?.new?.order_id);
        const previousOrderId = normalizeOrderReference(orderPayload?.old?.order_id);

        applyRealtimeOrderItemDelta(orderPayload);

        if (nextOrderId) {
          scheduleOrderRealtimeSummaryHydration(nextOrderId);
        }
        if (previousOrderId && previousOrderId !== nextOrderId) {
          scheduleOrderRealtimeSummaryHydration(previousOrderId);
        }

        if (!nextOrderId && !previousOrderId) {
          scheduleRefresh();
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'table_edit_locks',
        filter: `business_id=eq.${businessId}`,
      }, (payload) => {
        if (cancelled) return;
        markRealtimeIngress('mesa_lock', payload);
        applyRealtimeMesaLockEvent(payload);
        scheduleLocks();
      });

    const syncChannel = client
      .channel(`private:mobile-mesas-sync:${businessId}`)
      .on('broadcast', { event: 'mesa_lock_changed' }, ({ payload }) => {
        if (cancelled) return;
        traceMesaSync('realtime_in', {
          source: 'mesa_lock_broadcast',
          rowRef: String(payload?.mesa_id || '').trim() || 'unknown',
          syncMode: String(payload?.mode || '').trim() || null,
        });
        applyRealtimeMesaLockBroadcast(payload);
      })
      .on('broadcast', { event: 'mesa_state_changed' }, ({ payload }) => {
        if (cancelled) return;
        traceMesaSync('realtime_in', {
          source: 'mesa_broadcast',
          rowRef: String(payload?.mesa_id || '').trim() || 'unknown',
          syncMode: String(payload?.sync_mode || '').trim() || null,
          emittedLagMs: Number.isFinite(Number(payload?.emitted_at))
            ? Math.max(0, Date.now() - Number(payload.emitted_at))
            : null,
        });
        applyRealtimeMesaBroadcast(payload);
        const mode = String(payload?.sync_mode || 'confirmed').trim().toLowerCase();
        if (mode !== 'optimistic') {
          scheduleRefresh();
        }
      });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        scheduleRefresh();
        scheduleLocks();
      }
    });
    mesasSyncBroadcastReadyRef.current = false;
    syncChannel.subscribe((status) => {
      mesasSyncBroadcastReadyRef.current = status === 'SUBSCRIBED';
    });
    mesasSyncBroadcastChannelRef.current = syncChannel;

    fallbackTimer = setInterval(() => {
      scheduleRefresh();
      scheduleLocks();
    }, 15000);

    return () => {
      cancelled = true;
      if (fallbackTimer) clearInterval(fallbackTimer);
      if (mesasRealtimeRefreshTimerRef.current) {
        clearTimeout(mesasRealtimeRefreshTimerRef.current);
        mesasRealtimeRefreshTimerRef.current = null;
      }
      if (mesaLocksRealtimeRefreshTimerRef.current) {
        clearTimeout(mesaLocksRealtimeRefreshTimerRef.current);
        mesaLocksRealtimeRefreshTimerRef.current = null;
      }
      void client.removeChannel(channel);
      if (mesasSyncBroadcastChannelRef.current) {
        void client.removeChannel(mesasSyncBroadcastChannelRef.current);
        mesasSyncBroadcastChannelRef.current = null;
      }
      mesasSyncBroadcastReadyRef.current = false;
      Object.values(orderRealtimeSummaryTimersRef.current).forEach((timer) => {
        clearTimeout(timer);
      });
      orderRealtimeSummaryTimersRef.current = {};
    };
  }, [
    applyRealtimeMesaLockBroadcast,
    applyRealtimeMesaBroadcast,
    applyRealtimeMesaLockEvent,
    applyRealtimeOrderItemDelta,
    applyRealtimeOrderEvent,
    applyRealtimeTableEvent,
    context?.businessId,
    markRealtimeIngress,
    scheduleOrderRealtimeSummaryHydration,
    scheduleMesaLocksRefresh,
    scheduleMesasRealtimeRefresh,
    session.user.id,
  ]);

  useEffect(() => {
    const held = heldMesaLockRef.current;
    const activeBusinessId = String(context?.businessId || '').trim();
    if (!held) return;
    if (!activeBusinessId || held.businessId !== activeBusinessId) {
      void releaseHeldMesaLock(held);
    }
  }, [context?.businessId, releaseHeldMesaLock]);

  useEffect(() => {
    latestOrderItemsRef.current = orderItems;
  }, [orderItems]);

  useEffect(() => {
    catalogItemsRef.current = catalogItems;
  }, [catalogItems]);

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
  }, [orderItems, selectedMesa?.current_order_id]);

  useEffect(() => () => {
    if (quantitySyncTimerRef.current) {
      clearTimeout(quantitySyncTimerRef.current);
      quantitySyncTimerRef.current = null;
    }
    pendingQuantityUpdatesRef.current.clear();
    Object.values(mesaLockPlaceholderTimersRef.current).forEach((timer) => {
      clearTimeout(timer);
    });
    mesaLockPlaceholderTimersRef.current = {};
    void releaseHeldMesaLock();
  }, [releaseHeldMesaLock]);

  useEffect(() => {
    if (!isOrderFlowActive) return undefined;
    const held = heldMesaLockRef.current;
    if (!held) return undefined;

    let cancelled = false;
    const timer = setInterval(() => {
      const current = heldMesaLockRef.current;
      if (!current || current.tableId !== held.tableId || current.businessId !== held.businessId) return;

      void refreshMesaEditLockHeartbeat({
        businessId: current.businessId,
        tableId: current.tableId,
        userId: session.user.id,
        userName: actorDisplayName,
        lockToken: current.lockToken,
        ttlSeconds: 45,
      }).then((result) => {
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
      }).catch(() => {
        // no-op
      });
    }, 9000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [actorDisplayName, isOrderFlowActive, refreshMesaLocks, releaseHeldMesaLock, session.user.id]);

  const orderTotal = useMemo(() => calculateOrderTotal(orderItems), [orderItems]);
  const orderModalTitle = selectedMesa ? `${mesaDisplayName(selectedMesa)} - Orden` : 'Mesa - Orden';
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
  const resolveOrderItemDisplayName = useCallback((item: MesaOrderItem) => {
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
  }, [catalogNameByIdentity]);

  const filteredCatalog = useMemo(() => {
    const source = Array.isArray(catalogItems) ? catalogItems : [];
    const search = String(searchCatalog || '').trim().toLowerCase();

    if (!search) {
      return [];
    }

    return source
      .filter((item) => {
        const byName = String(item.name || '').toLowerCase().includes(search);
        return byName;
      })
      .slice(0, 80);
  }, [catalogItems, searchCatalog]);
  const hasCatalogQuery = String(searchCatalog || '').trim().length > 0;

  const catalogLookup = useMemo(() => buildCatalogLookup(catalogItems), [catalogItems]);
  const { insufficientItems, insufficientComboComponents } = useMemo(() => {
    if (loadingOrder) {
      return { insufficientItems: [], insufficientComboComponents: [] };
    }
    if (catalogItems.length === 0) {
      return { insufficientItems: [], insufficientComboComponents: [] };
    }
    return evaluateOrderStockShortagesWithLookup({ orderItems, lookup: catalogLookup });
  }, [catalogItems.length, catalogLookup, loadingOrder, orderItems]);

  const cashChangeData = useMemo(() => {
    if (paymentMethod !== 'cash') return null;
    if (String(amountReceived || '').trim() === '') return { isValid: false, reason: 'empty' as const, change: 0, paid: 0 };
    return calculateCashChange(orderTotal, amountReceived);
  }, [amountReceived, orderTotal, paymentMethod]);

  const closeAuxiliaryOrderModals = useCallback(() => {
    setShowCloseOrderChoiceModal(false);
    setShowPaymentModal(false);
    setShowSplitBillModal(false);
    setPaymentMethod('cash');
    setAmountReceived('');
  }, []);

  const closeOrderModal = useCallback(() => {
    const held = heldMesaLockRef.current;
    if (held) {
      void releaseHeldMesaLock(held);
    }
    orderModalOpenIntentRef.current = false;
    closeAuxiliaryOrderModals();
    setShowOrderModal(false);
    setSelectedMesa(null);
    setOrderItems([]);
    setOrderModalError(null);
    setSearchCatalog('');
    setIsSearchFocused(false);
    setMutatingOrderItemId(null);
  }, [closeAuxiliaryOrderModals, releaseHeldMesaLock]);

  const releaseEmptyOrderAndClose = useCallback(async () => {
    if (!selectedMesa?.id) {
      closeOrderModal();
      return;
    }

    if (!session.access_token) {
      setOrderModalError('No hay token de sesión activo para liberar la mesa.');
      return;
    }

    const mesaSnapshot = selectedMesa;
    const mesaId = selectedMesa.id;
    const closeActionVersion = bumpMesaActionVersion(mesaId);
    const orderId = String(selectedMesa.current_order_id || '').trim() || null;
    const optimisticMesa: MesaRecord = {
      ...mesaSnapshot,
      status: 'available',
      current_order_id: null,
      orders: null,
    };

    setReleasingEmptyOrder(true);
    setOrderModalError(null);
    setMesas((prev) => prev
      .map((row) => (
        row.id === mesaId
          ? {
              ...row,
              status: 'available',
              current_order_id: null,
              orders: null,
            }
          : row
      ))
      .sort(compareMesaTableIdentifiers));
    clearMesaOrderUnits(orderId);
    if (orderId) {
      orderItemsCacheRef.current.delete(orderId);
    }
    publishMesaStateBroadcast(optimisticMesa, {
      previousOrderId: orderId,
      mode: 'optimistic',
    });
    closeOrderModal();

    try {
      const updatedMesa = await openCloseMesa({
        accessToken: session.access_token,
        userId: session.user.id,
        tableId: mesaId,
        action: 'close',
      });

      if (!isMesaActionVersionCurrent(mesaId, closeActionVersion)) {
        return;
      }

      const mergedMesa: MesaRecord = {
        ...mesaSnapshot,
        ...updatedMesa,
        orders: {
          ...(mesaSnapshot.orders || {}),
          ...(updatedMesa.orders || {}),
        },
      };

      setMesas((prev) => prev
        .map((row) => (row.id === mergedMesa.id ? mergedMesa : row))
        .sort(compareMesaTableIdentifiers));
      publishMesaStateBroadcast(mergedMesa, {
        previousOrderId: orderId,
        mode: 'confirmed',
      });
    } catch (err) {
      if (!isMesaActionVersionCurrent(mesaId, closeActionVersion)) {
        return;
      }
      setMesas((prev) => prev
        .map((row) => (row.id === mesaSnapshot.id ? mesaSnapshot : row))
        .sort(compareMesaTableIdentifiers));
      publishMesaStateBroadcast(mesaSnapshot, {
        previousOrderId: orderId,
        mode: 'rollback',
      });
      setError(err instanceof Error ? err.message : 'No se pudo liberar la mesa.');
    } finally {
      setReleasingEmptyOrder(false);
    }
  }, [
    bumpMesaActionVersion,
    clearMesaOrderUnits,
    closeOrderModal,
    isMesaActionVersionCurrent,
    publishMesaStateBroadcast,
    selectedMesa,
    session.access_token,
    session.user.id,
  ]);

  const patchMesaOrderTotal = useCallback((mesaId: string, orderId: string, total: number) => {
    setMesas((prev) => prev.map((mesa) => {
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
    }));

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
  }, []);

  const publishRealtimeOrderSummary = useCallback((
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

    publishMesaStateBroadcast({
      id: normalizedMesaId,
      business_id: normalizedBusinessId,
      status: 'occupied',
      current_order_id: normalizedOrderId,
      table_number: mesa?.table_number ?? null,
      name: mesa?.name ?? null,
      orders: {
        id: normalizedOrderId,
        status: 'open',
        total: Number(total || 0),
      },
    }, {
      previousOrderId: normalizedOrderId,
      mode,
      orderUnits: Math.max(0, Math.floor(Number(units || 0))),
    });
  }, [context?.businessId, publishMesaStateBroadcast]);

  const handleDismissOrderModal = useCallback(() => {
    if (isClosingOrder || releasingEmptyOrder || isSavingOrder) return;

    if (orderItems.length === 0) {
      void releaseEmptyOrderAndClose();
      return;
    }

    if (selectedMesa?.id && selectedMesa.current_order_id) {
      patchMesaOrderTotal(selectedMesa.id, selectedMesa.current_order_id, orderTotal);
      const currentUnits = sumOrderItemsQuantity(orderItems);
      patchMesaOrderUnits(selectedMesa.current_order_id, currentUnits);
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
    orderItems.length,
    orderItems,
    orderTotal,
    patchMesaOrderTotal,
    patchMesaOrderUnits,
    publishRealtimeOrderSummary,
    releaseEmptyOrderAndClose,
    releasingEmptyOrder,
    selectedMesa,
  ]);

  const openOrderModal = useCallback(async (
    mesa: MesaRecord,
    options?: {
      skipOrderItemsFetch?: boolean;
      initialItems?: MesaOrderItem[];
      skipLockAcquire?: boolean;
    },
  ) => {
    orderModalOpenIntentRef.current = true;
    if (!mesa?.current_order_id) {
      setError('La mesa no tiene una orden activa para gestionar.');
      return false;
    }

    if (!context?.businessId) {
      setError('No se encontro el negocio activo para cargar el catalogo.');
      return false;
    }

    const orderId = String(mesa.current_order_id || '').trim();
    const providedItems = Array.isArray(options?.initialItems) ? options.initialItems : null;
    const inMemoryCache = orderId ? orderItemsCacheRef.current.get(orderId) : null;
    const serviceCache = orderId ? getOrderItemsCacheSnapshot(orderId) : null;
    const cachedItems = providedItems || inMemoryCache || serviceCache?.items || null;
    const skipOrderItemsFetch = options?.skipOrderItemsFetch === true;

    // Mostrar modal de inmediato para reducir latencia percibida.
    setSelectedMesa(mesa);
    setShowOrderModal(true);
    setLoadingOrder(!cachedItems && !skipOrderItemsFetch);
    setOrderModalError(null);

    if (cachedItems) {
      setOrderItems(cachedItems);
      if (orderId) {
        orderItemsCacheRef.current.set(orderId, cachedItems);
      }
      patchMesaOrderUnits(orderId, sumOrderItemsQuantity(cachedItems));
      patchMesaOrderTotal(mesa.id, orderId, calculateOrderTotal(cachedItems));
    }

    const skipLockAcquire = options?.skipLockAcquire === true;
    if (!skipLockAcquire) {
      const lockGranted = await acquireMesaLockForEdition(mesa);
      if (!lockGranted) {
        setLoadingOrder(false);
        setShowOrderModal(false);
        setSelectedMesa(null);
        setOrderItems([]);
        setSearchCatalog('');
        setIsSearchFocused(false);
        setMutatingOrderItemId(null);
        return false;
      }
    }

    if (skipOrderItemsFetch) {
      if (!cachedItems) {
        setOrderItems([]);
        patchMesaOrderUnits(orderId, 0);
        orderItemsCacheRef.current.set(orderId, []);
      }
      setLoadingOrder(false);
      return true;
    }

    try {
      // Mantiene catalogo precargado sin bloquear apertura de orden.
      void ensureCatalogLoaded(context.businessId, { forceRefresh: true }).catch(() => {
        // no-op: mostramos orden aunque el catalogo falle temporalmente
      });

      const snapshot = await loadOpenOrderSnapshot(orderId, {
        forceRefresh: Boolean(cachedItems),
      });
      const previousItems = cachedItems || orderItemsCacheRef.current.get(orderId) || [];
      const mergedItems = reconcileOrderItemsFromServer(previousItems, snapshot.items);
      setOrderItems(mergedItems);
      orderItemsCacheRef.current.set(orderId, mergedItems);
      setOrderItemsCacheSnapshot(orderId, mergedItems);
      patchMesaOrderUnits(orderId, sumOrderItemsQuantity(mergedItems));
      patchMesaOrderTotal(mesa.id, orderId, calculateOrderTotal(mergedItems));
    } catch (err) {
      if (!cachedItems) {
        setOrderModalError(err instanceof Error ? err.message : 'No se pudo cargar la orden.');
      }
    } finally {
      setLoadingOrder(false);
    }
    return true;
  }, [acquireMesaLockForEdition, context?.businessId, ensureCatalogLoaded, patchMesaOrderTotal, patchMesaOrderUnits]);

  const handleSaveOrder = useCallback(async () => {
    if (releasingEmptyOrder || isClosingOrder || isSavingOrder) return;

    const snapshotBeforeSave = latestOrderItemsRef.current;
    if (snapshotBeforeSave.length === 0) {
      void releaseEmptyOrderAndClose();
      return;
    }

    if (!selectedMesa?.id || !selectedMesa.current_order_id) {
      setOrderModalError('No hay una orden activa para guardar.');
      return;
    }

    setIsSavingOrder(true);
    setOrderModalError(null);

    try {
      // Fuerza envio inmediato de cambios de cantidad pendientes antes de guardar.
      if (quantitySyncTimerRef.current) {
        clearTimeout(quantitySyncTimerRef.current);
        quantitySyncTimerRef.current = null;
      }

      const pendingUpdates = Array.from(pendingQuantityUpdatesRef.current.values());
      if (pendingUpdates.length > 0) {
        pendingQuantityUpdatesRef.current.clear();
        addCatalogQueueRef.current = addCatalogQueueRef.current.then(async () => {
          for (const update of pendingUpdates) {
            await syncOrderItemQuantity(update);
          }
        });
      }

      // Espera mutaciones pendientes (agregar + actualizar cantidades).
      await addCatalogQueueRef.current;

      // Persistencia final del snapshot local para evitar carreras de sincronizacion.
      const snapshotToPersist = latestOrderItemsRef.current;
      if (snapshotToPersist.length === 0) {
        void releaseEmptyOrderAndClose();
        return;
      }

      const persisted = await persistOrderSnapshot({
        orderId: selectedMesa.current_order_id,
        items: snapshotToPersist,
        skipReload: true,
      });

      setOrderItems(persisted.items);
      orderItemsCacheRef.current.set(selectedMesa.current_order_id, persisted.items);
      setOrderItemsCacheSnapshot(selectedMesa.current_order_id, persisted.items);
      const persistedUnits = sumOrderItemsQuantity(persisted.items);
      patchMesaOrderTotal(selectedMesa.id, selectedMesa.current_order_id, persisted.total);
      patchMesaOrderUnits(selectedMesa.current_order_id, persistedUnits);
      publishRealtimeOrderSummary(
        selectedMesa,
        selectedMesa.current_order_id,
        persisted.total,
        persistedUnits,
        'confirmed',
      );
      const toastLabel = mesaDisplayName(selectedMesa);
      closeOrderModal();
      setMesaSavedLabel(toastLabel);
      setShowMesaSavedToast(true);
    } catch (err) {
      const fallbackMessage = 'No se pudo guardar la orden.';
      const message = err instanceof Error
        ? err.message
        : String((err as { message?: string; details?: string } | null)?.message
          || (err as { details?: string } | null)?.details
          || fallbackMessage);
      setOrderModalError(message || fallbackMessage);
    } finally {
      setIsSavingOrder(false);
    }
  }, [
    closeOrderModal,
    isClosingOrder,
    isSavingOrder,
    patchMesaOrderTotal,
    patchMesaOrderUnits,
    publishRealtimeOrderSummary,
    releaseEmptyOrderAndClose,
    releasingEmptyOrder,
    selectedMesa,
  ]);

  const handleOpenClose = useCallback(async (mesa: MesaRecord, action: 'open' | 'close') => {
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

    const optimisticMesa: MesaRecord = action === 'open'
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
        orders: {
          ...(mesa.orders || {}),
          ...(updatedMesa.orders || {}),
        },
      };

      setMesas((prev) => prev
        .map((row) => (row.id === mergedMesa.id ? mergedMesa : row))
        .sort(compareMesaTableIdentifiers));
      publishMesaStateBroadcast(mergedMesa, {
        previousOrderId,
        mode: 'confirmed',
      });

      if (action === 'open') {
        if (mergedMesa.current_order_id) {
          const openedOrderId = String(mergedMesa.current_order_id || '').trim();
          if (openedOrderId) {
            orderItemsCacheRef.current.set(openedOrderId, []);
            patchMesaOrderUnits(openedOrderId, 0);
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
      if (!isMesaActionVersionCurrent(mesa.id, actionVersion)) {
        return;
      }
      if (action === 'open') {
        closeOrderModal();
      }
      publishMesaStateBroadcast(mesa, {
        previousOrderId,
        mode: 'rollback',
      });
      setError(err instanceof Error ? err.message : 'No se pudo actualizar la mesa.');
    } finally {
      if (isMesaActionVersionCurrent(mesa.id, actionVersion)) {
        setActingMesaId(null);
      }
    }
  }, [
    bumpMesaActionVersion,
    closeOrderModal,
    context?.businessId,
    ensureCatalogLoaded,
    isMesaActionVersionCurrent,
    openOrderModal,
    patchMesaOrderUnits,
    publishMesaStateBroadcast,
    selectedMesa?.id,
    session.access_token,
    session.user.id,
  ]);

  const handleCreateMesa = useCallback(async () => {
    if (isCreatingMesa) return;

    if (!context?.businessId) {
      setError('No se encontro el negocio activo.');
      return;
    }

    const tableIdentifier = normalizeTableIdentifier(newTableNumber);
    if (!tableIdentifier) {
      setError('Ingresa un identificador de mesa valido.');
      return;
    }

    setIsCreatingMesa(true);
    setError(null);

    try {
      const createdMesa = await createMesa({
        businessId: context.businessId,
        tableNumber: tableIdentifier,
      });

      setMesas((prev) => [...prev, createdMesa].sort(compareMesaTableIdentifiers));
      setShowCreateMesaModal(false);
      setNewTableNumber('');
      setMesaCreatedLabel(mesaDisplayName(createdMesa));
      setShowMesaCreatedToast(true);
    } catch (err: any) {
      if (String(err?.code || '') === '23505') {
        setError('Ese identificador de mesa ya existe.');
      } else if (String(err?.code || '') === '22P02') {
        setError('En esta base de datos el identificador de mesa debe ser numerico.');
      } else {
        setError(err instanceof Error ? err.message : 'No se pudo crear la mesa.');
      }
    } finally {
      setIsCreatingMesa(false);
    }
  }, [context?.businessId, isCreatingMesa, newTableNumber]);

  const askDeleteMesa = useCallback((mesa: MesaRecord) => {
    if (context?.source === 'employee') {
      setError('No tienes permisos para eliminar mesas.');
      return;
    }
    setMesaToDelete(mesa);
    setShowDeleteMesaModal(true);
  }, [context?.source]);

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
      setMesaDeletedLabel(deletedLabel);
      setShowMesaDeletedToast(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la mesa.');
    } finally {
      setIsDeletingMesa(false);
    }
  }, [closeOrderModal, context?.businessId, context?.source, mesaToDelete, selectedMesa?.id]);

  const handleAddCatalogItem = useCallback(async (catalogItem: MesaOrderCatalogItem) => {
    if (!selectedMesa?.current_order_id) {
      setOrderModalError('No hay una orden activa para agregar items.');
      return;
    }
    if (isClosingOrder || loadingOrder || releasingEmptyOrder) return;

    setSearchCatalog('');
    const orderId = selectedMesa.current_order_id;
    let optimisticItems: MesaOrderItem[] = [];
    let previousItemsSnapshot: MesaOrderItem[] = [];
    setOrderItems((prev) => {
      previousItemsSnapshot = prev;
      const existing = prev.find((item) => {
        if (catalogItem.item_type === 'combo') {
          return String(item.combo_id || '') === String(catalogItem.combo_id || '');
        }
        return String(item.product_id || '') === String(catalogItem.product_id || '');
      });

      if (existing) {
        optimisticItems = prev.map((item) => {
          if (item.id !== existing.id) return item;
          const nextQuantity = Number(item.quantity || 0) + 1;
          const unitPrice = Number(item.price || catalogItem.sale_price || 0);
          return {
            ...item,
            quantity: nextQuantity,
            subtotal: nextQuantity * unitPrice,
          };
        });
      } else {
        const optimisticId = `tmp-${catalogItem.item_type}:${catalogItem.id}-${Date.now()}`;
        optimisticItems = [
          ...prev,
          {
            id: optimisticId,
            order_id: orderId,
            product_id: catalogItem.item_type === 'product' ? catalogItem.product_id : null,
            combo_id: catalogItem.item_type === 'combo' ? catalogItem.combo_id : null,
            quantity: 1,
            price: Number(catalogItem.sale_price || 0),
            subtotal: Number(catalogItem.sale_price || 0),
            products: catalogItem.item_type === 'product'
              ? {
                  id: catalogItem.product_id,
                  name: catalogItem.name,
                  code: catalogItem.code || undefined,
                }
              : null,
            combos: catalogItem.item_type === 'combo'
              ? {
                  id: catalogItem.combo_id,
                  nombre: catalogItem.name,
                }
              : null,
          },
        ];
      }

      return optimisticItems;
    });

    const optimisticUnits = sumOrderItemsQuantity(optimisticItems);
    const optimisticTotal = calculateOrderTotal(optimisticItems);
    patchMesaOrderUnits(orderId, optimisticUnits);
    patchMesaOrderTotal(selectedMesa.id, orderId, optimisticTotal);
    publishRealtimeOrderSummary(selectedMesa, orderId, optimisticTotal, optimisticUnits, 'optimistic');
    setOrderModalError(null);
    addCatalogQueueRef.current = addCatalogQueueRef.current
      .then(async () => {
        const result = await addCatalogItemToOrder({
          orderId,
          catalogItem,
          quantity: 1,
        });
        const confirmedItem: MesaOrderItem = {
          ...result.item,
          products: catalogItem.item_type === 'product'
            ? {
                id: catalogItem.product_id,
                name: catalogItem.name,
                code: catalogItem.code || undefined,
              }
            : null,
          combos: catalogItem.item_type === 'combo'
            ? {
                id: catalogItem.combo_id,
                nombre: catalogItem.name,
              }
            : null,
        };

        setOrderItems((prev) => {
          const next = reconcileOrderItemsFromServer(prev, [confirmedItem]);
          const confirmedUnits = sumOrderItemsQuantity(next);
          const confirmedTotal = calculateOrderTotal(next);
          patchMesaOrderUnits(orderId, confirmedUnits);
          patchMesaOrderTotal(selectedMesa.id, orderId, confirmedTotal);
          publishRealtimeOrderSummary(selectedMesa, orderId, confirmedTotal, confirmedUnits, 'confirmed');
          return next;
        });

        if (catalogItem.item_type === 'product' && catalogItem.manage_stock) {
          if (Number(catalogItem.stock) < Number(confirmedItem.quantity || 0)) {
            setOrderModalError(`Stock insuficiente para ${catalogItem.name}. Disponible: ${catalogItem.stock}.`);
          }
        }
      })
      .catch((err) => {
        setOrderItems(previousItemsSnapshot);
        const rollbackUnits = sumOrderItemsQuantity(previousItemsSnapshot);
        const rollbackTotal = calculateOrderTotal(previousItemsSnapshot);
        patchMesaOrderUnits(orderId, rollbackUnits);
        patchMesaOrderTotal(selectedMesa.id, orderId, rollbackTotal);
        publishRealtimeOrderSummary(selectedMesa, orderId, rollbackTotal, rollbackUnits, 'rollback');
        setOrderModalError(err instanceof Error ? err.message : 'No se pudo agregar el item.');
      });
  }, [isClosingOrder, loadingOrder, patchMesaOrderTotal, patchMesaOrderUnits, publishRealtimeOrderSummary, releasingEmptyOrder, selectedMesa]);

  const flushPendingQuantityUpdates = useCallback(() => {
    if (quantitySyncTimerRef.current) {
      clearTimeout(quantitySyncTimerRef.current);
      quantitySyncTimerRef.current = null;
    }

    const pendingUpdates = Array.from(pendingQuantityUpdatesRef.current.values());
    if (pendingUpdates.length === 0) return;
    pendingQuantityUpdatesRef.current.clear();

    addCatalogQueueRef.current = addCatalogQueueRef.current
      .then(async () => {
        for (const update of pendingUpdates) {
          await syncOrderItemQuantity(update);
        }
      })
      .catch(async (err) => {
        const fallbackMessage = 'No se pudo actualizar la cantidad.';
        const message = err instanceof Error
          ? err.message
          : String((err as { message?: string } | null)?.message || fallbackMessage);
        setOrderModalError(message || fallbackMessage);

        const latestUpdate = pendingUpdates[pendingUpdates.length - 1];
        if (!latestUpdate) return;

        try {
          const freshItems = await listOrderItems(latestUpdate.orderId);
          setOrderItems(freshItems);
          patchMesaOrderUnits(latestUpdate.orderId, sumOrderItemsQuantity(freshItems));
          // Resync visual si hubo error de persistencia.
        } catch {
          // no-op
        }
      });
  }, [patchMesaOrderUnits]);

  const scheduleQuantitySync = useCallback((payload: {
    orderId: string;
    itemId: string;
    quantity: number;
    price: number;
    total: number;
  }) => {
    pendingQuantityUpdatesRef.current.set(payload.itemId, payload);

    if (quantitySyncTimerRef.current) {
      clearTimeout(quantitySyncTimerRef.current);
    }

    quantitySyncTimerRef.current = setTimeout(() => {
      quantitySyncTimerRef.current = null;
      flushPendingQuantityUpdates();
    }, 110);
  }, [flushPendingQuantityUpdates]);

  const handleUpdateOrderItemQuantity = useCallback((item: MesaOrderItem, delta: number) => {
    if (!selectedMesa?.current_order_id) {
      setOrderModalError('No hay una orden activa para actualizar.');
      return;
    }
    if (String(item.id || '').startsWith('tmp-')) {
      setOrderModalError('Espera un momento mientras se confirma el producto.');
      return;
    }

    const orderId = selectedMesa.current_order_id;
    const itemPrice = Number(item.price || 0);
    let optimisticItems: MesaOrderItem[] = [];
    let resolvedQuantity = 0;

    setOrderItems((prev) => {
      const currentRow = prev.find((row) => row.id === item.id);
      if (!currentRow) {
        optimisticItems = prev;
        resolvedQuantity = 0;
        return prev;
      }

      resolvedQuantity = Math.max(0, Number(currentRow.quantity || 0) + delta);
      if (resolvedQuantity <= 0) {
        optimisticItems = prev.filter((row) => row.id !== item.id);
        return optimisticItems;
      }

      optimisticItems = prev.map((row) => (
        row.id === item.id
          ? {
              ...row,
              quantity: resolvedQuantity,
              subtotal: resolvedQuantity * Number(row.price || 0),
            }
          : row
      ));

      return optimisticItems;
    });

    const optimisticTotal = calculateOrderTotal(optimisticItems);
    const optimisticUnits = sumOrderItemsQuantity(optimisticItems);
    patchMesaOrderUnits(orderId, optimisticUnits);
    patchMesaOrderTotal(selectedMesa.id, orderId, optimisticTotal);
    publishRealtimeOrderSummary(selectedMesa, orderId, optimisticTotal, optimisticUnits, 'optimistic');
    setOrderModalError(null);

    scheduleQuantitySync({
      orderId,
      itemId: item.id,
      quantity: resolvedQuantity,
      price: itemPrice,
      total: optimisticTotal,
    });
  }, [patchMesaOrderTotal, patchMesaOrderUnits, publishRealtimeOrderSummary, scheduleQuantitySync, selectedMesa]);

  const handleRemoveOrderItem = useCallback(async (item: MesaOrderItem) => {
    if (!selectedMesa?.current_order_id) {
      setOrderModalError('No hay una orden activa para eliminar items.');
      return;
    }

    setMutatingOrderItemId(item.id);
    setOrderModalError(null);

    try {
      const result = await removeOrderItemFromOrder({
        orderId: selectedMesa.current_order_id,
        itemId: item.id,
      });

      setOrderItems(result.items);
      const nextUnits = sumOrderItemsQuantity(result.items);
      patchMesaOrderUnits(selectedMesa.current_order_id, nextUnits);
      patchMesaOrderTotal(selectedMesa.id, selectedMesa.current_order_id, result.total);
      publishRealtimeOrderSummary(selectedMesa, selectedMesa.current_order_id, result.total, nextUnits, 'confirmed');
    } catch (err) {
      setOrderModalError(err instanceof Error ? err.message : 'No se pudo eliminar el item.');
    } finally {
      setMutatingOrderItemId(null);
    }
  }, [patchMesaOrderTotal, patchMesaOrderUnits, publishRealtimeOrderSummary, selectedMesa]);

  const handlePrintKitchen = useCallback(async () => {
    if (!selectedMesa) {
      Alert.alert('Impresion de cocina', 'No hay una mesa seleccionada.');
      return;
    }

    if (!Array.isArray(orderItems) || orderItems.length === 0) {
      Alert.alert('Impresion de cocina', 'No hay productos en la orden para imprimir.');
      return;
    }

    const normalizeCategory = (value: unknown) => String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();

    const productCatalogLookup = new Map(
      catalogItemsRef.current
        .filter((item) => item.item_type === 'product')
        .map((item) => [item.product_id, item]),
    );

    const comboCatalogLookup = new Map(
      catalogItemsRef.current
        .filter((item) => item.item_type === 'combo')
        .map((item) => [item.combo_id, item]),
    );

    const categoriasParaCocina = new Set(['plato', 'platos', 'cocina', 'comida']);
    const itemsParaCocina = orderItems.filter((item) => {
      if (item.combo_id) return true;
      const catalogCategory = productCatalogLookup.get(item.product_id || '')?.category;
      const category = normalizeCategory(item.category ?? item.products?.category ?? catalogCategory);
      return categoriasParaCocina.has(category)
        || category.startsWith('plato')
        || category.includes('plato');
    });

    const itemsParaCocinaConNombre = itemsParaCocina.map((item) => {
      if (item.combo_id) {
        const catalogCombo = comboCatalogLookup.get(item.combo_id || '');
        const existingComboName = String(item?.combos?.nombre || '').trim();
        const fallbackComboName = String(catalogCombo?.name || '').trim();

        if (existingComboName || !fallbackComboName) return item;

        return {
          ...item,
          combos: {
            ...(item.combos || {}),
            id: item?.combos?.id || catalogCombo?.combo_id,
            nombre: fallbackComboName,
          },
        };
      }

      const catalogProduct = productCatalogLookup.get(item.product_id || '');
      const existingName = String(item?.products?.name || '').trim();
      const fallbackName = String(catalogProduct?.name || '').trim();

      if (existingName || !fallbackName) return item;

      return {
        ...item,
        products: {
          ...(item.products || {}),
          id: item?.products?.id || catalogProduct?.product_id,
          name: fallbackName,
          code: item?.products?.code || catalogProduct?.code || undefined,
          category: item?.products?.category || catalogProduct?.category || undefined,
        },
      };
    });

    if (itemsParaCocinaConNombre.length === 0) {
      Alert.alert('Impresion de cocina', 'No hay productos que requieran preparación en cocina.');
      return;
    }

    if (!beginPrintFlow()) {
      Alert.alert('Impresion de cocina', 'Ya hay una impresión en curso. Espera a que finalice.');
      return;
    }

    try {
      const mesaLabel = selectedMesa.table_number ?? selectedMesa.name ?? '-';
      const html = buildKitchenOrderHtml({
        mesaNumber: mesaLabel,
        mesaStatus: selectedMesa.status,
        items: itemsParaCocinaConNombre,
        createdAt: new Date(),
      });
      await Print.printAsync({ html });
    } catch (err) {
      Alert.alert('Impresion de cocina', err instanceof Error ? err.message : 'No se pudo imprimir la orden.');
    } finally {
      endPrintFlow();
    }
  }, [beginPrintFlow, endPrintFlow, orderItems, selectedMesa]);

  const askReceiptPrintConfirmation = useCallback(async (saleIds: string[] = []) => {
    if (!Array.isArray(saleIds) || saleIds.length === 0) return false;

    try {
      const salesDataList: Array<{ saleRecord: VentaRecord; saleDetails: any[] }> = [];

      for (const saleId of saleIds) {
        try {
          const normalizedSaleId = String(saleId || '').trim();
          if (!normalizedSaleId) continue;

          const fetchedDetails = await listVentaDetails(normalizedSaleId);
          const details = Array.isArray(fetchedDetails) && fetchedDetails.length > 0 ? fetchedDetails : [];

          const computedTotal = details.reduce((sum, item) => sum + Number(item?.subtotal || 0), 0);
          const saleForPrint: VentaRecord = {
            id: normalizedSaleId,
            business_id: context?.businessId || '',
            user_id: null,
            seller_name: context?.source === 'employee' ? 'Empleado' : 'Administrador',
            payment_method: paymentMethod,
            total: Number(computedTotal),
            created_at: new Date().toISOString(),
            amount_received: null,
            change_amount: null,
            change_breakdown: [],
          };

          salesDataList.push({ saleRecord: saleForPrint, saleDetails: details });
        } catch {
          // Continuar con el siguiente
        }
      }

      if (salesDataList.length === 0) return false;

      // Guardar datos y mostrar modal
      setPrintSalesData(salesDataList);
      setShowPrintModal(true);

      return true;
    } catch {
      return false;
    }
  }, [context?.businessId, context?.source, paymentMethod]);

  const handlePrintConfirm = useCallback(async () => {
    if (!beginPrintFlow()) {
      setOrderModalError('Ya hay una impresión en curso. Espera a que finalice.');
      return;
    }

    setIsPrintingReceipt(true);
    try {
      const printerWidthMm = await getThermalPaperWidthMm();

      for (const { saleRecord, saleDetails } of printSalesData) {
        try {
          const html = buildSaleReceiptHtml({
            sale: saleRecord,
            saleDetails,
            sellerName: saleRecord.seller_name,
            printerWidthMm,
          });

          await Print.printAsync({ html });
        } catch {
          setOrderModalError('No se pudo imprimir alguno de los comprobantes.');
        }
      }
    } catch {
      setOrderModalError('No se pudo imprimir los comprobantes.');
    } finally {
      endPrintFlow();
      setIsPrintingReceipt(false);
      setShowPrintModal(false);
      setPrintSalesData([]);
    }
  }, [beginPrintFlow, endPrintFlow, printSalesData]);

  const handlePrintCancel = useCallback(() => {
    setShowPrintModal(false);
    setPrintSalesData([]);
  }, []);

  const tryAutoPrintReceiptBySaleId = useCallback(async ({
    saleId,
    saleTotal,
    paymentMethod,
    fallbackItems = [],
  }: {
    saleId: string | null;
    saleTotal: number;
    paymentMethod: PaymentMethod;
    fallbackItems?: Array<{
      product_id?: string | null;
      combo_id?: string | null;
      quantity?: number;
      price?: number;
      unit_price?: number;
      subtotal?: number;
      products?: { name?: string; code?: string | null } | null;
      combos?: { nombre?: string } | null;
    }>;
  }) => {
    const normalizedSaleId = String(saleId || '').trim();
    if (!normalizedSaleId || !context?.businessId) return;

    if (!beginPrintFlow()) return;

    try {
      const autoPrintEnabled = await isAutoPrintReceiptEnabled();
      if (!autoPrintEnabled) return;

      const printerWidthMm = await getThermalPaperWidthMm();
      const fetchedDetails = await listVentaDetails(normalizedSaleId);
      const details = Array.isArray(fetchedDetails) && fetchedDetails.length > 0
        ? fetchedDetails
        : (Array.isArray(fallbackItems) ? fallbackItems : []).map((item, index) => ({
            id: `${normalizedSaleId}:${index + 1}`,
            sale_id: normalizedSaleId,
            quantity: Number(item?.quantity || 0),
            unit_price: Number(item?.price || item?.unit_price || 0),
            subtotal: Number(
              item?.subtotal
              || (Number(item?.quantity || 0) * Number(item?.price || item?.unit_price || 0)),
            ),
            product_id: item?.product_id || null,
            combo_id: item?.combo_id || null,
            products: item?.product_id ? { name: item?.products?.name || 'Producto', code: item?.products?.code || undefined } : null,
            combos: item?.combo_id ? { nombre: item?.combos?.nombre || 'Combo' } : null,
          }));

      const computedTotal = details.reduce((sum, item) => sum + Number(item?.subtotal || 0), 0);
      const saleForPrint: VentaRecord = {
        id: normalizedSaleId,
        business_id: context.businessId,
        user_id: null,
        seller_name: context.source === 'employee' ? 'Empleado' : 'Administrador',
        payment_method: paymentMethod,
        total: Number(saleTotal || computedTotal),
        created_at: new Date().toISOString(),
        amount_received: null,
        change_amount: null,
        change_breakdown: [],
      };

      const html = buildSaleReceiptHtml({
        sale: saleForPrint,
        saleDetails: details,
        sellerName: saleForPrint.seller_name,
        printerWidthMm,
      });

      await Print.printAsync({ html });
    } catch {
      setOrderModalError('La venta se cerró, pero no se pudo imprimir el comprobante automáticamente.');
    } finally {
      endPrintFlow();
    }
  }, [beginPrintFlow, context?.businessId, context?.source, endPrintFlow]);

  const getStockValidationMessage = useCallback(() => {
    if (insufficientItems.length > 0) {
      const first = insufficientItems[0];
      return `Stock insuficiente para "${first.product_name}" (disp: ${first.available_stock}, req: ${first.quantity}).`;
    }

    if (insufficientComboComponents.length > 0) {
      const first = insufficientComboComponents[0];
      return `Stock insuficiente para "${first.product_name}" (disp: ${first.available_stock}, req: ${first.required_quantity}).`;
    }

    return null;
  }, [insufficientComboComponents, insufficientItems]);

  const markMesaAsAvailableAfterSale = useCallback((mesaId: string) => {
    let orderIdToClear = '';
    let mesaBusinessId = String(context?.businessId || '').trim();
    let mesaTableNumber: string | number | null | undefined = null;
    let mesaName: string | null | undefined = null;
    setMesas((prev) => {
      const target = prev.find((mesa) => mesa.id === mesaId) || null;
      orderIdToClear = String(target?.current_order_id || '').trim();
      mesaBusinessId = String(target?.business_id || mesaBusinessId || '').trim();
      mesaTableNumber = target?.table_number;
      mesaName = target?.name;
      return prev.map((mesa) => (
        mesa.id === mesaId
          ? {
              ...mesa,
              status: 'available',
              current_order_id: null,
              orders: null,
            }
          : mesa
      ));
    });
    if (orderIdToClear) {
      clearMesaOrderUnits(orderIdToClear);
      orderItemsCacheRef.current.delete(orderIdToClear);
    }

    publishMesaStateBroadcast({
      id: mesaId,
      business_id: mesaBusinessId,
      status: 'available',
      current_order_id: null,
      table_number: mesaTableNumber ?? null,
      name: mesaName ?? null,
      orders: null,
    }, {
      previousOrderId: orderIdToClear || null,
    });
  }, [clearMesaOrderUnits, context?.businessId, publishMesaStateBroadcast]);

  const handleCloseOrder = useCallback(() => {
    if (orderItems.length === 0) {
      setOrderModalError('No hay productos en la orden para cerrar.');
      return;
    }

    setShowOrderModal(false);
    setShowCloseOrderChoiceModal(true);
  }, [orderItems.length]);

  const handlePayAllTogether = useCallback(() => {
    setShowCloseOrderChoiceModal(false);
    setShowSplitBillModal(false);
    setShowPaymentMethodMenu(false);
    setAmountReceived(String(Math.round(orderTotal || 0)));
    setPaymentMethod('cash');
    setShowPaymentModal(true);
  }, [orderTotal]);

  const handleSplitBill = useCallback(() => {
    setShowCloseOrderChoiceModal(false);
    setShowPaymentModal(false);
    setShowPaymentMethodMenu(false);
    setShowSplitBillModal(true);
  }, []);

  const processPaymentAndClose = useCallback(async () => {
    if (!context?.businessId || !selectedMesa?.id || !selectedMesa.current_order_id) {
      setOrderModalError('No se encontro una orden activa para cerrar.');
      return;
    }

    const stockMessage = getStockValidationMessage();
    if (stockMessage) {
      setOrderModalError(stockMessage);
      return;
    }

    if (paymentMethod === 'cash') {
      if (!cashChangeData?.isValid) {
        setOrderModalError(cashChangeData?.reason === 'insufficient'
          ? 'El monto recibido es menor al total de la cuenta.'
          : 'Ingresa un monto recibido valido.');
        return;
      }
    }

    setIsClosingOrder(true);
    setOrderModalError(null);

    try {
      const resolvedAmountReceived = paymentMethod === 'cash' ? Number(cashChangeData?.paid || 0) : null;
      const resolvedChangeBreakdown = paymentMethod === 'cash'
        ? buildCashBreakdown(Number(cashChangeData?.change || 0))
        : [];

      const closeResult = await closeOrderSingle({
        businessId: context.businessId,
        orderId: selectedMesa.current_order_id,
        tableId: selectedMesa.id,
        paymentMethod,
        amountReceived: resolvedAmountReceived,
        changeBreakdown: resolvedChangeBreakdown,
        orderItems,
      });

      const autoPrintEnabled = await isAutoPrintReceiptEnabled();
      if (autoPrintEnabled && closeResult.saleId) {
        const shouldPrintReceipt = await askReceiptPrintConfirmation([closeResult.saleId]);
        if (!shouldPrintReceipt) {
          // Usuario canceló la impresión
        }
      }

      const saleMesaName = mesaDisplayName(selectedMesa);
      const saleTotal = formatCop(orderTotal);
      markMesaAsAvailableAfterSale(selectedMesa.id);
      closeOrderModal();
      await loadData();
      setSaleMesaLabel(saleMesaName);
      setSaleTotalLabel(saleTotal);
      setShowSaleToast(true);
    } catch (err) {
      setOrderModalError(err instanceof Error ? err.message : 'No se pudo cerrar la orden.');
    } finally {
      setIsClosingOrder(false);
    }
  }, [
    cashChangeData,
    closeOrderModal,
    context?.businessId,
    getStockValidationMessage,
    loadData,
    markMesaAsAvailableAfterSale,
    orderItems,
    paymentMethod,
    selectedMesa,
    askReceiptPrintConfirmation,
    tryAutoPrintReceiptBySaleId,
  ]);

  const processSplitPaymentAndClose = useCallback(async ({ subAccounts }: { subAccounts: SplitSubAccount[] }) => {
    if (!context?.businessId || !selectedMesa?.id || !selectedMesa.current_order_id) {
      setOrderModalError('No se encontro una orden activa para cerrar.');
      return;
    }

    const stockMessage = getStockValidationMessage();
    if (stockMessage) {
      setOrderModalError(stockMessage);
      return;
    }

    setIsClosingOrder(true);
    setOrderModalError(null);

    try {
      const splitResult = await closeOrderAsSplit({
        businessId: context.businessId,
        orderId: selectedMesa.current_order_id,
        tableId: selectedMesa.id,
        subAccounts,
      });

      const autoPrintEnabled = await isAutoPrintReceiptEnabled();
      if (autoPrintEnabled && Array.isArray(splitResult.saleIds) && splitResult.saleIds.length > 0) {
        const shouldPrintReceipts = await askReceiptPrintConfirmation(splitResult.saleIds);
        if (!shouldPrintReceipts) {
          // Usuario canceló la impresión
        }
      }

      const saleMesaName = mesaDisplayName(selectedMesa);
      const saleTotal = formatCop(orderTotal);
      markMesaAsAvailableAfterSale(selectedMesa.id);
      closeOrderModal();
      await loadData();
      setSaleMesaLabel(saleMesaName);
      setSaleTotalLabel(saleTotal);
      setShowSaleToast(true);
    } catch (err) {
      setOrderModalError(err instanceof Error ? err.message : 'No se pudo cerrar la orden dividida.');
    } finally {
      setIsClosingOrder(false);
    }
  }, [askReceiptPrintConfirmation, closeOrderModal, context?.businessId, getStockValidationMessage, loadData, markMesaAsAvailableAfterSale, selectedMesa, tryAutoPrintReceiptBySaleId]);

  const mesaPreviewName = useMemo(() => {
    const identifier = normalizeTableIdentifier(newTableNumber);
    if (!identifier) return 'Mesa';
    if (/^mesa\s+/i.test(identifier)) return identifier;
    return `Mesa ${identifier}`;
  }, [newTableNumber]);

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
            <Text style={styles.mesasPanelTitle} numberOfLines={2}>Gestión de Mesas</Text>
          </View>

          <Pressable
            style={styles.addMesaButtonWrap}
            onPress={() => {
              setShowCreateMesaModal(true);
              setNewTableNumber('');
            }}
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

        <View style={styles.mesasPanelBody}>
          {loading ? (
            <View style={styles.loadingBlock}>
              <ActivityIndicator color={STOCKY_COLORS.primary900} />
            </View>
          ) : null}


          {!loading && mesas.length === 0 ? (
            <Text style={styles.emptyState}>No hay mesas registradas para este negocio.</Text>
          ) : null}

          {mesas.map((mesa) => {
            const occupied = isMesaOccupied(mesa.status);
            const isBusy = actingMesaId === mesa.id;
            const mesaLock = mesaLocksByTableId[mesa.id] || null;
            const lockOwnerId = String(mesaLock?.lock_owner_user_id || '').trim();
            const lockToken = String(mesaLock?.lock_token || '').trim();
            const heldLock = heldMesaLockRef.current;
            const isLocalHeldLock = Boolean(
              heldLock
              && heldLock.tableId === mesa.id
              && heldLock.businessId === context?.businessId,
            );
            const heldLockToken = isLocalHeldLock ? String(heldLock?.lockToken || '').trim() : '';
            const isOwnedByCurrentUser = Boolean(
              lockOwnerId
              && lockOwnerId === String(session.user.id || '').trim(),
            );
            const isSameClientLock = Boolean(lockToken && heldLockToken && lockToken === heldLockToken);
            const lockedByOther = Boolean(
              mesaLock
              && (
                lockOwnerId
                  ? !isOwnedByCurrentUser
                  : (lockToken ? !isSameClientLock : true)
              ),
            );
            const total = Number(mesa?.orders?.total || 0);
            const orderId = String(mesa.current_order_id || '').trim();
            const rowUnits = Number((mesa as any)?.order_units);
            const productsCount = orderId
              ? Number(orderUnitsByOrderId[orderId] ?? (Number.isFinite(rowUnits) ? rowUnits : 0))
              : 0;

            return (
              <Pressable
                key={mesa.id}
                style={[styles.mesaCard, occupied && styles.mesaCardOccupied, lockedByOther && styles.mesaCardLocked]}
                disabled={isBusy}
                onPress={() => {
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
                }}
              >
                {canDeleteMesas ? (
                  <Pressable
                    style={styles.mesaDeleteIconButton}
                    onPress={(event) => {
                      event.stopPropagation?.();
                      askDeleteMesa(mesa);
                    }}
                    hitSlop={8}
                    disabled={isBusy}
                  >
                    <Ionicons name="trash-outline" size={24} color="#111827" />
                  </Pressable>
                ) : null}

                <View style={[styles.mesaIconShell, occupied && styles.mesaIconShellOccupied]}>
                  <Ionicons name="layers-outline" size={54} color={occupied ? '#CA8A04' : '#00A63E'} />
                </View>

                <Text style={styles.mesaTitle}>{mesaDisplayName(mesa)}</Text>
                {!lockedByOther ? <StatusPill occupied={occupied} lockedByOther={lockedByOther} /> : null}
                {occupied && !lockedByOther ? (
                  <View style={styles.mesaOccupiedSummary}>
                    <View style={styles.mesaOccupiedDivider} />
                    <StockyMoneyText value={total} style={styles.mesaMetaTotal} />
                    <Text style={styles.mesaMetaProducts}>{productsCount} {productsCount === 1 ? 'producto' : 'productos'}</Text>
                  </View>
                ) : null}

                {lockedByOther ? (
                  <View pointerEvents="none" style={styles.mesaLockOverlay}>
                    {Platform.OS === 'android' ? (
                      <View style={styles.mesaLockScrimStrong} />
                    ) : (
                      <BlurView
                        style={StyleSheet.absoluteFillObject}
                        tint="light"
                        intensity={24}
                        experimentalBlurMethod="dimezisBlurView"
                      />
                    )}
                    <View style={styles.mesaLockScrim} />
                    <Text style={styles.mesaLockText}>{MESA_IN_USE_MESSAGE}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </View>

      <StockyModal
        visible={showCreateMesaModal}
        title="Agregar Mesa"
        backdropVariant="blur"
        layout="centered"
        centeredOffsetY={106}
        modalAnimationType="fade"
        onClose={() => {
          if (!isCreatingMesa) {
            setShowCreateMesaModal(false);
            setNewTableNumber('');
          }
        }}
        footer={(
          <View style={styles.createMesaFooterRow}>
            <Pressable
              style={styles.createMesaCancelButton}
              onPress={() => {
                setShowCreateMesaModal(false);
                setNewTableNumber('');
              }}
              disabled={isCreatingMesa}
            >
              <Text style={styles.createMesaCancelText}>Cancelar</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                if (isKeyboardVisible) {
                  Keyboard.dismiss();
                  return;
                }
                void handleCreateMesa();
              }}
              disabled={isCreatingMesa}
              style={styles.createMesaPrimaryWrap}
            >
              <LinearGradient
                colors={isCreatingMesa ? ['#7D8AA7', '#9CA3AF'] : ['#4F46E5', '#7C3AED']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.createMesaPrimaryButton, isCreatingMesa && styles.actionButtonDisabled]}
              >
                <Ionicons name="add" size={16} color={STOCKY_COLORS.white} />
                <Text style={styles.createMesaPrimaryText}>{isCreatingMesa ? 'Creando...' : 'Agregar'}</Text>
              </LinearGradient>
            </Pressable>
          </View>
        )}
      >
        <View style={styles.createMesaBody}>
          <View style={styles.createMesaHeroCard}>
            <LinearGradient
              colors={['#4F46E5', '#7C3AED']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.createMesaHeroIcon}
            >
              <Ionicons name="layers-outline" size={24} color={STOCKY_COLORS.white} />
            </LinearGradient>
            <View style={styles.createMesaHeroText}>
              <Text style={styles.createMesaHeroTitle}>Nueva mesa</Text>
            </View>
          </View>

          <View style={styles.createMesaPreviewCard}>
            <View style={styles.createMesaPreviewIcon}>
              <Ionicons name="layers-outline" size={30} color="#00A63E" />
            </View>
            <Text style={styles.createMesaPreviewTitle}>{mesaPreviewName}</Text>
            <View style={styles.createMesaPreviewStatus}>
              <View style={styles.createMesaPreviewDot} />
              <Text style={styles.createMesaPreviewStatusText}>Disponible</Text>
            </View>
          </View>

          <Text style={styles.createMesaLabel}>Identificador</Text>
        </View>
        <View style={styles.createMesaInputShell}>
          <Ionicons name="pricetag-outline" size={18} color="#64748B" />
          <TextInput
            value={newTableNumber}
            onChangeText={setNewTableNumber}
            placeholder="Identificador de mesa"
            placeholderTextColor={STOCKY_COLORS.textMuted}
            style={styles.createMesaInputField}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </StockyModal>

      <StockyDeleteConfirmModal
        visible={showDeleteMesaModal}
        title="Eliminar mesa"
        message="Se eliminará la mesa y sus ordenes asociadas."
        warning="No se puede deshacer."
        itemLabel={mesaToDelete ? mesaDisplayName(mesaToDelete) : null}
        loading={isDeletingMesa}
        onCancel={() => {
          if (!isDeletingMesa) {
            setShowDeleteMesaModal(false);
            setMesaToDelete(null);
          }
        }}
        onConfirm={confirmDeleteMesa}
      />

      <StockyModal
        visible={showOrderModal}
        onClose={() => {
          void handleDismissOrderModal();
        }}
        backdropVariant="blur"
        layout="centered"
        modalAnimationType="fade"
        animationStyle="web"
        animationDurationMs={420}
        animationScaleFrom={1}
        bodyFlex
        deferContent
        deferBehavior="hide"
        deferFallback={(
          <View style={styles.orderModalDeferred}>
          </View>
        )}
        sheetStyle={styles.orderModalSheet}
        headerSlot={(
          <View style={styles.orderModalHeader}>
            <LinearGradient
              colors={['#4F46E5', '#7C3AED']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.orderModalHeaderIcon}
            >
              <Ionicons name="cart-outline" size={32} color="#D1D5DB" />
            </LinearGradient>
            <Text style={styles.orderModalHeaderTitle}>{orderModalTitle}</Text>
          </View>
        )}
        contentContainerStyle={styles.orderModalContent}
        footerStyle={styles.orderModalFooter}
        footer={(
          <View style={styles.orderFooterContainer}>
            <View style={styles.orderFooterTotalBlock}>
              <Text style={styles.orderFooterTotalLabel}>Total a pagar:</Text>
              <StockyMoneyText value={orderTotal} style={styles.orderFooterTotalValue} />
            </View>

            <Pressable
              style={[styles.orderActionButton, (releasingEmptyOrder || isSavingOrder) && styles.actionButtonDisabled]}
              onPress={() => {
                void handleSaveOrder();
              }}
              disabled={releasingEmptyOrder || isSavingOrder}
            >
              <Ionicons name="save-outline" size={20} color="#111827" />
              <Text style={styles.orderActionButtonText}>
                {(releasingEmptyOrder || isSavingOrder) ? 'Guardando...' : 'Guardar'}
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.orderActionButton,
                styles.orderPrintButton,
                (orderItems.length === 0 || releasingEmptyOrder || isPrintInProgress) && styles.orderActionButtonDisabledLight,
              ]}
              onPress={handlePrintKitchen}
              disabled={orderItems.length === 0 || releasingEmptyOrder || isPrintInProgress}
            >
              <Ionicons name="print-outline" size={20} color={orderItems.length === 0 ? '#93A5CD' : '#64748B'} />
              <Text style={[styles.orderActionButtonText, styles.orderPrintButtonText]}>
                {isPrintInProgress ? 'Imprimiendo...' : 'Imprimir para cocina'}
              </Text>
            </Pressable>

            <Pressable
              onPress={handleCloseOrder}
              disabled={isClosingOrder || releasingEmptyOrder}
              style={(orderItems.length === 0 || isClosingOrder || releasingEmptyOrder) ? styles.actionButtonDisabled : undefined}
            >
              <LinearGradient
                colors={
                  (orderItems.length === 0 || isClosingOrder || releasingEmptyOrder)
                    ? ['#C4B5FD', '#C4B5FD']
                    : ['#A78BFA', '#7C3AED']
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.orderCloseButton}
              >
                <Ionicons name="checkmark-circle-outline" size={20} color="#E5E7EB" />
                <Text style={styles.orderCloseButtonText}>
                  {isClosingOrder ? 'Procesando...' : 'Cerrar Orden'}
                </Text>
              </LinearGradient>
            </Pressable>
          </View>
        )}
      >

        <View style={styles.catalogSearchHeader}>
          <Ionicons name="search-outline" size={24} color="#111827" />
          <Text style={styles.catalogSearchHeaderText}>Agregar Producto o Combo</Text>
        </View>

        <TextInput
          value={searchCatalog}
          onChangeText={setSearchCatalog}
          placeholder="Buscar por nombre..."
          placeholderTextColor={STOCKY_COLORS.textMuted}
          style={[styles.searchInput, isSearchFocused && styles.searchInputFocused]}
          autoCapitalize="none"
          autoCorrect={false}
          onFocus={() => setIsSearchFocused(true)}
          onBlur={() => setIsSearchFocused(false)}
        />

        {loadingOrder ? null : null}

        {hasCatalogQuery && isCatalogLoading ? (
          <Text style={styles.emptyState}>Cargando productos...</Text>
        ) : hasCatalogQuery && filteredCatalog.length === 0 ? (
          <Text style={styles.emptyState}>No hay resultados en el catalogo.</Text>
        ) : hasCatalogQuery ? (
          <View style={styles.catalogResultsCard}>
            <ScrollView
              style={styles.catalogResultsScroll}
              nestedScrollEnabled
              keyboardShouldPersistTaps="never"
              showsVerticalScrollIndicator
            >
              {filteredCatalog.map((catalogItem, index) => {
                return (
                  <Pressable
                    key={`${catalogItem.item_type}:${catalogItem.id}`}
                    style={[
                      styles.catalogResultRow,
                      index < filteredCatalog.length - 1 && styles.catalogResultRowDivider,
                      (loadingOrder || isClosingOrder || releasingEmptyOrder)
                        && styles.actionButtonDisabled,
                    ]}
                    disabled={loadingOrder || isClosingOrder || releasingEmptyOrder}
                    onPress={() => {
                      if (isKeyboardVisible) {
                        Keyboard.dismiss();
                        return;
                      }
                      void handleAddCatalogItem(catalogItem);
                    }}
                  >
                    <View style={styles.catalogResultLeft}>
                      <Text style={styles.catalogResultName}>{catalogItem.name}</Text>
                      {catalogItem.item_type === 'combo' ? (
                        <View style={styles.comboPill}>
                          <Text style={styles.comboPillText}>Combo</Text>
                        </View>
                      ) : null}
                    </View>
                    <StockyMoneyText value={Number(catalogItem.sale_price || 0)} style={styles.catalogResultPrice} />
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        <Text style={styles.orderItemsTitle}>Items en la orden</Text>
        {orderItems.length === 0 ? (
          <View style={styles.orderItemsEmpty}>
            <Ionicons name="cart-outline" size={56} color="#0F172A" />
            <Text style={styles.orderItemsEmptyText}>No hay items en esta orden</Text>
          </View>
        ) : null}
        {orderItems.length > 0 ? (
          orderItems.map((item) => {
            const busy = mutatingOrderItemId === item.id;
            return (
              <OrderItemRow
                key={item.id}
                item={item}
                itemName={resolveOrderItemDisplayName(item)}
                busy={busy}
                disabled={isClosingOrder || releasingEmptyOrder}
                onChangeQuantity={handleUpdateOrderItemQuantity}
              />
            );
          })
        ) : null}

        <StockShortageBanner
          insufficientItems={insufficientItems}
          insufficientComboComponents={insufficientComboComponents}
        />
      </StockyModal>

      <StockyModal
        visible={showCloseOrderChoiceModal}
        layout="centered"
        backdropVariant="blur"
        centeredOffsetY={8}
        modalAnimationType="fade"
        sheetStyle={styles.closeChoiceSheet}
        headerSlot={(
          <View style={styles.closeChoiceHeader}>
            <View style={styles.closeChoiceTitleRow}>
              <Ionicons name="card-outline" size={24} color="#111827" />
              <Text style={styles.closeChoiceTitle}>¿Cómo cerrar la orden?</Text>
            </View>
            <Text style={styles.closeChoiceTotalText}>
              Total: <StockyMoneyText value={orderTotal} style={styles.closeChoiceTotalText} />
            </Text>
          </View>
        )}
        contentContainerStyle={styles.closeChoiceContent}
        onClose={() => {
          if (isClosingOrder) return;
          setShowCloseOrderChoiceModal(false);
          setShowOrderModal(true);
        }}
      >
        <Pressable
          style={[styles.closeChoicePrimaryButton, isClosingOrder && styles.actionButtonDisabled]}
          onPress={handlePayAllTogether}
          disabled={isClosingOrder}
        >
          <LinearGradient
            colors={['#4F46E5', '#7C3AED']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.closeChoicePrimaryGradient}
          >
            <Ionicons name="checkmark-circle-outline" size={24} color="#C4B5FD" />
            <Text style={styles.closeChoicePrimaryText}>Pagar todo junto</Text>
          </LinearGradient>
        </Pressable>

        <Pressable
          style={[styles.closeChoiceSecondaryButton, isClosingOrder && styles.actionButtonDisabled]}
          onPress={handleSplitBill}
          disabled={isClosingOrder}
        >
          <Ionicons name="layers-outline" size={23} color="#111827" />
          <Text style={styles.closeChoiceSecondaryText}>Dividir cuenta</Text>
        </Pressable>

        <Pressable
          style={styles.closeChoiceCancelButton}
          onPress={() => {
            if (isClosingOrder) return;
            setShowCloseOrderChoiceModal(false);
            setShowOrderModal(true);
          }}
          disabled={isClosingOrder}
        >
          <Text style={styles.closeChoiceCancelText}>Cancelar</Text>
        </Pressable>
      </StockyModal>

      <StockyModal
        visible={showPaymentModal}
        layout="centered"
        backdropVariant="blur"
        centeredOffsetY={8}
        modalAnimationType="fade"
        sheetStyle={styles.payConfirmSheet}
        headerSlot={(
          <View style={styles.payConfirmHeader}>
            <View style={styles.payConfirmHeaderRow}>
              <View style={styles.payConfirmHeaderBadge}>
                <Ionicons name="card-outline" size={20} color="#4F46E5" />
              </View>
              <View style={styles.payConfirmHeaderTextWrap}>
                <Text style={styles.payConfirmHeaderTitle}>Confirmar pago</Text>
                <Text style={styles.payConfirmHeaderSubtitle}>Revisa el cierre antes de confirmar la venta.</Text>
              </View>
            </View>
          </View>
        )}
        contentContainerStyle={styles.payConfirmContent}
        onClose={() => {
          if (!isClosingOrder) {
            setShowPaymentMethodMenu(false);
            setShowPaymentModal(false);
            setShowCloseOrderChoiceModal(true);
          }
        }}
        footerStyle={styles.payConfirmFooter}
        footer={(
          <View style={styles.payConfirmFooterRow}>
            <Pressable
              style={styles.payCancelButton}
              onPress={() => {
                setShowPaymentMethodMenu(false);
                setShowPaymentModal(false);
                setShowCloseOrderChoiceModal(true);
              }}
              disabled={isClosingOrder}
            >
              <Text style={styles.payCancelButtonText}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={[
                styles.payConfirmButtonWrap,
                (isClosingOrder || (paymentMethod === 'cash' && !cashChangeData?.isValid)) && styles.actionButtonDisabled,
              ]}
              onPress={processPaymentAndClose}
              disabled={isClosingOrder || (paymentMethod === 'cash' && !cashChangeData?.isValid)}
            >
              <LinearGradient
                colors={['#4F46E5', '#7C3AED']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.payConfirmButton}
              >
                <Ionicons name="checkmark-circle-outline" size={22} color="#C4B5FD" />
                <Text style={styles.payConfirmButtonText}>{isClosingOrder ? 'Procesando...' : 'Confirmar Venta'}</Text>
              </LinearGradient>
            </Pressable>
          </View>
        )}
      >
        <LinearGradient
          colors={['#F5F3FF', '#FFFFFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.paySummaryCard}
        >
          <Text style={styles.paySummaryTitle}>TOTAL A PAGAR</Text>
          <StockyMoneyText value={orderTotal} style={styles.paySummaryTotal} />
          <View style={styles.paySummaryMetaRow}>
            <View style={styles.paySummaryMetaBlock}>
              <Text style={styles.paySummaryMetaLabel}>Método</Text>
              <Text style={styles.paySummaryMetaValue}>{getPaymentMethodLabel(paymentMethod)}</Text>
            </View>
            <View style={[styles.paySummaryMetaBlock, styles.paySummaryMetaBlockRight]}>
              <Text style={styles.paySummaryMetaLabel}>Cambio</Text>
              <StockyMoneyText
                value={paymentMethod === 'cash' && cashChangeData?.isValid ? Number(cashChangeData.change || 0) : 0}
                style={styles.paySummaryBottomValue}
              />
            </View>
          </View>
        </LinearGradient>

        <View style={styles.payFormCard}>
          <Text style={styles.payFieldLabel}>Método de pago *</Text>
          <Pressable
            style={styles.payField}
            onPress={() => setShowPaymentMethodMenu((prev) => !prev)}
            disabled={isClosingOrder}
          >
            <View style={styles.payFieldLeft}>
              {isBankPaymentMethod(paymentMethod) ? (
                <Image source={getBankLogoSource(paymentMethod)!} style={styles.payMethodLogo} resizeMode="contain" />
              ) : (
                <Ionicons name={getPaymentMethodIcon(paymentMethod)} size={20} color="#111827" />
              )}
              <Text style={styles.payFieldValue}>{getPaymentMethodLabel(paymentMethod)}</Text>
            </View>
            <Ionicons name={showPaymentMethodMenu ? 'chevron-up' : 'chevron-down'} size={20} color="#374151" />
          </Pressable>
          {showPaymentMethodMenu ? (
            <View style={styles.payMethodMenu}>
              {PAYMENT_METHOD_OPTIONS.map((option) => {
                const selected = option.value === paymentMethod;
                return (
                  <Pressable
                    key={option.value}
                    style={[styles.payMethodMenuItem, selected && styles.payMethodMenuItemSelected]}
                    onPress={() => {
                      setShowPaymentMethodMenu(false);
                      setPaymentMethod(option.value);
                      if (option.value === 'cash' && String(amountReceived || '').trim() === '') {
                        setAmountReceived(String(Math.round(orderTotal || 0)));
                      }
                    }}
                  >
                    <View style={styles.payFieldLeft}>
                      {isBankPaymentMethod(option.value) ? (
                        <Image source={getBankLogoSource(option.value)!} style={styles.payMethodLogoSmall} resizeMode="contain" />
                      ) : (
                        <Ionicons name={getPaymentMethodIcon(option.value)} size={18} color={selected ? '#4F46E5' : '#111827'} />
                      )}
                      <Text style={[styles.payMethodMenuText, selected && styles.payMethodMenuTextSelected]}>{option.label}</Text>
                    </View>
                    {selected ? <Ionicons name="checkmark" size={18} color="#4F46E5" /> : null}
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          <Text style={styles.payFieldLabel}>Cliente (opcional)</Text>
          <View style={styles.payField}>
            <View style={styles.payFieldLeft}>
              <Text style={styles.payFieldValue}>Venta general</Text>
            </View>
            <Ionicons name="chevron-down" size={20} color="#6B7280" />
          </View>

          {paymentMethod === 'cash' ? (
            <>
              <Text style={styles.payFieldLabel}>Monto recibido</Text>
              <TextInput
                value={amountReceived}
                onChangeText={setAmountReceived}
                placeholder="Ej: 128000"
                placeholderTextColor="#9CA3AF"
                style={styles.payInput}
                keyboardType="numeric"
              />
            </>
          ) : null}
        </View>

        <View style={styles.payBreakdownCard}>
          <Text style={styles.payBreakdownTitle}>DESGLOSE DEL CAMBIO</Text>
          {paymentMethod !== 'cash' ? (
            <Text style={styles.payBreakdownText}>No aplica para este método de pago.</Text>
          ) : !cashChangeData?.isValid ? (
            <Text style={[styles.payBreakdownText, styles.payBreakdownError]}>
              Monto recibido inválido o insuficiente.
            </Text>
          ) : Number(cashChangeData.change || 0) <= 0 ? (
            <Text style={styles.payBreakdownText}>Sin cambio para devolver.</Text>
          ) : (
            <View style={styles.payBreakdownList}>
              {buildCashBreakdown(Number(cashChangeData.change || 0)).map((row) => (
                <View key={`${row.denomination}-${row.count}`} style={styles.payBreakdownRow}>
                  <Text style={styles.payBreakdownText}>{row.count} x</Text>
                  <StockyMoneyText value={row.denomination} style={styles.payBreakdownText} />
                </View>
              ))}
            </View>
          )}
        </View>
      </StockyModal>

      <SplitBillModalRN
        visible={showSplitBillModal}
        orderItems={orderItems}
        submitting={isClosingOrder}
        onBack={() => {
          setShowSplitBillModal(false);
          setShowCloseOrderChoiceModal(true);
        }}
        onClose={() => {
          if (isClosingOrder) return;
          setShowSplitBillModal(false);
          setShowCloseOrderChoiceModal(false);
          setShowOrderModal(true);
        }}
        onConfirm={processSplitPaymentAndClose}
      />
      <StockyStatusToast
        visible={showMesaCreatedToast}
        title="Mesa Creada"
        primaryLabel="Mesa"
        primaryValue={mesaCreatedLabel}
        secondaryLabel="Estado"
        secondaryValue="Disponible"
        durationMs={1000}
        onClose={() => setShowMesaCreatedToast(false)}
      />
      <StockyStatusToast
        visible={showMesaDeletedToast}
        title="Mesa Eliminada"
        primaryLabel="Mesa"
        primaryValue={mesaDeletedLabel}
        secondaryLabel="Estado"
        secondaryValue="Eliminada"
        durationMs={1000}
        onClose={() => setShowMesaDeletedToast(false)}
      />
      <StockyStatusToast
        visible={showSaleToast}
        title="Venta Confirmada"
        primaryLabel="Mesa"
        primaryValue={saleMesaLabel}
        secondaryLabel="Total"
        secondaryValue={saleTotalLabel}
        durationMs={1000}
        onClose={() => setShowSaleToast(false)}
      />
      <StockyStatusToast
        visible={showMesaSavedToast}
        title="Mesa Actualizada"
        primaryLabel="Mesa"
        primaryValue={mesaSavedLabel}
        secondaryLabel="Estado"
        secondaryValue="Actualizada"
        durationMs={1000}
        onClose={() => setShowMesaSavedToast(false)}
      />
      <PrintReceiptConfirmModal
        visible={showPrintModal}
        onConfirm={handlePrintConfirm}
        onCancel={handlePrintCancel}
        isLoading={isPrintingReceipt}
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
  mesasPanelBody: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 14,
  },
  loadingBlock: {
    minHeight: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    color: STOCKY_COLORS.textMuted,
    fontSize: 13,
    fontWeight: '500',
  },
  mesaCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#DCE2E8',
    backgroundColor: '#F5FAF7',
    paddingHorizontal: 14,
    paddingVertical: 16,
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
  },
  mesaCardOccupied: {
    backgroundColor: '#F7F9F3',
  },
  mesaCardLocked: {
    borderColor: '#F59E0B',
    backgroundColor: 'rgba(255, 248, 235, 0.66)',
  },
  mesaLockOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  mesaLockScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.24)',
  },
  mesaLockScrimStrong: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
  },
  mesaDeleteIconButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 2,
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mesaIconShell: {
    width: 98,
    height: 98,
    borderRadius: 24,
    backgroundColor: '#DDF5E7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mesaIconShellOccupied: {
    backgroundColor: '#F5EDBF',
  },
  mesaTitle: {
    color: '#0F172A',
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
    textAlign: 'center',
  },
  mesaOccupiedSummary: {
    width: '100%',
    marginTop: 2,
    alignItems: 'center',
    gap: 4,
  },
  mesaOccupiedDivider: {
    width: '100%',
    height: 1,
    backgroundColor: '#E5E7EB',
    marginBottom: 8,
  },
  mesaMetaTotal: {
    color: '#111827',
    fontSize: 22,
    lineHeight: 30,
    fontWeight: '700',
  },
  mesaMetaProducts: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '500',
  },
  mesaLockText: {
    color: '#9A3412',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 14,
    zIndex: 1,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '700',
  },
  statusOccupied: {
    backgroundColor: '#FACC15',
  },
  statusOccupiedText: {
    color: '#6B7280',
  },
  statusAvailable: {
    backgroundColor: '#0AC946',
  },
  statusAvailableText: {
    color: '#E9FFEF',
  },
  statusLocked: {
    backgroundColor: '#FDBA74',
  },
  statusLockedText: {
    color: '#7C2D12',
  },
  statusDot: {
    width: 16,
    height: 16,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusDotOccupied: {
    backgroundColor: '#EF4444',
    borderColor: '#DC2626',
  },
  statusDotAvailable: {
    backgroundColor: '#7CC74D',
    borderColor: '#65A30D',
  },
  statusDotLocked: {
    backgroundColor: '#EA580C',
    borderColor: '#C2410C',
  },
  actionButton: {
    minHeight: 42,
    borderRadius: STOCKY_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: STOCKY_COLORS.primary700,
    paddingHorizontal: 12,
    flex: 1,
  },
  closeButton: {
    backgroundColor: '#991B1B',
  },
  actionButtonDisabled: {
    opacity: 0.7,
  },
  actionButtonText: {
    color: STOCKY_COLORS.white,
    fontSize: 13,
    fontWeight: '800',
  },
  secondaryButton: {
    minHeight: 42,
    borderRadius: STOCKY_RADIUS.md,
    borderWidth: 1,
    borderColor: STOCKY_COLORS.borderSoft,
    backgroundColor: 'rgba(232, 244, 246, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    flex: 1,
  },
  secondaryButtonText: {
    color: STOCKY_COLORS.primary900,
    fontSize: 13,
    fontWeight: '800',
  },
  manageButton: {
    minHeight: 42,
    borderRadius: STOCKY_RADIUS.md,
    borderWidth: 1,
    borderColor: STOCKY_COLORS.borderSoft,
    backgroundColor: 'rgba(232, 244, 246, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    flex: 1,
  },
  manageButtonText: {
    color: STOCKY_COLORS.primary900,
    fontSize: 13,
    fontWeight: '800',
  },
  deleteButton: {
    minHeight: 42,
    borderRadius: STOCKY_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    paddingHorizontal: 12,
    minWidth: 96,
  },
  deleteButtonText: {
    color: STOCKY_COLORS.white,
    fontSize: 13,
    fontWeight: '800',
  },
  orderModalSheet: {
    maxHeight: '88%',
    height: '88%',
    borderRadius: 26,
    borderColor: '#D9DEE8',
  },
  orderModalHeader: {
    minHeight: 84,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  orderModalHeaderIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderModalHeaderTitle: {
    flex: 1,
    color: '#111827',
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
  },
  orderModalContent: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  orderModalFooter: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#F3F4F6',
  },
  orderModalDeferred: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    gap: 8,
  },
  orderModalDeferredText: {
    color: STOCKY_COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  orderFooterContainer: {
    gap: 10,
  },
  orderFooterTotalBlock: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    flexWrap: 'wrap',
  },
  orderFooterTotalLabel: {
    color: '#374151',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  orderFooterTotalValue: {
    color: '#0F172A',
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '800',
  },
  orderActionButton: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  orderActionButtonText: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '600',
  },
  orderPrintButton: {
    borderColor: '#DBE2F2',
  },
  orderPrintButtonText: {
    color: '#6B7FAF',
  },
  orderCloseButton: {
    minHeight: 48,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  orderCloseButtonText: {
    color: '#E5E7EB',
    fontSize: 16,
    fontWeight: '700',
  },
  orderActionButtonDisabledLight: {
    opacity: 0.7,
  },
  closeChoiceSheet: {
    borderRadius: 24,
    borderColor: '#E5E7EB',
    maxWidth: 440,
  },
  closeChoiceHeader: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 10,
  },
  closeChoiceTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  closeChoiceTitleIcon: {
    fontSize: 26,
    lineHeight: 30,
  },
  closeChoiceTitle: {
    color: '#111827',
    fontSize: 22,
    lineHeight: 30,
    fontWeight: '700',
  },
  closeChoiceTotalText: {
    color: '#374151',
    fontSize: 15,
    lineHeight: 24,
    fontWeight: '500',
  },
  closeChoiceContent: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 12,
  },
  closeChoicePrimaryButton: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  closeChoicePrimaryGradient: {
    minHeight: 58,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 14,
  },
  closeChoicePrimaryText: {
    color: '#D1D5DB',
    fontSize: 20,
    fontWeight: '500',
  },
  closeChoiceSecondaryButton: {
    minHeight: 58,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#CFD8E3',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 14,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  closeChoiceSecondaryText: {
    color: '#111827',
    fontSize: 19,
    fontWeight: '500',
  },
  closeChoiceCancelButton: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  closeChoiceCancelText: {
    color: '#111827',
    fontSize: 19,
    fontWeight: '500',
  },
  payConfirmSheet: {
    borderRadius: 26,
    borderColor: '#E2E8F0',
    maxWidth: 450,
  },
  payConfirmHeader: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  payConfirmHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  payConfirmHeaderBadge: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  payConfirmHeaderTextWrap: {
    flex: 1,
    gap: 1,
  },
  payConfirmHeaderTitle: {
    color: '#0F172A',
    fontSize: 20,
    fontWeight: '700',
  },
  payConfirmHeaderSubtitle: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '500',
  },
  payConfirmContent: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  paySummaryCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D6DDEA',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  paySummaryTitle: {
    color: '#475569',
    fontSize: 10,
    letterSpacing: 1.1,
    fontWeight: '700',
  },
  paySummaryTotal: {
    color: '#0F172A',
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
  },
  paySummaryMetaRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  paySummaryMetaBlock: {
    flex: 1,
    gap: 2,
  },
  paySummaryMetaBlockRight: {
    alignItems: 'flex-end',
  },
  paySummaryMetaLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '600',
  },
  paySummaryMetaValue: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '700',
  },
  paySummaryBottomValue: {
    color: '#0F766E',
    fontSize: 13,
    fontWeight: '700',
  },
  payFormCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  payFieldLabel: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  payField: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D4DCE7',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  payFieldLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flexShrink: 1,
  },
  payMethodLogo: {
    width: 22,
    height: 14,
  },
  payMethodLogoSmall: {
    width: 20,
    height: 12,
  },
  payFieldValue: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '500',
  },
  payMethodMenu: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D4DCE7',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  payMethodMenuItem: {
    minHeight: 40,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  payMethodMenuItemSelected: {
    backgroundColor: '#F5F3FF',
  },
  payMethodMenuText: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '500',
  },
  payMethodMenuTextSelected: {
    color: '#4F46E5',
    fontWeight: '700',
  },
  payInput: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D4DCE7',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    color: '#111827',
    fontSize: 14,
    fontWeight: '500',
  },
  payBreakdownCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  payBreakdownTitle: {
    color: '#475569',
    fontSize: 10,
    letterSpacing: 1,
    fontWeight: '700',
  },
  payBreakdownList: {
    gap: 4,
  },
  payBreakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  payBreakdownText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '500',
  },
  payBreakdownError: {
    color: '#B91C1C',
  },
  payConfirmFooter: {
    borderTopWidth: 0,
    paddingHorizontal: 14,
    paddingTop: 0,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
  },
  payConfirmFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  payCancelButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D4DCE7',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  payCancelButtonText: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '600',
  },
  payConfirmButtonWrap: {
    flex: 1.15,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 3,
  },
  payConfirmButton: {
    minHeight: 44,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  payConfirmButtonText: {
    color: '#E9D5FF',
    fontSize: 14,
    fontWeight: '600',
  },
  modalFooterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  createMesaFooterRow: {
    flexDirection: 'row',
    gap: 10,
  },
  createMesaCancelButton: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    flex: 1,
  },
  createMesaCancelText: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '700',
  },
  createMesaPrimaryWrap: {
    flex: 1,
  },
  createMesaPrimaryButton: {
    minHeight: 44,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
  },
  createMesaPrimaryText: {
    color: STOCKY_COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
  createMesaBody: {
    gap: 10,
  },
  createMesaHeroCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DDD6FE',
    backgroundColor: '#F5F3FF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  createMesaHeroIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createMesaHeroText: {
    flex: 1,
    gap: 2,
  },
  createMesaHeroTitle: {
    color: '#312E81',
    fontSize: 15,
    fontWeight: '800',
  },
  createMesaPreviewCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#DCE2E8',
    backgroundColor: '#F5FAF7',
    paddingVertical: 14,
    alignItems: 'center',
    gap: 8,
  },
  createMesaPreviewIcon: {
    width: 66,
    height: 66,
    borderRadius: 18,
    backgroundColor: '#DDF5E7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createMesaPreviewTitle: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '800',
  },
  createMesaPreviewStatus: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: '#0AC946',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  createMesaPreviewDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    backgroundColor: '#7CC74D',
    borderWidth: 1,
    borderColor: '#65A30D',
  },
  createMesaPreviewStatusText: {
    color: '#E9FFEF',
    fontSize: 12,
    fontWeight: '700',
  },
  createMesaHint: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },
  createMesaLabel: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '700',
  },
  createMesaInputShell: {
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  createMesaInputField: {
    flex: 1,
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '600',
    paddingVertical: 10,
  },
  deleteMesaBody: {
    gap: 10,
  },
  deleteMesaHeroCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  deleteMesaHeroIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  deleteMesaHeroText: {
    flex: 1,
    gap: 2,
  },
  deleteMesaHeroTitle: {
    color: '#7F1D1D',
    fontSize: 15,
    fontWeight: '800',
  },
  deleteMesaHeroDescription: {
    color: '#991B1B',
    fontSize: 13,
    fontWeight: '600',
  },
  deleteMesaPreviewCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FFF7F7',
    paddingVertical: 14,
    alignItems: 'center',
    gap: 8,
  },
  deleteMesaPreviewIcon: {
    width: 62,
    height: 62,
    borderRadius: 18,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteMesaPreviewTitle: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '800',
  },
  deleteMesaPreviewSubTitle: {
    color: '#991B1B',
    fontSize: 12,
    fontWeight: '700',
  },
  deleteMesaFooterRow: {
    flexDirection: 'row',
    gap: 10,
  },
  deleteMesaCancelButton: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    flex: 1,
  },
  deleteMesaCancelText: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '700',
  },
  deleteMesaPrimaryWrap: {
    flex: 1,
  },
  deleteMesaPrimaryButton: {
    minHeight: 44,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
  },
  deleteMesaPrimaryText: {
    color: STOCKY_COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
  modalHint: {
    color: STOCKY_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  modalStrong: {
    color: STOCKY_COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  orderMeta: {
    color: STOCKY_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  catalogSearchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  catalogSearchHeaderText: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '800',
  },
  searchInput: {
    minHeight: 56,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: STOCKY_COLORS.borderSoft,
    backgroundColor: STOCKY_COLORS.surface,
    paddingHorizontal: 16,
    paddingVertical: 0,
    color: STOCKY_COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  searchInputFocused: {
    borderColor: '#6366F1',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.28,
    shadowRadius: 4,
    elevation: 2,
  },
  catalogResultsCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#DCE2E8',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    marginTop: 2,
  },
  catalogResultsScroll: {
    maxHeight: 240,
  },
  catalogResultRow: {
    minHeight: 62,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  catalogResultRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  catalogResultLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  catalogResultName: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
  },
  catalogResultPrice: {
    color: '#16A34A',
    fontSize: 14,
    fontWeight: '700',
  },
  sectionTitle: {
    color: STOCKY_COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 8,
  },
  orderItemsTitle: {
    color: '#111827',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 10,
  },
  orderItemsEmpty: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  orderItemsEmptyText: {
    color: '#1F2937',
    fontSize: 18,
    fontWeight: '500',
    textAlign: 'center',
  },
  sectionSubTitle: {
    color: STOCKY_COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 4,
  },
  modalRow: {
    borderRadius: STOCKY_RADIUS.md,
    borderWidth: 1,
    borderColor: STOCKY_COLORS.borderSoft,
    backgroundColor: STOCKY_COLORS.surface,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalRowMain: {
    flex: 1,
    gap: 3,
  },
  modalRowTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  modalRowTitle: {
    color: STOCKY_COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  modalRowMeta: {
    color: STOCKY_COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  comboPill: {
    borderRadius: 7,
    backgroundColor: 'rgba(37, 99, 235, 0.16)',
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  comboPillText: {
    color: '#1D4ED8',
    fontSize: 9,
    fontWeight: '700',
  },
  catalogPricePill: {
    borderRadius: 8,
    backgroundColor: 'rgba(7, 87, 91, 0.14)',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  catalogPricePillText: {
    color: STOCKY_COLORS.primary900,
    fontSize: 10,
    fontWeight: '800',
  },
  addProductButton: {
    minHeight: 34,
    borderRadius: 10,
    backgroundColor: STOCKY_COLORS.primary700,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  addProductButtonText: {
    color: STOCKY_COLORS.white,
    fontSize: 12,
    fontWeight: '800',
  },
  orderItemCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  orderItemTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  orderItemName: {
    flex: 1,
    color: '#111827',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  orderItemTotal: {
    color: '#111827',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
  },
  orderItemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  orderItemUnitChip: {
    borderRadius: 10,
    backgroundColor: '#EEF2F7',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  orderItemUnitChipText: {
    color: '#475569',
    fontSize: 10,
    fontWeight: '600',
  },
  orderItemSubtotalLabel: {
    color: '#374151',
    fontSize: 11,
    fontWeight: '500',
  },
  orderItemDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginTop: 2,
  },
  orderItemControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 2,
  },
  orderItemStepper: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 3,
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  orderItemStepperButton: {
    width: 34,
    height: 32,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#DCE2E8',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  orderItemMinusText: {
    color: '#BE123C',
    fontSize: 14,
    lineHeight: 16,
    fontWeight: '500',
  },
  orderItemPlusText: {
    color: '#16A34A',
    fontSize: 14,
    lineHeight: 16,
    fontWeight: '500',
  },
  orderItemQtyText: {
    minWidth: 34,
    textAlign: 'center',
    color: '#111827',
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '600',
  },
  shortageContainer: {
    gap: 8,
    marginTop: 4,
  },
  shortageBlock: {
    borderRadius: STOCKY_RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    backgroundColor: 'rgba(254, 226, 226, 0.72)',
    padding: 10,
    gap: 4,
  },
  shortageTitle: {
    color: '#991B1B',
    fontSize: 12,
    fontWeight: '800',
  },
  shortageItem: {
    color: '#7F1D1D',
    fontSize: 11,
    fontWeight: '600',
  },
  paymentMethodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  paymentMethodOption: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: STOCKY_COLORS.borderSoft,
    backgroundColor: STOCKY_COLORS.surface,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  paymentMethodOptionSelected: {
    backgroundColor: STOCKY_COLORS.primary700,
    borderColor: STOCKY_COLORS.primary700,
  },
  paymentMethodOptionText: {
    color: STOCKY_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  paymentMethodOptionTextSelected: {
    color: STOCKY_COLORS.white,
  },
  cashChangeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  cashChangeOk: {
    color: '#166534',
  },
  cashChangeError: {
    color: '#991B1B',
  },
});
