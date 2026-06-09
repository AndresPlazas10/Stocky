import type { MesaOrderItem } from '../../../services/mesaOrderService';
import type { PaymentMethod, SplitSubAccount } from '../../../services/mesaCheckoutService';

export const MAX_SUB_ACCOUNTS = 10;
export const COLOMBIAN_DENOMINATIONS = [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50];

export const PAYMENT_OPTIONS: Array<{ value: PaymentMethod; label: string }> = [
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
  if (['nequi', 'bancolombia', 'banco_bogota', 'nu', 'davivienda'].includes(method)) return 'business-outline';
  return 'help-circle-outline';
}

export function getPaymentOptionLabel(method: PaymentMethod): string {
  return PAYMENT_OPTIONS.find((option) => option.value === method)?.label || 'Seleccionar';
}

export function formatCopAmount(value: number): string {
  return `$ ${new Intl.NumberFormat('es-CO').format(Math.max(0, Math.round(Number(value) || 0)))}`;
}

export function parseCopAmount(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return NaN;
  if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value) : NaN;

  const raw = String(value).trim().replace(/\s/g, '').replace(/\$/g, '');
  if (!raw) return NaN;

  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(raw)) {
    const parsed = Number(raw.replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(parsed) ? Math.round(parsed) : NaN;
  }

  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(raw)) {
    const parsed = Number(raw.replace(/,/g, ''));
    return Number.isFinite(parsed) ? Math.round(parsed) : NaN;
  }

  const simpleParsed = Number(raw.replace(',', '.'));
  if (Number.isFinite(simpleParsed)) return Math.round(simpleParsed);

  const digitsOnly = raw.replace(/[^\d]/g, '');
  if (!digitsOnly) return NaN;
  const digitsParsed = Number(digitsOnly);
  return Number.isFinite(digitsParsed) ? Math.round(digitsParsed) : NaN;
}

export function calculateCashChange(total: number, paidValue: string | number | null | undefined) {
  const normalizedTotal = Math.round(Number(total) || 0);
  const normalizedPaid = parseCopAmount(paidValue);

  if (normalizedTotal <= 0 || !Number.isFinite(normalizedPaid) || normalizedPaid < normalizedTotal) {
    return { isValid: false, change: 0, breakdown: [], paid: null as number | null };
  }

  let remaining = normalizedPaid - normalizedTotal;
  const breakdown: Array<{ denomination: number; count: number }> = [];
  for (const denomination of COLOMBIAN_DENOMINATIONS) {
    const count = Math.floor(remaining / denomination);
    if (count > 0) {
      breakdown.push({ denomination, count });
      remaining -= count * denomination;
    }
  }

  return {
    isValid: true,
    change: normalizedPaid - normalizedTotal,
    breakdown,
    paid: normalizedPaid,
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
): Array<AccountState & { items: SplitSubAccount['items']; total: number; cashInfo: ReturnType<typeof calculateCashChange> }> {
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

    const total = items.reduce((sum: number, item: any) => sum + (Number(item.quantity || 0) * Number(item.unit_price || 0)), 0);
    const roundedTotal = Math.round(total);
    const cashInput = account.amountReceived === '' ? String(roundedTotal) : account.amountReceived;
    const cashInfo = account.paymentMethod === 'cash'
      ? calculateCashChange(roundedTotal, cashInput)
      : { isValid: true, change: 0, breakdown: [], paid: null as number | null };

    return {
      ...account,
      items,
      total: roundedTotal,
      cashInfo,
    };
  });
}
