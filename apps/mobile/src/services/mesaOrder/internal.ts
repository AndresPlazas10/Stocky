export function normalizeBusinessId(value: unknown): string {
  return String(value || '').trim();
}

export function normalizeOrderId(value: unknown): string {
  return String(value || '').trim();
}
