/**
 * Normalizes a text value to a trimmed string
 * @param value - The value to normalize
 * @param fallback - Default value if empty
 * @returns The normalized string
 */
export declare function normalizeText(value: string | number | null | undefined, fallback?: string): string;
/**
 * Normalizes an optional text value (returns undefined if empty)
 * @param value - The value to normalize
 * @returns The normalized string or undefined
 */
export declare function normalizeOptionalText(value: string | number | null | undefined): string | undefined;
/**
 * Normalizes a numeric value
 * @param value - The value to normalize
 * @param fallback - Default value if invalid
 * @returns The normalized number
 */
export declare function normalizeNumber(value: string | number | null | undefined, fallback?: number): number;
/**
 * Normalizes an optional numeric value (returns undefined if empty/invalid)
 * @param value - The value to normalize
 * @returns The normalized number or undefined
 */
export declare function normalizeOptionalAmount(value: string | number | null | undefined): number | undefined;
/**
 * Normalizes a reference ID (trims whitespace)
 * @param value - The reference to normalize
 * @returns The normalized reference or undefined
 */
export declare function normalizeReference(value: string | number | null | undefined): string | undefined;
//# sourceMappingURL=normalization.d.ts.map