/**
 * Coalescing de alertas de cocina por orden.
 *
 * Cuando un mesero edita los productos de una orden y además agrega/edita un
 * comentario en la misma sesión, el sistema recibe varios eventos de cambio
 * (order_items INSERT/UPDATE + orders UPDATE de notas) que hoy disparan una
 * alerta por evento. Este helper agrupa todos los cambios de la MISMA orden
 * dentro de una ventana corta y emite UNA sola alerta, con el kind de mayor
 * prioridad y el último payload.
 *
 * - `new` (se agregó un producto) > `update` (cambió cantidad/producto) > `notes` (cambió el comentario)
 * - Órdenes distintas se notifican por separado.
 * - `flushPending()` vacía el estado sin esperar la ventana (útil al desmontar).
 * - `dispose()` limpia timers pendientes.
 */
export declare const KITCHEN_ALERT_WINDOW_MS = 1500;
export declare const KITCHEN_ALERT_PRIORITY: {
    readonly new: 3;
    readonly update: 2;
    readonly notes: 1;
};
export type KitchenAlertKind = keyof typeof KITCHEN_ALERT_PRIORITY;
export interface KitchenAlertCoalescerOptions<TPayload> {
    windowMs?: number;
    onFlush: (kind: KitchenAlertKind, orderId: string, payload: TPayload) => void;
}
export interface KitchenAlertCoalescer<TPayload> {
    notify: (kind: KitchenAlertKind, orderId: string, payload: TPayload) => void;
    flushPending: () => void;
    dispose: () => void;
}
export declare function createKitchenAlertCoalescer<TPayload>({ windowMs, onFlush, }: KitchenAlertCoalescerOptions<TPayload>): KitchenAlertCoalescer<TPayload>;
//# sourceMappingURL=kitchenAlerts.d.ts.map