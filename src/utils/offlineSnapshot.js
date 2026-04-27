export function isOfflineMode() {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

function canUseStorage() {
  return typeof window !== 'undefined' && !!window.localStorage;
}

export function isOfflinePersistenceEnabled() {
  if (typeof window === 'undefined') return false;

  const desktopRuntime = window?.stockyDesktop?.isDesktop === true;
  if (desktopRuntime) return true;

  const flag = String(import.meta?.env?.VITE_ENABLE_OFFLINE_SNAPSHOT || '').trim().toLowerCase();
  return flag === '1' || flag === 'true' || flag === 'yes';
}

function resolveSnapshotKey(key) {
  return `stocky.offline_snapshot.${String(key || '').trim()}`;
}

export function saveOfflineSnapshot(key, payload) {
  if (!isOfflinePersistenceEnabled() || !canUseStorage() || !key) return;
  try {
    window.localStorage.setItem(resolveSnapshotKey(key), JSON.stringify(payload));
  } catch {
    // no-op
  }
}

export function readOfflineSnapshot(key, fallback = null) {
  if (!isOfflinePersistenceEnabled() || !canUseStorage() || !key) return fallback;
  try {
    const raw = window.localStorage.getItem(resolveSnapshotKey(key));
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}
