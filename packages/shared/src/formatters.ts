export interface PriceFormatConfig {
  locale?: string;
  currency?: string;
  currencySymbol?: string;
  decimals?: number;
}

const DEFAULT_PRICE_CONFIG: Required<PriceFormatConfig> = {
  locale: 'es-CO',
  currency: 'COP',
  currencySymbol: '$',
  decimals: 0,
};

/**
 * Formats a number as price using Intl.NumberFormat
 * Supports multi-currency and multi-locale
 * Example CO: $1.200.000
 * Example US: $1,200,000.00
 * @param value - The numeric value to format
 * @param includeCurrency - If true, prepends currency symbol (default: true)
 * @param config - Optional locale/currency configuration
 * @returns The formatted price string
 */
export function formatPrice(
  value: number | null | undefined,
  includeCurrency = true,
  config?: PriceFormatConfig
): string {
  const cfg = { ...DEFAULT_PRICE_CONFIG, ...config };

  if (value === null || value === undefined || isNaN(value)) {
    return includeCurrency ? `${cfg.currencySymbol}0` : '0';
  }

  const numValue = Number(value);

  try {
    const formatted = new Intl.NumberFormat(cfg.locale, {
      style: includeCurrency ? 'currency' : 'decimal',
      currency: cfg.currency,
      minimumFractionDigits: cfg.decimals,
      maximumFractionDigits: cfg.decimals,
    }).format(numValue);

    return formatted;
  } catch {
    return `${cfg.currencySymbol}${numValue.toFixed(cfg.decimals)}`;
  }
}

/**
 * Formats a number without currency symbol
 * @param value - The numeric value to format
 * @param config - Optional locale configuration
 * @returns The formatted number string
 */
export function formatNumber(
  value: number | null | undefined,
  config?: PriceFormatConfig
): string {
  return formatPrice(value, false, config);
}

/**
 * Converts common price inputs to a number.
 * Supports:
 * - Thousands with period: "5.000" -> 5000
 * - Thousands with comma: "5,000" -> 5000
 * - Colombian format: "1.500,50" -> 1500.5
 * - US format: "1500.50" -> 1500.5
 * @param value - The input value to parse
 * @param fallback - Default value if parsing fails
 * @returns The parsed number
 */
export function parsePriceInput(
  value: string | number | null | undefined,
  fallback = 0
): number {
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
}

/**
 * Converts a formatted string to a number
 * @param formattedValue - The formatted string
 * @returns The numeric value
 */
export function parseFormattedNumber(formattedValue: string | null | undefined): number {
  return parsePriceInput(formattedValue, 0);
}
