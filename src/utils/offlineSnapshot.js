function buildKey(key) {
  return `stocky.offline_snapshot.${String(key || '').trim()}`;
}

export function isOfflineMode() {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

export function saveOfflineSnapshot(key, payload) {
  if (typeof window === 'undefined') return;
  const normalizedKey = buildKey(key);
  if (!normalizedKey) return;

  try {
    window.localStorage.setItem(normalizedKey, JSON.stringify({
      updated_at: new Date().toISOString(),
      payload: payload ?? null
    }));
  } catch {
    // best-effort
  }
}

export function readOfflineSnapshot(key, fallback = null) {
  if (typeof window === 'undefined') return fallback;
  const normalizedKey = buildKey(key);
  if (!normalizedKey) return fallback;

  try {
    const raw = window.localStorage.getItem(normalizedKey);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (!parsed || !Object.prototype.hasOwnProperty.call(parsed, 'payload')) return fallback;
    return parsed.payload ?? fallback;
  } catch {
    return fallback;
  }
}
