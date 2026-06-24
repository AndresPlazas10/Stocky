/**
 * Payment method types for Stocky POS
 */
export type PaymentMethod = 
  | 'cash' 
  | 'card' 
  | 'transfer' 
  | 'mixed' 
  | 'nequi' 
  | 'bancolombia' 
  | 'banco_bogota' 
  | 'nu' 
  | 'davivienda';

/**
 * All valid payment method values
 */
export const PAYMENT_METHODS: PaymentMethod[] = [
  'cash',
  'card',
  'transfer',
  'mixed',
  'nequi',
  'bancolombia',
  'banco_bogota',
  'nu',
  'davivienda'
];

/**
 * Spanish labels for payment methods
 */
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
  mixed: 'Mixto',
  nequi: 'Nequi',
  bancolombia: 'Bancolombia',
  banco_bogota: 'Banco de Bogotá',
  nu: 'Nu',
  davivienda: 'Davivienda'
};

/**
 * Bank-specific payment methods
 */
export const BANK_METHODS: PaymentMethod[] = [
  'nequi',
  'bancolombia',
  'banco_bogota',
  'nu',
  'davivienda'
];

const BANK_METHODS_SET = new Set(BANK_METHODS);

/**
 * Checks if a payment method is a bank-specific method
 * @param method - The payment method to check
 * @returns true if the method is a bank method
 */
export function isBankPaymentMethod(method: string | null | undefined): boolean {
  const key = String(method || '').trim().toLowerCase() as PaymentMethod;
  return BANK_METHODS_SET.has(key);
}

/**
 * Gets the Spanish label for a payment method
 * @param method - The payment method key
 * @param options - Optional configuration
 * @param options.withEmoji - If true, prepends emoji to the label
 * @returns The localized label or the original method string
 */
export function getPaymentMethodLabel(
  method: string | null | undefined,
  options?: { withEmoji?: boolean }
): string {
  const key = String(method || '').trim().toLowerCase() as PaymentMethod;
  const label = PAYMENT_METHOD_LABELS[key] || method || '-';
  
  if (options?.withEmoji) {
    const emojis: Record<PaymentMethod, string> = {
      cash: '💵',
      card: '💳',
      transfer: '🏦',
      mixed: '🔀',
      nequi: '📱',
      bancolombia: '🏦',
      banco_bogota: '🏦',
      nu: '💜',
      davivienda: '🏦'
    };
    return `${emojis[key] || ''} ${label}`;
  }
  
  return label;
}
