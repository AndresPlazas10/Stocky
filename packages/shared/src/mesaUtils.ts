export function isMesaOccupied(status: string | null | undefined): boolean {
  return (
    String(status || '')
      .trim()
      .toLowerCase() === 'occupied'
  );
}

export function normalizeTableIdentifier(value: string | number | null | undefined): string {
  return String(value ?? '').trim();
}

export function compareMesaTableIdentifiers(
  left: { table_number?: string | number | null; table_name?: string | null; id?: string },
  right: { table_number?: string | number | null; table_name?: string | null; id?: string },
): number {
  const leftId = normalizeTableIdentifier(left?.table_number ?? left?.table_name ?? left?.id);
  const rightId = normalizeTableIdentifier(right?.table_number ?? right?.table_name ?? right?.id);

  return leftId.localeCompare(rightId, 'es', {
    numeric: true,
    sensitivity: 'base',
  });
}

export function resolveMesaSyncVersion(
  mesa: { sync_version?: number | null } | null | undefined,
): number {
  const raw = Number(mesa?.sync_version);
  if (!Number.isFinite(raw)) return 0;
  return Math.max(0, Math.floor(raw));
}

export function mesaDisplayName(
  mesa: { table_name?: string | null; table_number?: string | number | null; id: string },
  tablePrefix?: string,
): string {
  if (mesa.table_name && String(mesa.table_name).trim()) return String(mesa.table_name).trim();
  const prefix = tablePrefix || 'Mesa';
  if (
    mesa.table_number !== null &&
    mesa.table_number !== undefined &&
    String(mesa.table_number).trim()
  ) {
    return `${prefix} ${String(mesa.table_number).trim()}`;
  }
  return `${prefix} ${mesa.id.slice(0, 6)}`;
}

/**
 * Suprime un call_requested_at entrante si el mesero ya lo descartó dentro de
 * la ventana CALL_WINDOW_MS y el timestamp entrante no es más nuevo que el
 * descarte (evita que respuestas stale de refresh/realtime re-muestren la alerta).
 */
export function isCallRequestedAtSuppressed(
  dismissedCalls: Map<string, number> | null | undefined,
  mesaId: string,
  incomingRaw: string | null | undefined,
  callWindowMs: number,
): boolean {
  const map = dismissedCalls;
  if (!map) return false;
  const key = String(mesaId || '').trim();
  if (!key) return false;
  const dismissedAt = map.get(key);
  if (!dismissedAt) return false;
  if (Date.now() - dismissedAt > callWindowMs) {
    map.delete(key);
    return false;
  }
  if (!incomingRaw) return false;
  const incomingMs = Date.parse(String(incomingRaw));
  if (!Number.isFinite(incomingMs)) return false;
  if (incomingMs > dismissedAt) {
    map.delete(key);
    return false;
  }
  return true;
}

/**
 * Clave de recencia de una orden para ordenar la cocina de "más reciente a
 * menos reciente": prioriza el timestamp de llegada en sesión (si existe),
 * luego orders.updated_at (persistido, se actualiza al Guardar) y finalmente
 * orders.opened_at. Devuelve 0 si no hay ninguna señal.
 */
export function resolveOrderRecencyMs(
  mesa: {
    current_order_id?: string | null;
    orders?: {
      updated_at?: string | null;
      opened_at?: string | null;
    } | null;
  },
  arrivalMap?: Map<string, number> | null,
): number {
  const orderId = String(mesa?.current_order_id || '').trim();
  if (!orderId) return 0;

  const arrival = arrivalMap?.get(orderId);
  if (arrival !== undefined && Number.isFinite(arrival) && arrival > 0) {
    return arrival;
  }

  const updatedMs = Date.parse(String(mesa?.orders?.updated_at || ''));
  if (Number.isFinite(updatedMs)) return updatedMs;

  const openedMs = Date.parse(String(mesa?.orders?.opened_at || ''));
  return Number.isFinite(openedMs) ? openedMs : 0;
}
