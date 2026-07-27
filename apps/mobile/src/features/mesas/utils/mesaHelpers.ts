import type { Session } from '@supabase/supabase-js';
import type { MesaOrderCatalogItem, MesaOrderItem } from '../../../services/mesaOrderService';
import type { MesaRecord, MesaEditLock } from '../../../services/mesasService';
import type { PaymentMethod } from '../../../services/mesaCheckoutService';
import {
  isMesaOccupied as isMesaOccupiedShared,
  normalizeTableIdentifier as normalizeTableIdentifierShared,
  compareMesaTableIdentifiers as compareMesaTableIdentifiersShared,
  resolveMesaSyncVersion as resolveMesaSyncVersionShared,
  mesaDisplayName as mesaDisplayNameShared,
} from '@stocky/shared/mesa-utils';
import {
  normalizeOrderReference as normalizeOrderReferenceShared,
  normalizeOrderItemQuantity as normalizeOrderItemQuantityShared,
  normalizeOrderItemSubtotal as normalizeOrderItemSubtotalShared,
  sumOrderItemsQuantity as sumOrderItemsQuantityShared,
} from '@stocky/shared/order-normalization';
import { reconcileOrderItemsFromServer as reconcileOrderItemsFromServerShared } from '@stocky/shared/order-reconciliation';

export const MESA_IN_USE_MESSAGE = 'Alguien esta usando esta mesa.';

/**
 * Merges server-returned locks with existing lock state, preserving
 * pending/broadcast locks that haven't expired yet.
 *
 * @param prevLocks - Current lock state map
 * @param serverLocks - Locks returned from the server
 * @param options.preservePendingPrefix - If true, also preserve 'pending-' prefixed tokens (edit lock behavior).
 *   If false (default), only 'broadcast-' prefixed tokens are preserved (realtime behavior).
 */
export function mergeMesaLocks(
  prevLocks: Record<string, MesaEditLock>,
  serverLocks: MesaEditLock[],
  options?: { preservePendingPrefix?: boolean },
): Record<string, MesaEditLock> {
  const next: Record<string, MesaEditLock> = {};
  (Array.isArray(serverLocks) ? serverLocks : []).forEach((lock) => {
    const tableId = String(lock?.table_id || '').trim();
    if (!tableId) return;
    next[tableId] = lock;
  });

  if (!prevLocks || Object.keys(prevLocks).length === 0) return next;

  const nowMs = Date.now();
  const preservePending = options?.preservePendingPrefix === true;

  Object.entries(prevLocks).forEach(([tableId, lock]) => {
    if (next[tableId]) return;
    const token = String(lock?.lock_token || '').trim();
    const expiresAtMs = Date.parse(String(lock?.lock_expires_at || '').trim());
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= nowMs) return;
    const isPending = preservePending
      ? token.startsWith('pending-') || token.startsWith('broadcast-')
      : token.startsWith('broadcast-');
    const updatedAtMs = Date.parse(String(lock?.updated_at || '').trim());
    const isFresh = Number.isFinite(updatedAtMs) && nowMs - updatedAtMs <= 4000;
    if (isPending || isFresh) {
      next[tableId] = lock;
    }
  });

  return next;
}

/**
 * Creates a refresher function that fetches active locks from the server
 * and merges them into the provided setter using mergeMesaLocks.
 */
export function createMesaLocksRefresher(
  setLocks: React.Dispatch<React.SetStateAction<Record<string, MesaEditLock>>>,
  fetchLocks: (businessId: string) => Promise<MesaEditLock[]>,
  options?: { preservePendingPrefix?: boolean },
): (businessId: string) => Promise<void> {
  return async (businessId: string) => {
    const normalizedBusinessId = String(businessId || '').trim();
    if (!normalizedBusinessId) {
      setLocks({});
      return;
    }
    try {
      const locks = await fetchLocks(normalizedBusinessId);
      setLocks((prev) => mergeMesaLocks(prev, locks, options));
    } catch {
      // no-op: don't block main flow for lock failures
    }
  };
}

/**
 * Setters required by the modal reset utilities.
 * Matches the setter shape from useMesaOrderState.
 */
type ModalResetSetters = {
  setShowOrderModal: (v: boolean) => void;
  setShowCloseOrderChoiceModal: (v: boolean) => void;
  setShowPaymentModal: (v: boolean) => void;
  setShowSplitBillModal: (v: boolean) => void;
  setSelectedMesa: (v: null) => void;
  setOrderItems: (v: never[]) => void;
  setOrderModalError: (v: null) => void;
  setSearchCatalog: (v: string) => void;
  setIsSearchFocused: (v: boolean) => void;
  setMutatingOrderItemId: (v: null) => void;
  setPaymentMethod: (v: PaymentMethod) => void;
  setAmountReceived: (v: string) => void;
};

/**
 * Resets auxiliary modals (payment, split bill, close choice)
 * and payment state. Does NOT close the main order modal.
 */
export function resetAuxiliaryModals(s: ModalResetSetters) {
  s.setShowCloseOrderChoiceModal(false);
  s.setShowPaymentModal(false);
  s.setShowSplitBillModal(false);
  s.setPaymentMethod('cash');
  s.setAmountReceived('');
}

/**
 * Resets the entire order flow: closes order modal, clears selection,
 * resets search and error state. Also resets auxiliary modals.
 */
export function resetOrderFlow(s: ModalResetSetters) {
  resetAuxiliaryModals(s);
  s.setShowOrderModal(false);
  s.setSelectedMesa(null);
  s.setOrderItems([]);
  s.setOrderModalError(null);
  s.setSearchCatalog('');
  s.setIsSearchFocused(false);
  s.setMutatingOrderItemId(null);
}

const DENOMINATIONS_BY_COUNTRY: Record<string, number[]> = {
  CO: [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50],
  EC: [100, 50, 20, 10, 5, 1],
  PE: [200, 100, 50, 20, 10, 5, 2, 1],
  MX: [1000, 500, 200, 100, 50, 20, 10, 5, 2, 1],
  AR: [10000, 5000, 2000, 1000, 500, 200, 100, 50, 10],
  US: [100, 50, 20, 10, 5, 1],
};

export function getDenominationsForCountry(countryCode: string): number[] {
  return DENOMINATIONS_BY_COUNTRY[countryCode] || DENOMINATIONS_BY_COUNTRY.CO;
}

export const isMesaOccupied = isMesaOccupiedShared;
export const normalizeTableIdentifier = normalizeTableIdentifierShared;
export const compareMesaTableIdentifiers = compareMesaTableIdentifiersShared;
export const resolveMesaSyncVersion = resolveMesaSyncVersionShared;
export const mesaDisplayName = mesaDisplayNameShared;
export const normalizeOrderReference = normalizeOrderReferenceShared;
export const normalizeOrderItemQuantity = normalizeOrderItemQuantityShared;
export const normalizeOrderItemSubtotal = normalizeOrderItemSubtotalShared;
export const sumOrderItemsQuantity = sumOrderItemsQuantityShared;
export const reconcileOrderItemsFromServer = reconcileOrderItemsFromServerShared;

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

export function buildCashBreakdown(change: number, denominations?: number[]) {
  const denoms = denominations || DENOMINATIONS_BY_COUNTRY.CO;
  let remaining = Math.round(Number(change || 0));
  const breakdown: { denomination: number; count: number }[] = [];

  for (const denomination of denoms) {
    const count = Math.floor(remaining / denomination);
    if (count > 0) {
      breakdown.push({ denomination, count });
      remaining -= count * denomination;
    }
  }

  return breakdown;
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

function normalizeOrderReferenceLocal(value: string | null | undefined): string | null {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw || raw === 'null' || raw === 'undefined') return null;
  return String(value).trim();
}

/** Aligns mobile mesa state with web normalizeTableRecord rules for empty/closed orders. */
export function normalizeMesaRecord(mesa: MesaRecord): MesaRecord {
  if (!mesa || typeof mesa !== 'object') return mesa;

  const normalizedCurrentOrderId = normalizeOrderReferenceLocal(mesa.current_order_id);
  const normalizedOrderStatus = String(mesa?.orders?.status || '')
    .trim()
    .toLowerCase();
  const rawStatus = String(mesa.status || '')
    .trim()
    .toLowerCase();
  const normalizedRawStatus =
    rawStatus === 'open' ? 'occupied' : rawStatus === 'closed' ? 'available' : rawStatus || 'available';
  const isClosedOrder =
    normalizedOrderStatus === 'closed' || normalizedOrderStatus === 'cancelled';
  const hasCurrentOrder = Boolean(normalizedCurrentOrderId);
  const shouldForceClearByStatus = normalizedRawStatus === 'available' && !hasCurrentOrder;
  const shouldClearOrder = shouldForceClearByStatus || !hasCurrentOrder || isClosedOrder;

  return {
    ...mesa,
    status: shouldClearOrder ? 'available' : 'occupied',
    current_order_id: shouldClearOrder ? null : normalizedCurrentOrderId,
    orders: shouldClearOrder ? null : mesa.orders || null,
  };
}

export function buildAvailableMesaRecord(
  mesa: Partial<MesaRecord> & { id: string },
  syncVersion?: number,
): MesaRecord {
  return normalizeMesaRecord({
    id: mesa.id,
    business_id: String(mesa.business_id || ''),
    table_number: mesa.table_number ?? null,
    table_name: mesa.table_name ?? null,
    status: 'available',
    current_order_id: null,
    orders: null,
    sync_version:
      syncVersion !== undefined ? syncVersion : resolveMesaSyncVersion(mesa as MesaRecord),
  });
}
