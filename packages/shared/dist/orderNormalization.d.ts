export declare function normalizeOrderReference(value: unknown): string;
export declare function normalizeOrderItemQuantity(value: unknown): number;
export declare function normalizeOrderItemSubtotal(row: {
    subtotal?: unknown;
    quantity?: unknown;
    price?: unknown;
}): number;
export declare function calculateOrderTotal(items: Array<{
    quantity?: unknown;
    price?: unknown;
    subtotal?: unknown;
}>): number;
export declare function calculateOrderUnits(items: Array<{
    quantity?: unknown;
}>): number;
export declare function sumOrderItemsQuantity(items: Array<{
    quantity?: unknown;
}>): number;
//# sourceMappingURL=orderNormalization.d.ts.map