import type { OutboxEvent } from '../../types';

function normalizeIdempotencyKey(value: unknown): string | null {
  const normalized = String(value || '').trim();
  return normalized || null;
}

export function findReusableSaleCreateOutboxEvent(
  queue: OutboxEvent[] = [],
  idempotencyKey: string
): OutboxEvent | null {
  const normalizedKey = normalizeIdempotencyKey(idempotencyKey);
  if (!normalizedKey || !Array.isArray(queue)) return null;

  return queue.find((item) => {
    if (item?.type !== 'sale.create') return false;
    const itemKey = normalizeIdempotencyKey(item?.payload?.idempotencyKey);
    if (!itemKey || itemKey !== normalizedKey) return false;

    const status = String(item?.status || 'pending').toLowerCase();
    return status === 'pending' || status === 'processing' || status === 'error';
  }) || null;
}
