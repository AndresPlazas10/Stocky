import type { Ionicons } from '@expo/vector-icons';

type PaymentMethod =
  | 'cash'
  | 'card'
  | 'transfer'
  | 'mixed'
  | 'nequi'
  | 'bancolombia'
  | 'banco_bogota'
  | 'nu'
  | 'davivienda';

const BANK_METHODS = new Set(['nequi', 'bancolombia', 'banco_bogota', 'nu', 'davivienda']);

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

export function getPaymentMethodLabel(
  method: string | null | undefined,
  options?: { emoji?: boolean },
): string {
  const normalized = normalizeMethod(method);
  if (normalized === 'cash') return options?.emoji ? '💵 Efectivo' : 'Efectivo';
  if (normalized === 'card') return options?.emoji ? '💳 Tarjeta' : 'Tarjeta';
  if (normalized === 'transfer') return options?.emoji ? '🏦 Transferencia' : 'Transferencia';
  if (normalized === 'mixed') return options?.emoji ? '🔀 Mixto' : 'Mixto';
  if (normalized === 'nequi') return options?.emoji ? '🏦 Nequi' : 'Nequi';
  if (normalized === 'bancolombia') return options?.emoji ? '🏦 Bancolombia' : 'Bancolombia';
  if (normalized === 'banco_bogota')
    return options?.emoji ? '🏦 Banco de Bogotá' : 'Banco de Bogotá';
  if (normalized === 'nu') return options?.emoji ? '🏦 Nu' : 'Nu';
  if (normalized === 'davivienda') return options?.emoji ? '🏦 Davivienda' : 'Davivienda';
  return String(method || (options?.emoji ? 'No especificado' : '-'));
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
  if (BANK_METHODS.has(normalized)) {
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
  if (BANK_METHODS.has(normalized)) return 'business-outline';
  if (normalized === 'cash') return 'cash-outline';
  return 'help-circle-outline';
}

export function isBankPaymentMethod(method: string | null | undefined): boolean {
  return BANK_METHODS.has(normalizeMethod(method));
}

export type { PaymentMethod };
