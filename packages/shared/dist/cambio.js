/**
 * Denominations by currency for change calculation
 */
const DENOMINATIONS_BY_CURRENCY = {
    COP: [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50],
    USD: [100, 50, 20, 10, 5, 2, 1, 0.50, 0.25, 0.10, 0.05],
    PEN: [200, 100, 50, 20, 10, 5, 2, 1, 0.50, 0.20, 0.10],
    MXN: [1000, 500, 200, 100, 50, 20, 10, 5, 2, 1],
    ARS: [10000, 5000, 2000, 1000, 500, 200, 100, 50, 10],
};
/**
 * Colombian peso denominations for change calculation (backward compatibility)
 */
export const COLOMBIAN_DENOMINATIONS = DENOMINATIONS_BY_CURRENCY.COP;
/**
 * Parses a cash amount from various formats
 * @param value - The value to parse
 * @returns The parsed amount, or NaN if invalid
 */
export function parseCopAmount(value) {
    if (value === null || value === undefined)
        return NaN;
    if (typeof value === 'number')
        return Number.isFinite(value) ? value : NaN;
    const raw = String(value).trim().replace(/\s/g, '').replace(/\$/g, '');
    if (!raw)
        return NaN;
    // Format: 1.200.000,50
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(raw)) {
        const parsed = Number(raw.replace(/\./g, '').replace(',', '.'));
        return Number.isFinite(parsed) ? parsed : NaN;
    }
    // Format: 1,200,000.50
    if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(raw)) {
        const parsed = Number(raw.replace(/,/g, ''));
        return Number.isFinite(parsed) ? parsed : NaN;
    }
    // Simple number with comma decimal
    const simpleParsed = Number(raw.replace(',', '.'));
    if (Number.isFinite(simpleParsed))
        return simpleParsed;
    // Extract digits only as last resort
    const digitsOnly = raw.replace(/[^\d]/g, '');
    if (!digitsOnly)
        return NaN;
    const digitsParsed = Number(digitsOnly);
    return Number.isFinite(digitsParsed) ? digitsParsed : NaN;
}
/**
 * Calculates change and provides denomination breakdown
 * @param total - The total amount due
 * @param pagado - The amount paid (can be formatted string)
 * @param currencyCode - ISO currency code (COP, USD, PEN, MXN, ARS)
 * @returns Change calculation result with breakdown
 */
export function calcularCambio(total, pagado, currencyCode = 'COP') {
    const currency = currencyCode || 'COP';
    const denominations = DENOMINATIONS_BY_CURRENCY[currency] || DENOMINATIONS_BY_CURRENCY.COP;
    const isDecimalCurrency = ['USD', 'PEN', 'MXN', 'ARS'].includes(currency);
    const roundFactor = isDecimalCurrency ? 100 : 1;
    const normalizedTotal = Math.round((Number(total) || 0) * roundFactor) / roundFactor;
    const normalizedPaid = parseCopAmount(pagado);
    if (normalizedTotal <= 0) {
        return { isValid: false, reason: 'invalid_total', change: 0, breakdown: [] };
    }
    if (!Number.isFinite(normalizedPaid) || normalizedPaid <= 0) {
        return { isValid: false, reason: 'invalid_paid', change: 0, breakdown: [] };
    }
    if (normalizedPaid < normalizedTotal) {
        return { isValid: false, reason: 'insufficient', change: 0, breakdown: [] };
    }
    let remaining = Math.round((normalizedPaid - normalizedTotal) * roundFactor) / roundFactor;
    const breakdown = [];
    for (const denomination of denominations) {
        const count = Math.floor(remaining / denomination);
        if (count > 0) {
            breakdown.push({ denomination, count });
            remaining = Math.round((remaining - count * denomination) * roundFactor) / roundFactor;
        }
    }
    return {
        isValid: true,
        reason: null,
        change: Math.round((normalizedPaid - normalizedTotal) * roundFactor) / roundFactor,
        breakdown,
        paid: normalizedPaid,
    };
}
//# sourceMappingURL=cambio.js.map