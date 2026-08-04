const ORDER_IS_OPEN = 'open';
const TABLE_OCCUPIED = 'occupied';
const TABLE_AVAILABLE = 'available';

interface TableRecord {
  id?: string | null;
  current_order_id?: string | null;
  status?: string | null;
  business_id?: string | null;
  orders?: { status?: string | null } | null;
}

interface OrderRecord {
  id?: string | null;
  table_id?: string | null;
  status?: string | null;
  business_id?: string | null;
  opened_at?: string | null;
  updated_at?: string | null;
}

interface Finding {
  severity: 'low' | 'medium' | 'high';
  code: string;
  [key: string]: unknown;
}

interface FixOperation {
  type: 'update_table' | 'update_order';
  target: Record<string, string | null>;
  payload: Record<string, string | null>;
  [key: string]: unknown;
}

interface ConsistencyResult {
  findings: Finding[];
  fixes: FixOperation[];
}

function normalizeText(value: unknown): string | null {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

function normalizeStatus(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function normalizeTime(value: unknown): number {
  const ts = Date.parse(String(value || '').trim());
  return Number.isFinite(ts) ? ts : Number.MAX_SAFE_INTEGER;
}

function desiredTableStatus(table: TableRecord): string {
  return normalizeText(table?.current_order_id) ? TABLE_OCCUPIED : TABLE_AVAILABLE;
}

interface CanonicalOrder extends OrderRecord {
  id: string;
  openedTs: number;
}

function pickCanonicalOpenOrderForTable(table: TableRecord, openOrdersForTable: OrderRecord[] = []): CanonicalOrder | null {
  if (!Array.isArray(openOrdersForTable) || openOrdersForTable.length === 0) return null;
  const tableCurrentOrderId = normalizeText(table?.current_order_id);
  const mapped = openOrdersForTable
    .map((order) => ({
      ...order,
      id: normalizeText(order?.id),
      openedTs: normalizeTime(order?.opened_at || order?.updated_at)
    }))
    .filter((order): order is CanonicalOrder => Boolean(order.id) && typeof order.id === 'string')
    .sort((a, b) => {
      if (a.openedTs !== b.openedTs) return a.openedTs - b.openedTs;
      return String(a.id).localeCompare(String(b.id));
    });

  if (tableCurrentOrderId) {
    const currentOrder = mapped.find((order) => order.id === tableCurrentOrderId);
    if (currentOrder) return currentOrder;
  }
  return mapped[0] || null;
}

function pushUniqueFix(fixes: FixOperation[], operation: FixOperation | null): void {
  if (!operation) return;
  const key = JSON.stringify(operation);
  if (fixes.some((item) => JSON.stringify(item) === key)) return;
  fixes.push(operation);
}

function buildFixOperation(type: 'update_table' | 'update_order', target: Record<string, unknown>, payload: Record<string, unknown> = {}): FixOperation {
  return { type, target: target as FixOperation['target'], payload: payload as FixOperation['payload'] };
}

export function detectTableOrderInconsistencies({ tables = [], openOrders = [] }: { tables?: TableRecord[]; openOrders?: OrderRecord[] } = {}): ConsistencyResult {
  const normalizedTables = Array.isArray(tables) ? tables : [];
  const normalizedOrders = Array.isArray(openOrders) ? openOrders : [];

  const tableById = new Map(
    normalizedTables
      .map((table) => [normalizeText(table?.id), table] as const)
      .filter(([id]) => Boolean(id))
  );
  const openOrderById = new Map(
    normalizedOrders
      .map((order) => [normalizeText(order?.id), order] as const)
      .filter(([id]) => Boolean(id))
  );
  const openOrdersByTableId = new Map<string, OrderRecord[]>();
  for (const order of normalizedOrders) {
    const orderId = normalizeText(order?.id);
    const orderStatus = normalizeStatus(order?.status);
    const tableId = normalizeText(order?.table_id);
    if (!orderId || orderStatus !== ORDER_IS_OPEN || !tableId) continue;
    if (!openOrdersByTableId.has(tableId)) openOrdersByTableId.set(tableId, []);
    openOrdersByTableId.get(tableId)!.push(order);
  }

  const findings: Finding[] = [];
  const fixes: FixOperation[] = [];

  for (const table of normalizedTables) {
    const tableId = normalizeText(table?.id);
    if (!tableId) continue;

    const currentOrderId = normalizeText(table?.current_order_id);
    const tableStatus = normalizeStatus(table?.status) || TABLE_AVAILABLE;
    const shouldStatus = desiredTableStatus(table);

    if (tableStatus !== shouldStatus) {
      findings.push({
        severity: 'low',
        code: 'table_status_mismatch',
        tableId,
        tableStatus,
        desiredStatus: shouldStatus
      });
      pushUniqueFix(
        fixes,
        buildFixOperation('update_table', { tableId, businessId: table.business_id }, {
          status: shouldStatus
        })
      );
    }

    if (!currentOrderId) continue;

    const joinedOrderStatus = normalizeStatus(table?.orders?.status);
    const openOrder = openOrderById.get(currentOrderId);
    const joinedOrderIsOpen = joinedOrderStatus === ORDER_IS_OPEN;
    const openOrderExists = Boolean(openOrder);

    if (!joinedOrderIsOpen && !openOrderExists) {
      findings.push({
        severity: 'high',
        code: 'table_points_to_closed_or_missing_order',
        tableId,
        currentOrderId
      });
      pushUniqueFix(
        fixes,
        buildFixOperation('update_table', { tableId, businessId: table.business_id }, {
          current_order_id: null,
          status: TABLE_AVAILABLE
        })
      );
    }
  }

  for (const order of normalizedOrders) {
    const orderId = normalizeText(order?.id);
    const tableId = normalizeText(order?.table_id);
    const orderStatus = normalizeStatus(order?.status);
    if (!orderId || !tableId || orderStatus !== ORDER_IS_OPEN) continue;

    const table = tableById.get(tableId);
    if (!table) {
      findings.push({
        severity: 'medium',
        code: 'open_order_points_to_missing_table',
        orderId,
        tableId
      });
      pushUniqueFix(
        fixes,
        buildFixOperation('update_order', { orderId, businessId: order.business_id }, {
          status: 'cancelled',
          closed_at: new Date().toISOString(),
          table_id: null
        })
      );
      continue;
    }

    const tableCurrentOrderId = normalizeText(table?.current_order_id);
    if (!tableCurrentOrderId) {
      findings.push({
        severity: 'high',
        code: 'open_order_without_table_pointer',
        orderId,
        tableId
      });
      pushUniqueFix(
        fixes,
        buildFixOperation('update_table', { tableId, businessId: table.business_id }, {
          current_order_id: orderId,
          status: TABLE_OCCUPIED
        })
      );
    }
  }

  for (const [tableId, ordersForTable] of openOrdersByTableId.entries()) {
    if (!Array.isArray(ordersForTable) || ordersForTable.length <= 1) continue;
    const table = tableById.get(tableId);
    const canonicalOrder = pickCanonicalOpenOrderForTable(table, ordersForTable);
    if (!canonicalOrder?.id) continue;

    findings.push({
      severity: 'high',
      code: 'order_table_pointer_conflict',
      tableId,
      canonicalOrderId: canonicalOrder.id,
      openOrderIds: ordersForTable.map((order) => normalizeText(order?.id)).filter((id): id is string => Boolean(id))
    });

    pushUniqueFix(
      fixes,
      buildFixOperation('update_table', { tableId, businessId: table?.business_id || canonicalOrder?.business_id }, {
        current_order_id: canonicalOrder.id,
        status: TABLE_OCCUPIED
      })
    );

    for (const conflictingOrder of ordersForTable) {
      const conflictingOrderId = normalizeText(conflictingOrder?.id);
      if (!conflictingOrderId || conflictingOrderId === canonicalOrder.id) continue;
      pushUniqueFix(
        fixes,
        buildFixOperation('update_order', { orderId: conflictingOrderId, businessId: conflictingOrder?.business_id }, {
          status: 'cancelled',
          closed_at: new Date().toISOString(),
          table_id: null
        })
      );
    }
  }

  return {
    findings,
    fixes
  };
}

export default detectTableOrderInconsistencies;
