import type { Session } from '@supabase/supabase-js';
import type { PaymentMethod } from '../../../services/mesaCheckoutService';
import type { MesaOrderCatalogItem, MesaOrderItem } from '../../../services/mesaOrderService';
import type { MesaRecord } from '../../../services/mesasService';

export const MESA_IN_USE_MESSAGE = 'Alguien esta usando esta mesa.';

export const COLOMBIAN_DENOMINATIONS = [
  100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50,
];

export const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
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

export function isMesaOccupied(status: string | null | undefined) {
  return (
    String(status || '')
      .trim()
      .toLowerCase() === 'occupied'
  );
}

export function normalizeTableIdentifier(value: string | number | null | undefined) {
  return String(value ?? '').trim();
}

export function compareMesaTableIdentifiers(left: MesaRecord, right: MesaRecord) {
  const leftId = normalizeTableIdentifier(left?.table_number ?? left?.name ?? left?.id);
  const rightId = normalizeTableIdentifier(right?.table_number ?? right?.name ?? right?.id);

  return leftId.localeCompare(rightId, 'es', {
    numeric: true,
    sensitivity: 'base',
  });
}

export function resolveMesaSyncVersion(mesa: Partial<MesaRecord> | null | undefined): number {
  const raw = Number(mesa?.sync_version);
  if (!Number.isFinite(raw)) return 0;
  return Math.max(0, Math.floor(raw));
}

export function mesaDisplayName(mesa: MesaRecord): string {
  if (mesa.name && String(mesa.name).trim()) return String(mesa.name).trim();
  if (
    mesa.table_number !== null &&
    mesa.table_number !== undefined &&
    String(mesa.table_number).trim()
  ) {
    return `Mesa ${String(mesa.table_number).trim()}`;
  }
  return `Mesa ${mesa.id.slice(0, 6)}`;
}

export function resolveSessionDisplayName(session: Session): string {
  const metadata =
    session?.user?.user_metadata && typeof session.user.user_metadata === 'object'
      ? (session.user.user_metadata as Record<string, unknown>)
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

export function buildCashBreakdown(change: number) {
  let remaining = Math.round(Number(change || 0));
  const breakdown: { denomination: number; count: number }[] = [];

  for (const denomination of COLOMBIAN_DENOMINATIONS) {
    const count = Math.floor(remaining / denomination);
    if (count > 0) {
      breakdown.push({ denomination, count });
      remaining -= count * denomination;
    }
  }

  return breakdown;
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

export function formatCatalogItemMeta(item: MesaOrderCatalogItem) {
  const code = item.code ? `${item.code} · ` : '';
  if (item.item_type === 'combo') {
    const parts = Array.isArray(item.combo_items) ? item.combo_items.length : 0;
    return `${code}Combo (${parts} items)`;
  }

  return `${code}${item.manage_stock ? `Stock ${item.stock}` : 'Sin control de stock'}`;
}

export function isSameOrderItemIdentity(left: MesaOrderItem, right: MesaOrderItem) {
  const leftProduct = String(left.product_id || '');
  const rightProduct = String(right.product_id || '');
  const leftCombo = String(left.combo_id || '');
  const rightCombo = String(right.combo_id || '');

  if (leftProduct && rightProduct) return leftProduct === rightProduct;
  if (leftCombo && rightCombo) return leftCombo === rightCombo;
  return false;
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
