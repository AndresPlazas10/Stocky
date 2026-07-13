export interface PriceFormatConfig {
  locale?: string;
  currency?: string;
  currencySymbol?: string;
  decimals?: number;
}

export interface DateFormatConfig {
  timezone?: string;
  locale?: string;
}

function getDateFallbacks(locale?: string) {
  const isEnglish = (locale || '').startsWith('en');
  return {
    noDate: isEnglish ? 'No date' : 'Sin fecha',
    invalidFormat: isEnglish ? 'Invalid format' : 'Formato inválido',
    invalidDate: isEnglish ? 'Invalid date' : 'Fecha inválida',
    invalidTime: isEnglish ? 'Invalid time' : 'Hora inválida',
    formatError: isEnglish ? 'Format error' : 'Error de formato',
  };
}

const DEFAULT_PRICE_CONFIG: Required<PriceFormatConfig> = {
  locale: 'es-CO',
  currency: 'COP',
  currencySymbol: '$',
  decimals: 0,
};

const DEFAULT_DATE_CONFIG: Required<DateFormatConfig> = {
  timezone: 'America/Bogota',
  locale: 'es-CO',
};

/**
 * Formatea un número como precio usando Intl.NumberFormat
 * Soporta multi-moneda y multi-locale
 * Ejemplo CO: $1'200.000 COP
 * Ejemplo MX: $1,200,000.00 MXN
 * Ejemplo US: $1,200,000.00 USD
 */
export const formatPrice = (
  value: number | null | undefined,
  includeCurrency: boolean = true,
  config?: PriceFormatConfig
): string => {
  const cfg = { ...DEFAULT_PRICE_CONFIG, ...config };

  if (value === null || value === undefined || isNaN(value)) {
    return includeCurrency ? `${cfg.currencySymbol}0 ${cfg.currency}`.trim() : '0';
  }

  const numValue = Number(value);

  try {
    const formatted = new Intl.NumberFormat(cfg.locale, {
      style: includeCurrency ? 'currency' : 'decimal',
      currency: cfg.currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(numValue);

    if (includeCurrency) {
      return `${formatted} ${cfg.currency}`;
    }
    return formatted;
  } catch {
    return `${cfg.currencySymbol}${numValue.toFixed(0)}${includeCurrency ? ` ${cfg.currency}` : ''}`;
  }
};

/**
 * Formatea un número sin símbolo de moneda
 */
export const formatNumber = (
  value: number | null | undefined,
  config?: PriceFormatConfig
): string => {
  return formatPrice(value, false, config);
};

/**
 * Convierte entradas de precio comunes en número.
 * Soporta:
 * - Miles con punto: "5.000" -> 5000
 * - Miles con coma: "5,000" -> 5000
 * - Formato es-CO: "1.500,50" -> 1500.5
 * - Formato en-US: "1500.50" -> 1500.5
 */
export const parsePriceInput = (value: string | number | null | undefined, fallback: number = 0): number => {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;

  const raw = String(value)
    .trim()
    .replace(/\s/g, '')
    .replace(/COP|USD|MXN|PEN|ARS|EUR/gi, '')
    .replace(/\$/g, '')
    .replace(/S\//g, '')
    .replace(/€/g, '')
    .replace(/'/g, '');

  if (!raw) return fallback;

  const hasDot = raw.includes('.');
  const hasComma = raw.includes(',');

  if (hasDot && hasComma) {
    const parsed = Number(raw.replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  if (hasDot) {
    const dotThousandsPattern = /^\d{1,3}(\.\d{3})+$/;
    const parsed = dotThousandsPattern.test(raw)
      ? Number(raw.replace(/\./g, ''))
      : Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  if (hasComma) {
    const commaThousandsPattern = /^\d{1,3}(,\d{3})+$/;
    const parsed = commaThousandsPattern.test(raw)
      ? Number(raw.replace(/,/g, ''))
      : Number(raw.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/**
 * Convierte un string formateado a número
 */
export const parseFormattedNumber = (formattedValue: string | null | undefined): number => {
  return parsePriceInput(formattedValue, 0);
};

/**
 * Formatea una fecha/timestamp de PostgreSQL timestamptz a formato local
 */
export const formatDate = (
  timestamp: string | Date | number | null | undefined,
  options: Intl.DateTimeFormatOptions = {},
  config?: DateFormatConfig
): string => {
  const cfg = { ...DEFAULT_DATE_CONFIG, ...config };
  const fb = getDateFallbacks(cfg.locale);

  if (!timestamp || timestamp === null || timestamp === undefined) {
    return fb.noDate;
  }

  try {
    let date: Date;

    if (timestamp instanceof Date) {
      date = timestamp;
    } else if (typeof timestamp === 'string') {
      date = new Date(timestamp);
    } else if (typeof timestamp === 'number') {
      date = new Date(timestamp);
    } else {
      return fb.invalidFormat;
    }

    if (isNaN(date.getTime())) {
      return fb.invalidDate;
    }

    const defaultOptions: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: cfg.timezone,
      ...options
    };

    return date.toLocaleString(cfg.locale, defaultOptions);
  } catch {
    return fb.formatError;
  }
};

/**
 * Formatea solo la fecha (sin hora)
 */
export const formatDateOnly = (
  timestamp: string | Date | number | null | undefined,
  config?: DateFormatConfig
): string => {
  const cfg = { ...DEFAULT_DATE_CONFIG, ...config };
  const fb = getDateFallbacks(cfg.locale);

  if (!timestamp) {
    return fb.invalidDate;
  }

  try {
    const date = new Date(timestamp as string | number);

    if (isNaN(date.getTime())) {
      return fb.invalidDate;
    }

    return date.toLocaleDateString(cfg.locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: cfg.timezone
    });
  } catch {
    return fb.invalidDate;
  }
};

/**
 * Formatea solo la hora en formato de 12 horas con AM/PM
 */
export const formatTimeOnly = (
  timestamp: string | Date | number | null | undefined,
  config?: DateFormatConfig
): string => {
  const cfg = { ...DEFAULT_DATE_CONFIG, ...config };
  const fb = getDateFallbacks(cfg.locale);

  if (!timestamp) {
    return fb.invalidTime;
  }

  try {
    const date = new Date(timestamp as string | number);

    if (isNaN(date.getTime())) {
      return fb.invalidTime;
    }

    return date.toLocaleTimeString(cfg.locale, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: cfg.timezone
    });
  } catch {
    return fb.invalidTime;
  }
};

/**
 * Formatea fecha en formato completo con hora de 12 horas
 */
export const formatDateLong = (
  timestamp: string | Date | number | null | undefined,
  config?: DateFormatConfig
): string => {
  const cfg = { ...DEFAULT_DATE_CONFIG, ...config };
  const fb = getDateFallbacks(cfg.locale);

  if (!timestamp) {
    return fb.invalidDate;
  }

  try {
    const date = new Date(timestamp as string | number);

    if (isNaN(date.getTime())) {
      return fb.invalidDate;
    }

    return date.toLocaleDateString(cfg.locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: cfg.timezone
    });
  } catch {
    return fb.invalidDate;
  }
};

/**
 * Formatea fecha y hora completa para tickets y recibos
 */
export const formatDateTimeTicket = (
  timestamp: string | Date | number | null | undefined,
  config?: DateFormatConfig
): string => {
  const cfg = { ...DEFAULT_DATE_CONFIG, ...config };
  const fb = getDateFallbacks(cfg.locale);

  if (!timestamp) {
    return fb.invalidDate;
  }

  try {
    const date = new Date(timestamp as string | number);

    if (isNaN(date.getTime())) {
      return fb.invalidDate;
    }

    const dateOptions: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: cfg.timezone
    };

    const timeOptions: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: cfg.timezone
    };

    const datePart = date.toLocaleDateString(cfg.locale, dateOptions);
    const timePart = date.toLocaleTimeString(cfg.locale, timeOptions);

    return `${datePart} - ${timePart}`;
  } catch {
    return fb.invalidDate;
  }
};

/**
 * Formatea solo la hora de forma compacta para UI
 */
export const formatTimeCompact = (
  timestamp: string | Date | number | null | undefined,
  config?: DateFormatConfig
): string => {
  const cfg = { ...DEFAULT_DATE_CONFIG, ...config };
  const fb = getDateFallbacks(cfg.locale);

  if (!timestamp) {
    return fb.invalidTime;
  }

  try {
    const date = new Date(timestamp as string | number);

    if (isNaN(date.getTime())) {
      return fb.invalidTime;
    }

    return date.toLocaleTimeString(cfg.locale, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: cfg.timezone
    });
  } catch {
    return fb.invalidTime;
  }
};

/**
 * Convierte un valor a número finito
 */
export const toFiniteNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/**
 * Formatea fecha y hora de forma completa para reportes
 */
export const formatDateTimeReport = (
  timestamp: string | Date | number | null | undefined,
  config?: DateFormatConfig
): string => {
  const cfg = { ...DEFAULT_DATE_CONFIG, ...config };
  const fb = getDateFallbacks(cfg.locale);

  if (!timestamp) {
    return fb.invalidDate;
  }

  try {
    const date = new Date(timestamp as string | number);

    if (isNaN(date.getTime())) {
      return fb.invalidDate;
    }

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    const timeFormatted = date.toLocaleTimeString(cfg.locale, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: cfg.timezone
    });

    return `${day}/${month}/${year} ${timeFormatted}`;
  } catch {
    return fb.invalidDate;
  }
};
