import type { Session } from '@supabase/supabase-js';
import type { MesaOrderCatalogItem, MesaOrderItem } from '../../../services/mesaOrderService';
import type { MesaRecord } from '../../../services/mesasService';
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
