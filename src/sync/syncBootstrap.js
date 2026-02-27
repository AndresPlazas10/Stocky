// Rollback online-only: API de compatibilidad sin sync local.

export async function bootstrapLocalSync() {
  return { enabled: false, stop: async () => {} };
}

export async function stopLocalSync() {
  return;
}

export function getLocalSyncContext() {
  return null;
}

export async function runOutboxTick() {
  return false;
}

export async function listOutboxEvents() {
  return [];
}

export async function listConflictEvents() {
  return [];
}

export async function clearConflictEvents() {
  return true;
}

export async function clearOutboxEvents() {
  return true;
}

export async function clearLocalReadCache() {
  return true;
}

export async function listConvergenceMetrics() {
  return [];
}
