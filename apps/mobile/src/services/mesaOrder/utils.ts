import { normalizeNumber } from '../../utils/normalization';
import type { MesaOrderItem } from './types';

// Helpers de normalización/cálculo consolidados en @stocky/shared:
// el cálculo de total usa subtotal cuando está disponible (consistente con la web).
export {
  calculateOrderTotal,
  sumOrderItemsQuantity,
  normalizeOrderReference,
  normalizeOrderItemQuantity,
  normalizeOrderItemSubtotal,
} from '@stocky/shared/order-normalization';

export { reconcileOrderItemsFromServer } from '@stocky/shared/order-reconciliation';

export function getOrderItemName(item: MesaOrderItem): string {
  return item?.products?.name || item?.combos?.nombre || 'Item';
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
