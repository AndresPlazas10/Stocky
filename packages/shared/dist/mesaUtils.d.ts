export declare function isMesaOccupied(status: string | null | undefined): boolean;
export declare function normalizeTableIdentifier(value: string | number | null | undefined): string;
export declare function compareMesaTableIdentifiers(left: {
    table_number?: string | number | null;
    table_name?: string | null;
    id?: string;
}, right: {
    table_number?: string | number | null;
    table_name?: string | null;
    id?: string;
}): number;
export declare function resolveMesaSyncVersion(mesa: {
    sync_version?: number | null;
} | null | undefined): number;
export declare function mesaDisplayName(mesa: {
    table_name?: string | null;
    table_number?: string | number | null;
    id: string;
}, tablePrefix?: string): string;
/**
 * Suprime un call_requested_at entrante si el mesero ya lo descartó dentro de
 * la ventana CALL_WINDOW_MS y el timestamp entrante no es más nuevo que el
 * descarte (evita que respuestas stale de refresh/realtime re-muestren la alerta).
 */
export declare function isCallRequestedAtSuppressed(dismissedCalls: Map<string, number> | null | undefined, mesaId: string, incomingRaw: string | null | undefined, callWindowMs: number): boolean;
/**
 * Aplica la supresión por dismiss a una lista de mesas: cualquier call
 * descartado (dismissedCallsRef) dentro de la ventana CALL_WINDOW_MS se
 * convierte en `call_requested_at: undefined`. Úsese en TODO camino de ingreso
 * de estado (fetch/poll/realtime) para que un call ya descartado no re-aparezca
 * en la UI (parpadeo de la campana tras el dismiss).
 */
export declare function suppressDismissedCalls<T extends MesaCallRow>(mesas: T[] | null | undefined, dismissedCalls: Map<string, number> | null | undefined): T[];
/**
 * Clave de recencia de una orden para ordenar la cocina de "más reciente a
 * menos reciente": prioriza el timestamp de llegada en sesión (si existe),
 * luego orders.updated_at (persistido, se actualiza al Guardar) y finalmente
 * orders.opened_at. Devuelve 0 si no hay ninguna señal.
 */
export declare function resolveOrderRecencyMs(mesa: {
    current_order_id?: string | null;
    orders?: {
        updated_at?: string | null;
        opened_at?: string | null;
    } | null;
}, arrivalMap?: Map<string, number> | null): number;
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
export declare function resolveCallEvents(mesas: MesaCallRow[] | null | undefined, seenByMesa: Map<string, string>, baselineDone: boolean): ResolveCallEventsResult;
//# sourceMappingURL=mesaUtils.d.ts.map