import { normalizeNumber } from '../../utils/normalization';
import type { MesaOrderItem } from './types';

export function getOrderItemName(item: MesaOrderItem): string {
  return item?.products?.name || item?.combos?.nombre || 'Item';
}

export function calculateOrderTotal(items: MesaOrderItem[]): number {
  return (Array.isArray(items) ? items : []).reduce(
    (sum, item) => sum + normalizeNumber(item.quantity, 0) * normalizeNumber(item.price, 0),
    0,
  );
}

export function sumOrderItemsQuantity(items: MesaOrderItem[]) {
  return (Array.isArray(items) ? items : []).reduce(
    (sum, item) => sum + Math.max(0, Number(item.quantity || 0)),
    0,
  );
}

export function normalizeOrderReference(value: unknown): string {
  return String(value || '').trim();
}

export function normalizeOrderItemQuantity(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
}

export function normalizeOrderItemSubtotal(row: Record<string, unknown>): number {
  const subtotal = Number(row?.subtotal);
  if (Number.isFinite(subtotal)) {
    return Math.max(0, subtotal);
  }
  const quantity = normalizeOrderItemQuantity(row?.quantity);
  const price = Number(row?.price);
  const safePrice = Number.isFinite(price) ? price : 0;
  return Math.max(0, quantity * safePrice);
}

export function reconcileOrderItemsFromServer(
  current: MesaOrderItem[],
  fromServer: MesaOrderItem[],
) {
  const local = Array.isArray(current) ? current : [];
  const server = Array.isArray(fromServer) ? fromServer : [];

  const serverById = new Map(server.map((item) => [String(item.id || ''), item]));
  const serverByIdentity = new Map<string, MesaOrderItem>();
  server.forEach((item) => {
    const key = item.product_id
      ? `p:${item.product_id}`
      : item.combo_id
        ? `c:${item.combo_id}`
        : '';
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

export function calculateCashChange(
  total: number,
  amountReceived: string | number | null | undefined,
) {
  const normalizedTotal = Math.round(normalizeNumber(total, 0));
  const raw = String(amountReceived ?? '')
    .trim()
    .replace(/\s|\$/g, '');
  const normalizedPaid = raw ? Number(raw.replace(/\./g, '').replace(',', '.')) : NaN;

  if (!Number.isFinite(normalizedPaid)) {
    return { isValid: false, change: 0, paid: 0, reason: 'invalid' as const };
  }
  if (normalizedPaid < normalizedTotal) {
    return { isValid: false, change: 0, paid: normalizedPaid, reason: 'insufficient' as const };
  }

  return {
    isValid: true,
    change: Math.round(normalizedPaid - normalizedTotal),
    paid: Math.round(normalizedPaid),
    reason: null,
  } as const;
}
