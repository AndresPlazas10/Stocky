/**
 * Formats a number as price in Colombian format
 * Thousands: period (2.000)
 * Millions: apostrophe (1'000.000)
 * Decimals: only if not .00
 * @param value - The numeric value to format
 * @param includeCurrency - If true, prepends "$" (default: true)
 * @returns The formatted price string
 */
export function formatPrice(value: number | null | undefined, includeCurrency = true): string {
  if (value === null || value === undefined || isNaN(value)) {
    return includeCurrency ? '$0' : '0';
  }

  const numValue = Number(value);
  
  // Separate integer and decimal parts
  const [integerPart, decimalPart] = numValue.toFixed(2).split('.');
  
  // Format integer part:
  // - Period (.) for thousands (every 3 digits)
  // - Apostrophe (') for millions (every 6 digits from right)
  let formattedInteger = integerPart;
  
  // If more than 6 digits (millions), use apostrophe to separate millions
  if (integerPart.length > 6) {
    // Separate millions from the rest
    const millions = integerPart.slice(0, -6);
    const remainder = integerPart.slice(-6);
    
    // Format the millions part and remainder
    const formattedMillions = millions.replace(/\B(?=(\d{3})+(?!\d))/g, "'");
    const formattedRemainder = remainder.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    
    formattedInteger = `${formattedMillions}'${formattedRemainder}`;
  } else {
    // Only thousands, use period
    formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }
  
  // Only add decimals if not .00
  let formattedNumber = formattedInteger;
  if (decimalPart !== '00') {
    formattedNumber = `${formattedInteger},${decimalPart}`;
  }
  
  return includeCurrency ? `$${formattedNumber}` : formattedNumber;
}

/**
 * Formats a number without currency symbol
 * @param value - The numeric value to format
 * @returns The formatted number string
 */
export function formatNumber(value: number | null | undefined): string {
  return formatPrice(value, false);
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
    .replace(/COP/gi, '')
    .replace(/\$/g, '')
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
