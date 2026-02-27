export function isOfflineMode() {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

export function saveOfflineSnapshot(_key, _payload) {
  // Rollback online-only: no persistimos snapshots offline.
}

export function readOfflineSnapshot(_key, _fallback = null) {
  // Rollback online-only: no leemos snapshots offline.
  return _fallback;
}
