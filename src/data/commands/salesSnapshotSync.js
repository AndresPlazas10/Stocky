export function applySaleSyncToSnapshot(snapshot = [], {
  tempSaleId,
  remoteSaleId,
  syncedAt = null
} = {}) {
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
