function normalizeOrderStatus(status) {
  const raw = String(status || '').trim().toLowerCase();
  if (!raw) return null;
  return raw;
}

function normalizeOrderReference(value) {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw || raw === 'null' || raw === 'undefined') return null;
  return String(value).trim();
}

export function normalizeTableStatus(status) {
  const raw = String(status || '').trim().toLowerCase();
  if (raw === 'open') return 'occupied';
  if (raw === 'closed') return 'available';
  if (raw === 'occupied' || raw === 'available') return raw;
  return 'available';
}

export function normalizeTableRecord(table) {
  if (!table || typeof table !== 'object') return table;

  const normalizedCurrentOrderId = normalizeOrderReference(table.current_order_id);
  const normalizedOrderStatus = normalizeOrderStatus(table?.orders?.status);
  const normalizedRawStatus = normalizeTableStatus(table.status);
  const hasExplicitEmptyItems =
    Array.isArray(table?.orders?.order_items)
    && table.orders.order_items.length === 0;
  const isClosedOrder =
    normalizedOrderStatus === 'closed'
    || normalizedOrderStatus === 'cancelled';
  const hasCurrentOrder = Boolean(normalizedCurrentOrderId);
  // Regla de seguridad offline: si la mesa ya está marcada como disponible,
  // nunca preservar punteros/ordenes antiguas del snapshot local.
  const shouldForceClearByStatus = normalizedRawStatus === 'available';
  const shouldClearOrder = shouldForceClearByStatus || !hasCurrentOrder || isClosedOrder || hasExplicitEmptyItems;
  const normalizedStatus = shouldClearOrder ? 'available' : 'occupied';

  return {
    ...table,
    status: normalizedStatus,
    current_order_id: shouldClearOrder ? null : normalizedCurrentOrderId,
    orders: shouldClearOrder ? null : (table.orders || null)
  };
}

export function isTableOccupied(status) {
  return normalizeTableStatus(status) === 'occupied';
}

export function isTableAvailable(status) {
  return normalizeTableStatus(status) === 'available';
}
