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
//# sourceMappingURL=mesaUtils.d.ts.map