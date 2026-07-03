const MESA_SYNC_TRACE_ENABLED = __DEV__;

export type RealtimeUiTrace = {
  source: 'tables' | 'orders' | 'order_items' | 'mesa_broadcast' | 'mesa_lock';
  eventType: string;
  rowRef: string;
  receivedAt: number;
  commitLagMs: number | null;
};

type RealtimePayloadLike = {
  commit_timestamp?: string;
  new?: Record<string, unknown>;
  old?: Record<string, unknown>;
};

export function parseCommitLagMs(payload: RealtimePayloadLike): number | null {
  const commitTimestamp = String(payload?.commit_timestamp || '').trim();
  if (!commitTimestamp) return null;
  const commitMs = Date.parse(commitTimestamp);
  if (!Number.isFinite(commitMs)) return null;
  return Math.max(0, Date.now() - commitMs);
}

export function resolveRealtimeRowRef(payload: RealtimePayloadLike): string {
  const newRow = payload?.new;
  const oldRow = payload?.old;
  const rowId = String(newRow?.id ?? oldRow?.id ?? '').trim();
  if (rowId) return rowId;
  const tableId = String(newRow?.table_id ?? oldRow?.table_id ?? '').trim();
  if (tableId) return `table:${tableId}`;
  const orderId = String(newRow?.order_id ?? oldRow?.order_id ?? '').trim();
  if (orderId) return `order:${orderId}`;
  return 'unknown';
}

export function traceMesaSync(label: string, data: Record<string, unknown>) {
  if (!MESA_SYNC_TRACE_ENABLED) return;
  const safeData = Object.entries(data || {}).reduce<Record<string, unknown>>(
    (acc, [key, value]) => {
      if (value === undefined) return acc;
      acc[key] = value;
      return acc;
    },
    {},
  );
  if (__DEV__) console.warn(`[mesa-sync] ${label}`, safeData);
}
