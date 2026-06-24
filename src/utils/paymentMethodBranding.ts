type PaymentMethodKey = 'cash' | 'card' | 'transfer' | 'mixed' | 'nequi' | 'bancolombia' | 'banco_bogota' | 'nu' | 'davivienda';

const PAYMENT_METHOD_LABELS: Record<PaymentMethodKey | string, string> = {
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

const BANK_LOGO_FILES: Record<string, string[]> = {
  nequi: ['Nequi_logo.png', 'nequi_logo.png', 'nequi.png', 'nequi-logo.png', 'nequi.svg'],
  bancolombia: ['bancolombia_logo.png', 'bancolombia.png', 'Bancolombia_logo.png', 'bancolombia-logo.png', 'bancolombia.svg'],
  banco_bogota: ['banco_bogota_logo.png', 'banco-bogota.png', 'banco_bogota.png', 'BancoBogota_logo.png', 'banco-bogota.svg'],
  nu: ['nu_logo.jpg', 'nu_logo.png', 'nu.png', 'Nu_logo.png', 'nu-logo.png', 'nu.svg'],
  davivienda: ['davivienda_logo.png', 'davivienda.png', 'Davivienda_logo.png', 'davivienda-logo.png', 'davivienda.svg']
};

const withBaseUrl = (assetPath: string): string => {
  const baseUrl = String(import.meta.env.BASE_URL || '/');
  const normalizedBase = `${baseUrl.replace(/\/+$/, '')}/`;
  const normalizedAsset = String(assetPath || '').replace(/^\/+/, '');
  return `${normalizedBase}${normalizedAsset}`;
};

export const isBankPaymentMethod = (method: string | null | undefined): boolean => Object.prototype.hasOwnProperty.call(
  BANK_LOGO_FILES,
  String(method || '').trim().toLowerCase()
);

export const getPaymentMethodLogoCandidates = (method: string | null | undefined): string[] => {
  const key = String(method || '').trim().toLowerCase();
  const files = BANK_LOGO_FILES[key] || [];
  return files.map((fileName) => withBaseUrl(`/branding/banks/${fileName}`));
};

export const getPaymentMethodLogoPath = (method: string | null | undefined): string | null => {
  const candidates = getPaymentMethodLogoCandidates(method);
  return candidates.length > 0 ? candidates[0] : null;
};

export const getPaymentMethodLabel = (method: string | null | undefined): string => {
  const key = String(method || '').trim().toLowerCase();
  return PAYMENT_METHOD_LABELS[key] || method || '-';
};
