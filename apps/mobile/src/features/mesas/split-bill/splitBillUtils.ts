import type { MesaOrderItem } from '../../../services/mesaOrderService';
import { calculateCashChange as validateCashPayment } from '../../../services/mesaOrderService';
import type { PaymentMethod, SplitSubAccount } from '../../../services/mesaCheckoutService';
import { getDenominationsForCountry } from '../utils/mesaHelpers';

export const MAX_SUB_ACCOUNTS = 10;

export type AccountState = {
  id: number;
  name: string;
  paymentMethod: PaymentMethod;
  amountReceived: string;
};

export type ItemAssignments = Record<string, Record<number, number>>;

export function getPaymentOptionIcon(method: PaymentMethod): string {
  if (method === 'cash') return 'cash-outline';
  if (method === 'card') return 'card-outline';
  if (method === 'transfer') return 'swap-horizontal-outline';
  if (method === 'mixed') return 'wallet-outline';
  return 'business-outline';
}

export function getPaymentOptionLabel(method: PaymentMethod, t?: (key: string) => string): string {
  if (t) {
    return t(`paymentMethods.${method}`);
  }
  const labels: Record<string, string> = {
    cash: 'Efectivo',
    card: 'Tarjeta',
    transfer: 'Transferencia',
    mixed: 'Mixto',
  };
  return labels[method] || method;
}

export function calculateCashChange(
  total: number,
  paidValue: string | number | null | undefined,
  countryCode?: string,
) {
  const validation = validateCashPayment(total, paidValue);
  if (!validation.isValid) {
    return { isValid: false, change: 0, breakdown: [], paid: null as number | null };
  }

  const change = validation.change;
  const denominations = getDenominationsForCountry(countryCode || 'CO');
  let remaining = change;
  const breakdown: { denomination: number; count: number }[] = [];
  for (const denomination of denominations) {
    const count = Math.floor(remaining / denomination);
    if (count > 0) {
      breakdown.push({ denomination, count });
      remaining -= count * denomination;
    }
  }

  return {
    isValid: true,
    change,
    breakdown,
    paid: validation.paid,
  };
}

export function getInitialAssignments(orderItems: MesaOrderItem[]): ItemAssignments {
  const initial: ItemAssignments = {};
  orderItems.forEach((item) => {
    initial[item.id] = {};
  });
  return initial;
}

export function createInitialAccount(): AccountState {
  return { id: 1, name: 'Cuenta 1', paymentMethod: 'cash', amountReceived: '' };
}

export function createSubAccounts(
  accounts: AccountState[],
  orderItems: MesaOrderItem[],
  itemAssignments: ItemAssignments,
  countryCode?: string,
): (AccountState & {
  items: SplitSubAccount['items'];
  total: number;
  cashInfo: ReturnType<typeof calculateCashChange>;
})[] {
  return accounts.map((account) => {
    const items: SplitSubAccount['items'] = [];
    orderItems.forEach((item) => {
      const byAccount = itemAssignments[item.id] || {};
      const qty = Number(byAccount[account.id] || 0);
      if (qty <= 0) return;
      items.push({
        product_id: item.product_id,
        combo_id: item.combo_id,
        quantity: qty,
        price: Number(item.price || 0),
        unit_price: Number(item.price || 0),
      });
    });

    const total = items.reduce(
      (sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0),
      0,
    );
    const roundedTotal = Math.round(total);
    const cashInput = account.amountReceived === '' ? String(roundedTotal) : account.amountReceived;
    const cashInfo =
      account.paymentMethod === 'cash'
        ? calculateCashChange(roundedTotal, cashInput, countryCode)
        : { isValid: true, change: 0, breakdown: [], paid: null as number | null };

    return {
      ...account,
      items,
      total: roundedTotal,
      cashInfo,
    };
  });
}
