import type { ImageSourcePropType } from 'react-native';

const BANK_LOGOS: Record<string, ImageSourcePropType> = {
  // Colombia
  nequi: require('../../assets/banks/Nequi_logo.png'),
  bancolombia: require('../../assets/banks/bancolombia_logo.png'),
  banco_bogota: require('../../assets/banks/banco_bogota_logo.png'),
  nu: require('../../assets/banks/nu_logo.jpg'),
  davivienda: require('../../assets/banks/davivienda_logo.png'),
  daviplata: require('../../assets/banks/daviplata_logo.png'),
  // México
  spei: require('../../assets/banks/spei_logo.png'),
  oxxo: require('../../assets/banks/oxxo_logo.png'),
  // Perú
  yape: require('../../assets/banks/yape_logo.jpg'),
  plin: require('../../assets/banks/plin_logo.png'),
  // Argentina
  mercadopago: require('../../assets/banks/mercadopago_logo.png'),
  // USA
  venmo: require('../../assets/banks/venmo_logo.png'),
  cashapp: require('../../assets/banks/cashapp_logo.png'),
  zelle: require('../../assets/banks/zelle_logo.png'),
};

const BASIC_METHODS = new Set(['cash', 'card', 'transfer', 'mixed']);

export function normalizePaymentMethod(method: unknown): string {
  return String(method || '')
    .trim()
    .toLowerCase();
}

export function isBankPaymentMethod(method: unknown): boolean {
  const normalized = normalizePaymentMethod(method);
  return !BASIC_METHODS.has(normalized);
}

export function getBankLogoSource(method: unknown): ImageSourcePropType | null {
  const key = normalizePaymentMethod(method);
  return BANK_LOGOS[key] || null;
}
