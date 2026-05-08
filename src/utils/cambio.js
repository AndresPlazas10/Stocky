const COLOMBIAN_DENOMINATIONS = [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50];

export const parseCopAmount = (value) => {
  if (value === null || value === undefined) return NaN;
  if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value) : NaN;

  const raw = String(value).trim().replace(/\s/g, '').replace(/\$/g, '');
  if (!raw) return NaN;

  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(raw)) {
    const parsed = Number(raw.replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(parsed) ? Math.round(parsed) : NaN;
  }

  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(raw)) {
    const parsed = Number(raw.replace(/,/g, ''));
    return Number.isFinite(parsed) ? Math.round(parsed) : NaN;
  }

  const simpleParsed = Number(raw.replace(',', '.'));
  if (Number.isFinite(simpleParsed)) return Math.round(simpleParsed);

  const digitsOnly = raw.replace(/[^\d]/g, '');
  if (!digitsOnly) return NaN;
  const digitsParsed = Number(digitsOnly);
  return Number.isFinite(digitsParsed) ? Math.round(digitsParsed) : NaN;
};

export const calcularCambio = (total, pagado) => {
  const normalizedTotal = Math.round(Number(total) || 0);
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

  let remaining = normalizedPaid - normalizedTotal;
  const breakdown = [];

  for (const denomination of COLOMBIAN_DENOMINATIONS) {
    const count = Math.floor(remaining / denomination);
    if (count > 0) {
      breakdown.push({ denomination, count });
      remaining -= count * denomination;
    }
  }

  return {
    isValid: true,
    reason: null,
    change: normalizedPaid - normalizedTotal,
    breakdown,
    paid: normalizedPaid,
  };
};
