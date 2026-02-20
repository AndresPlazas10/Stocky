function parseLocalDateParts(value) {
  if (!value || typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;

  return { year, month, day };
}

function localStartOfDayIso({ year, month, day }) {
  return new Date(year, month - 1, day, 0, 0, 0, 0).toISOString();
}

function localEndOfDayIso({ year, month, day }) {
  return new Date(year, month - 1, day, 23, 59, 59, 999).toISOString();
}

export function buildUtcRangeFromLocalDates(fromDate, toDate) {
  const fromParts = parseLocalDateParts(fromDate);
  const toParts = parseLocalDateParts(toDate);

  let fromIso = fromParts ? localStartOfDayIso(fromParts) : null;
  let toIso = toParts ? localEndOfDayIso(toParts) : null;

  if (fromIso && toIso && fromIso > toIso) {
    [fromIso, toIso] = [toIso, fromIso];
  }

  return { fromIso, toIso };
}

