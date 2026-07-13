export interface PriceFormatConfig {
    locale?: string;
    currency?: string;
    currencySymbol?: string;
    decimals?: number;
}
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
export declare function formatPrice(value: number | null | undefined, includeCurrency?: boolean, config?: PriceFormatConfig): string;
/**
 * Formats a number without currency symbol
 * @param value - The numeric value to format
 * @param config - Optional locale configuration
 * @returns The formatted number string
 */
export declare function formatNumber(value: number | null | undefined, config?: PriceFormatConfig): string;
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
export declare function parsePriceInput(value: string | number | null | undefined, fallback?: number): number;
/**
 * Converts a formatted string to a number
 * @param formattedValue - The formatted string
 * @returns The numeric value
 */
export declare function parseFormattedNumber(formattedValue: string | null | undefined): number;
//# sourceMappingURL=formatters.d.ts.map