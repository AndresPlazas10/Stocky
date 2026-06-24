interface DateParts {
  year: number;
  month: number;
  day: number;
}

interface DateRangeResult {
  fromIso: string | null;
  toIso: string | null;
}

function parseLocalDateParts(value: string | null | undefined): DateParts | null {
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

function localStartOfDayIso({ year, month, day }: DateParts): string {
  return new Date(year, month - 1, day, 0, 0, 0, 0).toISOString();
}

function localEndOfDayIso({ year, month, day }: DateParts): string {
  return new Date(year, month - 1, day, 23, 59, 59, 999).toISOString();
}

export function buildUtcRangeFromLocalDates(
  fromDate: string | null | undefined,
  toDate: string | null | undefined
): DateRangeResult {
  const fromParts = parseLocalDateParts(fromDate);
  const toParts = parseLocalDateParts(toDate);

  let fromIso = fromParts ? localStartOfDayIso(fromParts) : null;
  let toIso = toParts ? localEndOfDayIso(toParts) : null;

  if (fromIso && toIso && fromIso > toIso) {
    [fromIso, toIso] = [toIso, fromIso];
  }

  return { fromIso, toIso };
}
