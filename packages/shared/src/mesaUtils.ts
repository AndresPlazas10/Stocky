import { CALL_WINDOW_MS } from './mesaConstants.js';

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
 * Aplica la supresión por dismiss a una lista de mesas: cualquier call
 * descartado (dismissedCallsRef) dentro de la ventana CALL_WINDOW_MS se
 * convierte en `call_requested_at: undefined`. Úsese en TODO camino de ingreso
 * de estado (fetch/poll/realtime) para que un call ya descartado no re-aparezca
 * en la UI (parpadeo de la campana tras el dismiss).
 */
export function suppressDismissedCalls<T extends MesaCallRow>(
  mesas: T[] | null | undefined,
  dismissedCalls: Map<string, number> | null | undefined,
): T[] {
  if (!Array.isArray(mesas) || mesas.length === 0) return mesas as T[];
  if (!dismissedCalls || dismissedCalls.size === 0) return mesas as T[];
  let changed = false;
  const next = mesas.map((mesa) => {
    const mesaId = String(mesa?.id || '').trim();
    const raw = String(mesa?.call_requested_at || '').trim();
    if (!mesaId || !raw) return mesa;
    if (isCallRequestedAtSuppressed(dismissedCalls, mesaId, raw, CALL_WINDOW_MS)) {
      changed = true;
      return { ...mesa, call_requested_at: undefined };
    }
    return mesa;
  });
  return changed ? next : (mesas as T[]);
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

/**
 * Formatea un tiempo transcurrido en ms como mm:ss (o hh:mm:ss si ≥ 1 hora).
 * Úsese para el temporizador de la cocina ("hace cuánto llegó el pedido").
 */
export function formatElapsedTime(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(Number(elapsedMs) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

export interface MesaCallRow {
  id?: string | null;
  call_requested_at?: string | null;
}

export interface CallEvent {
  mesaId: string;
  raw: string;
}

export interface ResolveCallEventsResult {
  newEvents: CallEvent[];
  baselineSeeded: boolean;
  /** Entradas a marcar como vistas cuando se siembra el baseline (sin toast). */
  seenEntries: CallEvent[];
}

/**
 * Decide qué llamadas de cocina ("orden lista") deben disparar notificación.
 *
 * - Antes del baseline y sin mesas cargadas (array vacío): no marca baseline
 *   (race: mesas aún cargando); se reintenta en el siguiente ciclo.
 * - Antes del baseline y con mesas cargadas (haya o no calls): siembra en
 *   silencio (baselineSeeded=true, cero eventos). Así, un mesero que inicia
 *   sesión con llamadas pendientes no recibe la ráfaga de toasts/beeps (la
 *   campana de la tarjeta sigue visible), y un mesero que inicia sin llamadas
 *   pendientes no se traga la primera llamada real.
 * - Después del baseline: solo son nuevos los calls cuyo raw difiera del visto.
 *
 * El caller NUNCA debe reconstruir `seenByMesa` desde el estado actual de las
 * mesas: un fetch stale (iniciado antes del call) podría "olvidar" el call y
 * provocar un segundo toast cuando el estado vuelva a traerlo. El seen-map es
 * monotónico: solo se agregan raws (o se marcan en el baseline).
 */
export function resolveCallEvents(
  mesas: MesaCallRow[] | null | undefined,
  seenByMesa: Map<string, string>,
  baselineDone: boolean,
): ResolveCallEventsResult {
  const rows = Array.isArray(mesas) ? mesas : [];
  const entries: CallEvent[] = [];
  for (const mesa of rows) {
    const mesaId = String(mesa?.id || '').trim();
    const raw = String(mesa?.call_requested_at || '').trim();
    if (!mesaId || !raw) continue;
    entries.push({ mesaId, raw });
  }

  if (!baselineDone) {
    if (rows.length === 0) {
      return { newEvents: [], baselineSeeded: false, seenEntries: [] };
    }
    return { newEvents: [], baselineSeeded: true, seenEntries: entries };
  }

  const newEvents: CallEvent[] = [];
  for (const entry of entries) {
    if (seenByMesa.get(entry.mesaId) !== entry.raw) {
      newEvents.push(entry);
    }
  }
  return { newEvents, baselineSeeded: false, seenEntries: [] };
}

