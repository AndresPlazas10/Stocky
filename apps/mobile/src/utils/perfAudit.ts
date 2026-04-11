const rawPerfAuditFlag = String(process.env.EXPO_PUBLIC_PERF_AUDIT || '').trim().toLowerCase();

export const PERF_AUDIT_ENABLED = __DEV__ || rawPerfAuditFlag === '1' || rawPerfAuditFlag === 'true';

function sanitizePayload(payload?: Record<string, unknown>) {
  if (!payload) return {};
  return Object.entries(payload).reduce<Record<string, unknown>>((acc, [key, value]) => {
    if (value === undefined) return acc;
    acc[key] = value;
    return acc;
  }, {});
}

export function perfMark(label: string, payload?: Record<string, unknown>) {
  if (!PERF_AUDIT_ENABLED) return;
  const event = sanitizePayload(payload);
  console.info(`[perf] ${label}`, {
    ts: Date.now(),
    ...event,
  });
}

export function perfDurationMs(startedAtMs: number) {
  const started = Number(startedAtMs || 0);
  if (!Number.isFinite(started) || started <= 0) return null;
  return Math.max(0, Date.now() - started);
}
