const sessionCache = new Map();

function now() {
  return Date.now();
}

function normalizeKey(value) {
  const key = String(value || '').trim();
  return key || null;
}

export function readCacheGet(cacheKey) {
  const key = normalizeKey(cacheKey);
  if (!key) return null;

  const entry = sessionCache.get(key);
  if (!entry) return null;

  if (entry.expiresAt && entry.expiresAt <= now()) {
    sessionCache.delete(key);
    return null;
  }

  return entry.value || null;
}

export function readCacheSet(cacheKey, value, ttlMs) {
  const key = normalizeKey(cacheKey);
  if (!key) return;

  const ttl = Number.isFinite(ttlMs) ? ttlMs : 0;
  const expiresAt = ttl > 0 ? now() + ttl : null;
  sessionCache.set(key, { value, expiresAt });
}

export function readCacheInvalidatePrefixes(prefixes = []) {
  const normalizedPrefixes = (prefixes || [])
    .map(normalizeKey)
    .filter(Boolean);

  if (normalizedPrefixes.length === 0) return 0;

  let removed = 0;
  for (const key of sessionCache.keys()) {
    const shouldRemove = normalizedPrefixes.some((prefix) => key.startsWith(prefix));
    if (shouldRemove) {
      sessionCache.delete(key);
      removed += 1;
    }
  }

  return removed;
}

export function readCacheInvalidateMatching(predicate) {
  if (typeof predicate !== 'function') return 0;

  let removed = 0;
  for (const key of sessionCache.keys()) {
    if (predicate(key)) {
      sessionCache.delete(key);
      removed += 1;
    }
  }

  return removed;
}

export function readCacheClear() {
  const size = sessionCache.size;
  sessionCache.clear();
  return size;
}
