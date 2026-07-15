export function normalizeOrderReference(value) {
    return String(value || '').trim();
}
export function normalizeOrderItemQuantity(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed))
        return 0;
    return Math.max(0, Math.floor(parsed));
}
export function normalizeOrderItemSubtotal(row) {
    const subtotal = Number(row?.subtotal);
    if (Number.isFinite(subtotal)) {
        return Math.max(0, subtotal);
    }
    const quantity = normalizeOrderItemQuantity(row?.quantity);
    const price = Number(row?.price);
    const safePrice = Number.isFinite(price) ? price : 0;
    return Math.max(0, quantity * safePrice);
}
export function calculateOrderTotal(items) {
    return (Array.isArray(items) ? items : []).reduce((sum, item) => {
        const subtotal = Number(item.subtotal);
        if (Number.isFinite(subtotal))
            return sum + Math.max(0, subtotal);
        const quantity = normalizeOrderItemQuantity(item.quantity);
        const price = Number(item.price);
        const safePrice = Number.isFinite(price) ? price : 0;
        return sum + Math.max(0, quantity * safePrice);
    }, 0);
}
export function calculateOrderUnits(items) {
    return (Array.isArray(items) ? items : []).reduce((sum, item) => sum + Math.max(0, Math.floor(Number(item.quantity || 0))), 0);
}
export function sumOrderItemsQuantity(items) {
    return (Array.isArray(items) ? items : []).reduce((sum, item) => sum + Math.max(0, Number(item.quantity || 0)), 0);
}
//# sourceMappingURL=orderNormalization.js.map