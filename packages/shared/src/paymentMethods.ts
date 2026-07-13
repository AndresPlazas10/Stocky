/**
 * Payment method types for Stocky POS
 */
export type PaymentMethod =
  | 'cash'
  | 'card'
  | 'transfer'
  | 'mixed'
  // Colombia
  | 'nequi'
  | 'bancolombia'
  | 'banco_bogota'
  | 'nu'
  | 'davivienda'
  | 'daviplata'
  // México
  | 'spei'
  | 'oxxo'
  // Perú
  | 'yape'
  | 'plin'
  // Argentina
  | 'mercadopago'
  // USA
  | 'venmo'
  | 'cashapp'
  | 'zelle';

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
  'davivienda',
  'daviplata',
  'spei',
  'oxxo',
  'yape',
  'plin',
  'mercadopago',
  'venmo',
  'cashapp',
  'zelle'
];

/**
 * Labels for payment methods (Spanish)
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
  davivienda: 'Davivienda',
  daviplata: 'Daviplata',
  spei: 'SPEI',
  oxxo: 'OXXO',
  yape: 'Yape',
  plin: 'Plin',
  mercadopago: 'Mercado Pago',
  venmo: 'Venmo',
  cashapp: 'Cash App',
  zelle: 'Zelle'
};

/**
 * Bank-specific payment methods
 */
export const BANK_METHODS: PaymentMethod[] = [
  'nequi',
  'bancolombia',
  'banco_bogota',
  'nu',
  'davivienda',
  'daviplata'
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
      davivienda: '🏦',
      daviplata: '📱',
      spei: '🏦',
      oxxo: '🏪',
      yape: '📱',
      plin: '📱',
      mercadopago: '💳',
      venmo: '💙',
      cashapp: '💚',
      zelle: '💎'
    };
    return `${emojis[key] || ''} ${label}`;
  }
  
  return label;
}
