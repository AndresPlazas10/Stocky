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
export const KITCHEN_ALERT_WINDOW_MS = 1500;
export const KITCHEN_ALERT_PRIORITY = {
    new: 3,
    update: 2,
    notes: 1,
};
export function createKitchenAlertCoalescer({ windowMs = KITCHEN_ALERT_WINDOW_MS, onFlush, }) {
    const pending = new Map();
    let disposed = false;
    const clearPendingTimer = (alert) => {
        if (alert.timer !== null) {
            clearTimeout(alert.timer);
            alert.timer = null;
        }
    };
    const flushOrder = (orderId, alert) => {
        pending.delete(orderId);
        onFlush(alert.kind, orderId, alert.payload);
    };
    const scheduleFlush = (orderId, alert) => {
        clearPendingTimer(alert);
        alert.timer = setTimeout(() => {
            if (disposed)
                return;
            const current = pending.get(orderId);
            if (!current)
                return;
            clearPendingTimer(current);
            flushOrder(orderId, current);
        }, windowMs);
    };
    const notify = (kind, orderId, payload) => {
        if (disposed)
            return;
        const normalizedOrderId = String(orderId || '').trim();
        if (!normalizedOrderId)
            return;
        const existing = pending.get(normalizedOrderId);
        if (!existing) {
            const alert = { kind, payload, timer: null };
            pending.set(normalizedOrderId, alert);
            scheduleFlush(normalizedOrderId, alert);
            return;
        }
        if (KITCHEN_ALERT_PRIORITY[kind] > KITCHEN_ALERT_PRIORITY[existing.kind]) {
            existing.kind = kind;
        }
        existing.payload = payload;
        scheduleFlush(normalizedOrderId, existing);
    };
    const flushPending = () => {
        if (disposed)
            return;
        pending.forEach((alert, orderId) => {
            clearPendingTimer(alert);
            flushOrder(orderId, alert);
        });
    };
    const dispose = () => {
        disposed = true;
        pending.forEach((alert) => clearPendingTimer(alert));
        pending.clear();
    };
    return { notify, flushPending, dispose };
}
//# sourceMappingURL=kitchenAlerts.js.map