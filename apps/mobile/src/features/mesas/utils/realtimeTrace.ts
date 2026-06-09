const MESA_SYNC_TRACE_ENABLED = __DEV__;

export type RealtimeUiTrace = {
  source: 'tables' | 'orders' | 'order_items' | 'mesa_broadcast' | 'mesa_lock';
  eventType: string;
  rowRef: string;
  receivedAt: number;
  commitLagMs: number | null;
};

export function parseCommitLagMs(payload: any): number | null {
  const commitTimestamp = String(payload?.commit_timestamp || '').trim();
  if (!commitTimestamp) return null;
  const commitMs = Date.parse(commitTimestamp);
  if (!Number.isFinite(commitMs)) return null;
  return Math.max(0, Date.now() - commitMs);
}

export function resolveRealtimeRowRef(payload: any): string {
  const rowId = String(payload?.new?.id || payload?.old?.id || '').trim();
  if (rowId) return rowId;
  const tableId = String(payload?.new?.table_id || payload?.old?.table_id || '').trim();
  if (tableId) return `table:${tableId}`;
  const orderId = String(payload?.new?.order_id || payload?.old?.order_id || '').trim();
  if (orderId) return `order:${orderId}`;
  return 'unknown';
}

export function traceMesaSync(label: string, data: Record<string, unknown>) {
  if (!MESA_SYNC_TRACE_ENABLED) return;
  const safeData = Object.entries(data || {}).reduce<Record<string, unknown>>((acc, [key, value]) => {
    if (value === undefined) return acc;
    acc[key] = value;
    return acc;
  }, {});
  console.info(`[mesa-sync] ${label}`, safeData);
}
