/**
 * Normalizes a text value to a trimmed string
 * @param value - The value to normalize
 * @param fallback - Default value if empty
 * @returns The normalized string
 */
export function normalizeText(
  value: string | number | null | undefined,
  fallback = ''
): string {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
}

/**
 * Normalizes an optional text value (returns undefined if empty)
 * @param value - The value to normalize
 * @returns The normalized string or undefined
 */
export function normalizeOptionalText(
  value: string | number | null | undefined
): string | undefined {
  const normalized = String(value ?? '').trim();
  return normalized || undefined;
}

/**
 * Normalizes a numeric value
 * @param value - The value to normalize
 * @param fallback - Default value if invalid
 * @returns The normalized number
 */
export function normalizeNumber(
  value: string | number | null | undefined,
  fallback = 0
): number {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Normalizes an optional numeric value (returns undefined if empty/invalid)
 * @param value - The value to normalize
 * @returns The normalized number or undefined
 */
export function normalizeOptionalAmount(
  value: string | number | null | undefined
): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Normalizes a reference ID (trims whitespace)
 * @param value - The reference to normalize
 * @returns The normalized reference or undefined
 */
export function normalizeReference(
  value: string | number | null | undefined
): string | undefined {
  const normalized = String(value ?? '').trim();
  return normalized || undefined;
}
