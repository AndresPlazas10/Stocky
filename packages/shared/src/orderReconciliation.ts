type OrderItemLike = {
  id?: string;
  product_id?: string | null;
  combo_id?: string | null;
  [key: string]: unknown;
};

export function reconcileOrderItemsFromServer<T extends OrderItemLike>(
  current: T[],
  fromServer: T[],
): T[] {
  const local = Array.isArray(current) ? current : [];
  const server = Array.isArray(fromServer) ? fromServer : [];

  const serverById = new Map(server.map((item) => [String(item.id || ''), item]));
  const serverByIdentity = new Map<string, T>();
  server.forEach((item) => {
    const key = item.product_id
      ? `p:${item.product_id}`
      : item.combo_id
        ? `c:${item.combo_id}`
        : '';
    if (!key) return;
    if (!serverByIdentity.has(key)) {
      serverByIdentity.set(key, item);
    }
  });

  const usedServerIds = new Set<string>();

  const merged = local.map((localItem) => {
    const localId = String(localItem.id || '');
    const exact = localId ? serverById.get(localId) : null;
    if (exact) {
      usedServerIds.add(String(exact.id || ''));
      return exact;
    }

    const identityKey = localItem.product_id
      ? `p:${localItem.product_id}`
      : localItem.combo_id
        ? `c:${localItem.combo_id}`
        : '';
    if (identityKey) {
      const byIdentity = serverByIdentity.get(identityKey);
      if (byIdentity) {
        usedServerIds.add(String(byIdentity.id || ''));
        return byIdentity;
      }
    }

    return localItem;
  });

  server.forEach((serverItem) => {
    const serverId = String(serverItem.id || '');
    if (!serverId || usedServerIds.has(serverId)) return;
    merged.push(serverItem);
  });

  return merged;
}
