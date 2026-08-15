export function isMesaOccupied(status) {
    return (String(status || '')
        .trim()
        .toLowerCase() === 'occupied');
}
export function normalizeTableIdentifier(value) {
    return String(value ?? '').trim();
}
export function compareMesaTableIdentifiers(left, right) {
    const leftId = normalizeTableIdentifier(left?.table_number ?? left?.table_name ?? left?.id);
    const rightId = normalizeTableIdentifier(right?.table_number ?? right?.table_name ?? right?.id);
    return leftId.localeCompare(rightId, 'es', {
        numeric: true,
        sensitivity: 'base',
    });
}
export function resolveMesaSyncVersion(mesa) {
    const raw = Number(mesa?.sync_version);
    if (!Number.isFinite(raw))
        return 0;
    return Math.max(0, Math.floor(raw));
}
export function mesaDisplayName(mesa, tablePrefix) {
    if (mesa.table_name && String(mesa.table_name).trim())
        return String(mesa.table_name).trim();
    const prefix = tablePrefix || 'Mesa';
    if (mesa.table_number !== null &&
        mesa.table_number !== undefined &&
        String(mesa.table_number).trim()) {
        return `${prefix} ${String(mesa.table_number).trim()}`;
    }
    return `${prefix} ${mesa.id.slice(0, 6)}`;
}
/**
 * Suprime un call_requested_at entrante si el mesero ya lo descartó dentro de
 * la ventana CALL_WINDOW_MS y el timestamp entrante no es más nuevo que el
 * descarte (evita que respuestas stale de refresh/realtime re-muestren la alerta).
 */
export function isCallRequestedAtSuppressed(dismissedCalls, mesaId, incomingRaw, callWindowMs) {
    const map = dismissedCalls;
    if (!map)
        return false;
    const key = String(mesaId || '').trim();
    if (!key)
        return false;
    const dismissedAt = map.get(key);
    if (!dismissedAt)
        return false;
    if (Date.now() - dismissedAt > callWindowMs) {
        map.delete(key);
        return false;
    }
    if (!incomingRaw)
        return false;
    const incomingMs = Date.parse(String(incomingRaw));
    if (!Number.isFinite(incomingMs))
        return false;
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
export function resolveOrderRecencyMs(mesa, arrivalMap) {
    const orderId = String(mesa?.current_order_id || '').trim();
    if (!orderId)
        return 0;
    const arrival = arrivalMap?.get(orderId);
    if (arrival !== undefined && Number.isFinite(arrival) && arrival > 0) {
        return arrival;
    }
    const updatedMs = Date.parse(String(mesa?.orders?.updated_at || ''));
    if (Number.isFinite(updatedMs))
        return updatedMs;
    const openedMs = Date.parse(String(mesa?.orders?.opened_at || ''));
    return Number.isFinite(openedMs) ? openedMs : 0;
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
export function resolveCallEvents(mesas, seenByMesa, baselineDone) {
    const rows = Array.isArray(mesas) ? mesas : [];
    const entries = [];
    for (const mesa of rows) {
        const mesaId = String(mesa?.id || '').trim();
        const raw = String(mesa?.call_requested_at || '').trim();
        if (!mesaId || !raw)
            continue;
        entries.push({ mesaId, raw });
    }
    if (!baselineDone) {
        if (rows.length === 0) {
            return { newEvents: [], baselineSeeded: false, seenEntries: [] };
        }
        return { newEvents: [], baselineSeeded: true, seenEntries: entries };
    }
    const newEvents = [];
    for (const entry of entries) {
        if (seenByMesa.get(entry.mesaId) !== entry.raw) {
            newEvents.push(entry);
        }
    }
    return { newEvents, baselineSeeded: false, seenEntries: [] };
}
//# sourceMappingURL=mesaUtils.js.map