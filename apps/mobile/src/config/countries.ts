export interface CountryConfig {
  code: string;
  name: string;
  flag: string;
  locale: string;
  language: string;
  timezone: string;
  currency: {
    code: string;
    symbol: string;
    decimals: number;
  };
  taxId: {
    name: string;
    placeholder: string;
  };
  phonePlaceholder: string;
  taxRate: number;
  paymentMethods: string[];
}

export const COUNTRIES: Record<string, CountryConfig> = {
  CO: {
    code: 'CO',
    name: 'Colombia',
    flag: '🇨🇴',
    locale: 'es-CO',
    language: 'es',
    timezone: 'America/Bogota',
    currency: { code: 'COP', symbol: '$', decimals: 0 },
    taxId: { name: 'NIT', placeholder: '900.123.456-7' },
    phonePlaceholder: '+57 300 123 4567',
    taxRate: 19,
    paymentMethods: [
      'cash',
      'card',
      'transfer',
      'nequi',
      'bancolombia',
      'banco_bogota',
      'nu',
      'davivienda',
      'daviplata',
    ],
  },
  EC: {
    code: 'EC',
    name: 'Ecuador',
    flag: '🇪🇨',
    locale: 'es-EC',
    language: 'es',
    timezone: 'America/Guayaquil',
    currency: { code: 'USD', symbol: '$', decimals: 2 },
    taxId: { name: 'RUC', placeholder: '1234567890001' },
    phonePlaceholder: '+593 99 123 4567',
    taxRate: 15,
    paymentMethods: ['cash', 'card', 'transfer'],
  },
  PE: {
    code: 'PE',
    name: 'Perú',
    flag: '🇵🇪',
    locale: 'es-PE',
    language: 'es',
    timezone: 'America/Lima',
    currency: { code: 'PEN', symbol: 'S/', decimals: 2 },
    taxId: { name: 'RUC', placeholder: '20123456789' },
    phonePlaceholder: '+51 999 123 456',
    taxRate: 18,
    paymentMethods: ['cash', 'card', 'transfer', 'yape', 'plin'],
  },
  MX: {
    code: 'MX',
    name: 'México',
    flag: '🇲🇽',
    locale: 'es-MX',
    language: 'es',
    timezone: 'America/Mexico_City',
    currency: { code: 'MXN', symbol: '$', decimals: 2 },
    taxId: { name: 'RFC', placeholder: 'XAXX010101000' },
    phonePlaceholder: '+52 55 1234 5678',
    taxRate: 16,
    paymentMethods: ['cash', 'card', 'transfer', 'spei', 'oxxo'],
  },
  AR: {
    code: 'AR',
    name: 'Argentina',
    flag: '🇦🇷',
    locale: 'es-AR',
    language: 'es',
    timezone: 'America/Argentina/Buenos_Aires',
    currency: { code: 'ARS', symbol: '$', decimals: 2 },
    taxId: { name: 'CUIT', placeholder: '20-12345678-9' },
    phonePlaceholder: '+54 9 11 1234 5678',
    taxRate: 21,
    paymentMethods: ['cash', 'card', 'transfer', 'mercadopago'],
  },
  US: {
    code: 'US',
    name: 'Estados Unidos',
    flag: '🇺🇸',
    locale: 'en-US',
    language: 'en',
    timezone: 'America/New_York',
    currency: { code: 'USD', symbol: '$', decimals: 2 },
    taxId: { name: 'EIN', placeholder: '12-3456789' },
    phonePlaceholder: '+1 (555) 123-4567',
    taxRate: 0,
    paymentMethods: ['cash', 'card', 'venmo', 'cashapp', 'zelle'],
  },
};

export const DEFAULT_COUNTRY = 'CO';

export const getCountryConfig = (code: string): CountryConfig => {
  return COUNTRIES[code] || COUNTRIES[DEFAULT_COUNTRY];
};

export const getCountryList = (): CountryConfig[] => {
  return Object.values(COUNTRIES);
};
