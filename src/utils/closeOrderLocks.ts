export const DEFAULT_CLOSE_ORDER_LOCK_TTL_MS = 15_000;

export function isCloseOrderLockActive(timestamp, {
  now = Date.now(),
  ttlMs = DEFAULT_CLOSE_ORDER_LOCK_TTL_MS
} = {}) {
  const ts = Number(timestamp || 0);
  if (!Number.isFinite(ts)) return false;
  return (now - ts) < ttlMs;
}

export function sanitizeCloseOrderLocksRecord(record, {
  now = Date.now(),
  ttlMs = DEFAULT_CLOSE_ORDER_LOCK_TTL_MS
} = {}) {
  const source = (record && typeof record === 'object') ? record : {};
  return Object.entries(source).reduce((acc, [key, value]) => {
    const normalizedKey = String(key || '').trim();
    if (!normalizedKey) return acc;

    if (isCloseOrderLockActive(value, { now, ttlMs })) {
      acc[normalizedKey] = Number(value);
    }
    return acc;
  }, {});
}

export function removeCloseOrderLockFromRecord(record, lockKey) {
  const source = (record && typeof record === 'object') ? record : {};
  const key = String(lockKey || '').trim();
  if (!key || !source[key]) return source;

  const next = { ...source };
  delete next[key];
  return next;
}

export function upsertCloseOrderLockInRecord(record, lockKey, timestamp = Date.now()) {
  const source = (record && typeof record === 'object') ? record : {};
  const key = String(lockKey || '').trim();
  if (!key) return source;

  return {
    ...source,
    [key]: Number(timestamp)
  };
}
