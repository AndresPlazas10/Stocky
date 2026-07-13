/**
 * Colombian peso denominations for change calculation (backward compatibility)
 */
export declare const COLOMBIAN_DENOMINATIONS: readonly number[];
/**
 * Entry in a cash breakdown
 */
export interface CashBreakdownEntry {
    denomination: number;
    count: number;
}
/**
 * Result of a change calculation
 */
export interface ChangeResult {
    isValid: boolean;
    reason: 'invalid_total' | 'invalid_paid' | 'insufficient' | null;
    change: number;
    breakdown: CashBreakdownEntry[];
    paid?: number;
}
/**
 * Parses a cash amount from various formats
 * @param value - The value to parse
 * @returns The parsed amount, or NaN if invalid
 */
export declare function parseCopAmount(value: string | number | null | undefined): number;
/**
 * Calculates change and provides denomination breakdown
 * @param total - The total amount due
 * @param pagado - The amount paid (can be formatted string)
 * @param currencyCode - ISO currency code (COP, USD, PEN, MXN, ARS)
 * @returns Change calculation result with breakdown
 */
export declare function calcularCambio(total: number | null | undefined, pagado: string | number | null | undefined, currencyCode?: string): ChangeResult;
//# sourceMappingURL=cambio.d.ts.map