import type { Table, TableStatus } from '../types/order';

function normalizeOrderStatus(status: string | null | undefined): string | null {
  const raw = String(status || '').trim().toLowerCase();
  if (!raw) return null;
  return raw;
}

function normalizeOrderReference(value: string | null | undefined): string | null {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw || raw === 'null' || raw === 'undefined') return null;
  return String(value).trim();
}

export function normalizeTableStatus(status: string | null | undefined): TableStatus {
  const raw = String(status || '').trim().toLowerCase();
  if (raw === 'open') return 'occupied';
  if (raw === 'closed') return 'available';
  if (raw === 'occupied' || raw === 'available') return raw as TableStatus;
  return 'available';
}

export function normalizeTableRecord(table: Table): Table {
  if (!table || typeof table !== 'object') return table;

  const normalizedCurrentOrderId = normalizeOrderReference(table.current_order_id);
  const normalizedOrderStatus = normalizeOrderStatus(table?.orders?.status);
  const normalizedRawStatus = normalizeTableStatus(table.status);
  const isClosedOrder =
    normalizedOrderStatus === 'closed'
    || normalizedOrderStatus === 'cancelled';
  const hasCurrentOrder = Boolean(normalizedCurrentOrderId);
  // Regla de seguridad offline: si la mesa ya está marcada como disponible,
  // nunca preservar punteros/ordenes antiguas del snapshot local.
  // PERO: si hay un current_order_id válido, confiar en él (estado transitorio de realtime).
  const shouldForceClearByStatus = normalizedRawStatus === 'available' && !hasCurrentOrder;
  // No limpiar por `order_items` vacío: en producción puede llegar vacío de forma transitoria.
  const shouldClearOrder = shouldForceClearByStatus || !hasCurrentOrder || isClosedOrder;
  const normalizedStatus = shouldClearOrder ? 'available' : 'occupied';

  return {
    ...table,
    status: normalizedStatus,
    current_order_id: shouldClearOrder ? null : normalizedCurrentOrderId,
    orders: shouldClearOrder ? null : (table.orders || null)
  };
}

export function isTableOccupied(status: string | null | undefined): boolean {
  return normalizeTableStatus(status) === 'occupied';
}

export function isTableAvailable(status: string | null | undefined): boolean {
  return normalizeTableStatus(status) === 'available';
}
