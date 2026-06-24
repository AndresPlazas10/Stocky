import type { Sale } from '../../types';

interface SyncOptions {
  tempSaleId: string;
  remoteSaleId: string;
  syncedAt?: string | null;
}

interface SyncResult {
  nextSnapshot: Sale[];
  updated: boolean;
}

export function applySaleSyncToSnapshot(
  snapshot: Sale[] = [],
  {
    tempSaleId,
    remoteSaleId,
    syncedAt = null
  }: SyncOptions
): SyncResult {
  if (!Array.isArray(snapshot)) {
    return { nextSnapshot: [], updated: false };
  }

  const fromId = String(tempSaleId || '').trim();
  const toId = String(remoteSaleId || '').trim();
  const syncedAtIso = String(syncedAt || '').trim() || null;

  if (!fromId || !toId) {
    return { nextSnapshot: snapshot, updated: false };
  }

  let updated = false;
  const nextSnapshot = snapshot.map((sale) => {
    if (!sale || String(sale.id || '').trim() !== fromId) return sale;
    updated = true;
    return {
      ...sale,
      id: toId,
      pending_sync: false,
      synced_at: syncedAtIso || sale?.synced_at || null,
    };
  });

  return { nextSnapshot, updated };
}
