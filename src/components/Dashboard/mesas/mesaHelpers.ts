import { normalizeTableRecord } from '../../../utils/tableStatus';
import { getOpenOrdersByBusiness } from '../../../data/queries/ordersQueries';
import { getPaymentMethodLabel } from '../../ui/PaymentMethodBankLogo';
import type { Table } from '../../../types/order';

export { getPaymentMethodLabel };
import { isConnectivityError } from '../../../utils/connectivity';

type TranslateFunction = (key: string) => string;

export const MESAS_REMOTE_FALLBACK_POLL_MS = 5000;
export const MESA_LOCK_TTL_SECONDS = 45;
export const MESA_LOCK_HEARTBEAT_MS = 20000;

export const getMesaInUseMessage = (t: TranslateFunction): string =>
  t('mesas:defaults.someoneUsingTable');

export const ORDER_ITEMS_SELECT = `
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

export const ORDER_ITEM_TYPE = {
  PRODUCT: 'product',
  COMBO: 'combo'
} as const;

export interface OrderItem {
  id?: string;
  order_id?: string;
  product_id?: string;
  combo_id?: string;
  quantity?: number;
  price?: number;
  subtotal?: number;
  products?: {
    id?: string;
    name?: string;
    code?: string;
    category?: string;
  };
  combos?: {
    id?: string;
    nombre?: string;
    descripcion?: string;
  };
}

export interface MesaOrders {
  id?: string;
  table_id?: string;
  status?: string;
  total?: number | string;
  opened_at?: string;
  updated_at?: string;
  local_units?: number;
  items_units?: number;
  items_count?: number;
  order_items?: OrderItem[];
}

export type Mesa = {
  id?: string;
  business_id?: string;
  identifier?: string;
  name?: string | null;
  status?: string;
  capacity?: number | null;
  current_order_id?: string | null;
  created_at?: string;
  updated_at?: string;
  table_number?: string | number;
  orders?: Partial<MesaOrders> | null;
};

interface Lock {
  lock_expires_at?: string;
}

interface ErrorLike {
  code?: string;
  message?: string;
  status?: number;
  statusCode?: number;
  hint?: string;
  details?: string;
}

export const toFiniteNumber = (value: unknown, fallback: number = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const normalizeOrderItemNumericFields = (item: OrderItem): OrderItem => {
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

export const getTotalProductUnits = (items: OrderItem[] = []): number =>
  items.reduce((sum, item) => sum + toFiniteNumber(item?.quantity, 0), 0);

export const calculateOrderItemsTotal = (items: OrderItem[] = []): number =>
  items.reduce((sum, item) => {
    const subtotal = Number(item?.subtotal);
    if (Number.isFinite(subtotal)) return sum + subtotal;

    const quantity = toFiniteNumber(item?.quantity, 0);
    const price = toFiniteNumber(item?.price, 0);
    return sum + (quantity * price);
  }, 0);

export const normalizeDisplayName = (value: unknown, t: TranslateFunction): string => {
  const normalized = String(value || '').trim();
  return normalized || t('mesas:defaults.user');
};

export const isMesaLockExpired = (lock: Lock): boolean => {
  const expiresAtMs = Date.parse(String(lock?.lock_expires_at || '').trim());
  return Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now();
};

export const isDuplicateKeyError = (errorLike: ErrorLike): boolean => {
  const code = String(errorLike?.code || '').trim();
  if (code === '23505') return true;
  const message = String(errorLike?.message || '').toLowerCase();
  return message.includes('duplicate key');
};

export const isMissingTableEditLocksRelationError = (errorLike: ErrorLike): boolean => {
  const message = String(errorLike?.message || '').toLowerCase();
  return message.includes('table_edit_locks') && message.includes('does not exist');
};

export const isMissingTableEditLocksColumnError = (errorLike: ErrorLike, columnName: string): boolean => {
  const message = String(errorLike?.message || '').toLowerCase();
  return (
    message.includes('column')
    && message.includes(`"${String(columnName || '').toLowerCase()}"`)
    && message.includes('table_edit_locks')
  );
};

export const getMesaProductUnits = (mesa: Mesa, { selectedMesa = null, orderItems = [] }: { selectedMesa?: Mesa | null; orderItems?: OrderItem[] } = {}): number => {
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

export const normalizeEntityId = (value: unknown): string | null => {
  const normalized = String(value ?? '').trim();
  return normalized || null;
};

export const getOrderItemRenderKey = (item: OrderItem, index: number = 0): string => {
  const comboId = normalizeEntityId(item?.combo_id);
  if (comboId) return `combo:${comboId}`;

  const productId = normalizeEntityId(item?.product_id);
  if (productId) return `product:${productId}`;

  const itemId = normalizeEntityId(item?.id);
  if (itemId) return `id:${itemId}`;

  return `fallback:${index}`;
};

export const mergeOrderItemsPreservingPosition = (previousItems: OrderItem[] = [], incomingItems: OrderItem[] = []): OrderItem[] => {
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
    .map((item) => incomingById.get(item.id)!);

  const newItemsFirst = normalizedIncoming.filter((item) => !item?.id || !previousIds.has(item.id));

  return [...newItemsFirst, ...preserved];
};

export const normalizeTableIdentifier = (value: unknown): string => String(value ?? '').trim();

export const compareTableIdentifiers = (left: Mesa, right: Mesa): number => {
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

export const applyPendingQuantities = (items: OrderItem[] = [], pendingUpdates: Record<string, number> = {}): OrderItem[] => {
  if (!Array.isArray(items) || items.length === 0) return [];
  if (!pendingUpdates || Object.keys(pendingUpdates).length === 0) {
    return items.map((item) => normalizeOrderItemNumericFields(item));
  }

  return items.map((item) => {
    const normalizedItem = normalizeOrderItemNumericFields(item);
    const pendingQuantity = pendingUpdates[normalizedItem?.id ?? ''];
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

export const getOrderItemName = (item: OrderItem, t: TranslateFunction): string =>
  item?.products?.name || item?.combos?.nombre || t('mesas:defaults.item');

export const buildDiagnosticAlertMessage = (errorLike: ErrorLike | string, t: TranslateFunction): string => {
  const fallback = t('mesas:defaults.unknownError');
  const message = String(typeof errorLike === 'string' ? errorLike : errorLike?.message || fallback).trim() || fallback;
  const code = String(typeof errorLike === 'object' ? errorLike?.code : '').trim();
  const status = String(typeof errorLike === 'object' ? (errorLike?.status || errorLike?.statusCode) : '').trim();
  const hint = String(typeof errorLike === 'object' ? errorLike?.hint : '').trim();
  const details = String(typeof errorLike === 'object' ? errorLike?.details : '').trim();

  const diagnosticParts = [
    code ? `code=${code}` : null,
    status ? `status=${status}` : null,
    hint ? `hint=${hint}` : null,
    details ? `details=${details}` : null
  ].filter(Boolean);

  if (diagnosticParts.length === 0) return `${message}`;
  return `${message} [diag: ${diagnosticParts.join(' | ')}]`;
};

export function sanitizeMesaOrderAssociation(mesa: Mesa): Mesa {
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
    } as Table);
  }

  if (!order) {
    return normalizeTableRecord(mesa as Table);
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
    } as Table);
  }

  return normalizeTableRecord(mesa as Table);
}

export async function reconcileClosedOrdersFromOutbox(mesas: Mesa[] = []): Promise<Mesa[]> {
  if (!Array.isArray(mesas) || mesas.length === 0) return mesas;
  return mesas;
}

export function pickCanonicalOpenOrderForTable(openOrders: Mesa['orders'][] = []): Mesa['orders'] | null {
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

export function orderHasProducts(order: Mesa['orders']): boolean {
  const items = Array.isArray(order?.order_items) ? order.order_items : [];
  if (items.length > 0) return true;
  const total = Number(order?.total);
  return Number.isFinite(total) && total > 0;
}

export async function reconcileTablesWithOpenOrders({ mesas = [], businessId }: { mesas?: Mesa[]; businessId: string }): Promise<Mesa[]> {
  if (!Array.isArray(mesas) || mesas.length === 0) return mesas;
  if (!businessId) return mesas;

  try {
    const openOrders = await getOpenOrdersByBusiness(
      businessId,
      'id, business_id, table_id, status, total, opened_at, updated_at, order_items(id)'
    );

    const openOrdersByTableId = new Map<string, Mesa['orders'][]>();
    (Array.isArray(openOrders) ? openOrders : []).forEach((order: Mesa['orders']) => {
      const tableId = normalizeEntityId(order?.table_id);
      const orderId = normalizeEntityId(order?.id);
      const status = String(order?.status || '').trim().toLowerCase();
      if (!tableId || !orderId || status !== 'open') return;
      if (!openOrdersByTableId.has(tableId)) openOrdersByTableId.set(tableId, []);
      openOrdersByTableId.get(tableId)!.push(order);
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
      } as Table);
    });
  } catch {
    return mesas;
  }
}
