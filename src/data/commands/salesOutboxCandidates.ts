import type { OutboxEvent } from '../../types';

interface CandidateOptions {
  nowMs?: number;
  maxEvents?: number;
}

export function selectSalesOutboxCandidates(
  queue: OutboxEvent[] = [],
  {
    nowMs = Date.now(),
    maxEvents = 20
  }: CandidateOptions = {}
): OutboxEvent[] {
  const source = Array.isArray(queue) ? queue : [];
  const limit = Math.max(1, Number(maxEvents || 20));

  return source
    .filter((item) => {
      if (item?.type !== 'sale.create') return false;

      const status = String(item?.status || 'pending').toLowerCase();
      if (status !== 'pending' && status !== 'error') return false;

      const nextRetryMs = Date.parse(String(item?.next_retry_at || '').trim());

      if (status === 'error') {
        return Number.isFinite(nextRetryMs) && nextRetryMs <= nowMs;
      }

      if (Number.isFinite(nextRetryMs) && nextRetryMs > nowMs) return false;
      return true;
    })
    .slice(0, limit);
}
