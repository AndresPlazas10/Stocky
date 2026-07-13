import type Ionicons from '@expo/vector-icons/Ionicons';

type PaymentMethod =
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

const BANK_METHODS = new Set([
  'nequi',
  'bancolombia',
  'banco_bogota',
  'nu',
  'davivienda',
  'daviplata',
]);

function normalizeMethod(method: string | null | undefined): string {
  const value = String(method || '')
    .toLowerCase()
    .trim();
  if (value === 'efectivo') return 'cash';
  if (value === 'tarjeta') return 'card';
  if (value === 'transferencia') return 'transfer';
  if (value === 'mixto') return 'mixed';
  return value;
}

/**
 * @deprecated Use getPaymentMethodLabel with t function instead
 */
const LABELS: Record<string, string> = {
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
  zelle: 'Zelle',
};

const EMOJI: Record<string, string> = {
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
  zelle: '💎',
};

export function getPaymentMethodLabel(
  method: string | null | undefined,
  options?: { emoji?: boolean; t?: (key: string) => string },
): string {
  const normalized = normalizeMethod(method);
  const label = options?.t
    ? options.t(`paymentMethods.${normalized}`)
    : LABELS[normalized] || normalized || '-';

  if (options?.emoji) {
    return `${EMOJI[normalized] || ''} ${label}`;
  }

  return label;
}

export function getPaymentMethodTheme(method: string | null | undefined): {
  icon: keyof typeof Ionicons.glyphMap;
  backgroundColor: string;
  textColor: string;
  iconColor: string;
} {
  const normalized = normalizeMethod(method);
  if (normalized === 'card') {
    return {
      icon: 'card-outline',
      backgroundColor: '#DBEAFE',
      textColor: '#1D4ED8',
      iconColor: '#2563EB',
    };
  }
  if (normalized === 'transfer') {
    return {
      icon: 'swap-horizontal-outline',
      backgroundColor: '#E0E7FF',
      textColor: '#4338CA',
      iconColor: '#4F46E5',
    };
  }
  if (normalized === 'mixed') {
    return {
      icon: 'layers-outline',
      backgroundColor: '#F3E8FF',
      textColor: '#7E22CE',
      iconColor: '#9333EA',
    };
  }
  if (
    BANK_METHODS.has(normalized) ||
    ['spei', 'oxxo', 'yape', 'plin', 'mercadopago', 'venmo', 'cashapp', 'zelle'].includes(
      normalized,
    )
  ) {
    return {
      icon: 'business-outline',
      backgroundColor: '#F3E8FF',
      textColor: '#7E22CE',
      iconColor: '#9333EA',
    };
  }
  return {
    icon: 'cash-outline',
    backgroundColor: '#DCFCE7',
    textColor: '#166534',
    iconColor: '#16A34A',
  };
}

export function getPaymentMethodIcon(
  method: string | null | undefined,
): keyof typeof Ionicons.glyphMap {
  const normalized = normalizeMethod(method);
  if (normalized === 'card') return 'card-outline';
  if (normalized === 'transfer') return 'swap-horizontal-outline';
  if (normalized === 'mixed') return 'wallet-outline';
  if (
    BANK_METHODS.has(normalized) ||
    ['spei', 'oxxo', 'yape', 'plin', 'mercadopago', 'venmo', 'cashapp', 'zelle'].includes(
      normalized,
    )
  )
    return 'business-outline';
  if (normalized === 'cash') return 'cash-outline';
  return 'help-circle-outline';
}

export function isBankPaymentMethod(method: string | null | undefined): boolean {
  return BANK_METHODS.has(normalizeMethod(method));
}

export type { PaymentMethod };
