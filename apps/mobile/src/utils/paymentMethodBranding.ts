import type { ImageSourcePropType } from 'react-native';

const BANK_LOGOS: Record<string, ImageSourcePropType> = {
  nequi: require('../../assets/banks/Nequi_logo.png'),
  bancolombia: require('../../assets/banks/bancolombia_logo.png'),
  banco_bogota: require('../../assets/banks/banco_bogota_logo.png'),
  nu: require('../../assets/banks/nu_logo.jpg'),
  davivienda: require('../../assets/banks/davivienda_logo.png'),
};

export function normalizePaymentMethod(method: unknown): string {
  return String(method || '').trim().toLowerCase();
}

export function isBankPaymentMethod(method: unknown): boolean {
  return Object.prototype.hasOwnProperty.call(BANK_LOGOS, normalizePaymentMethod(method));
}

export function getBankLogoSource(method: unknown): ImageSourcePropType | null {
  const key = normalizePaymentMethod(method);
  return BANK_LOGOS[key] || null;
}
