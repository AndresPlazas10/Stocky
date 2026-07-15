type OrderItemLike = {
    id?: string;
    product_id?: string | null;
    combo_id?: string | null;
    [key: string]: unknown;
};
export declare function reconcileOrderItemsFromServer<T extends OrderItemLike>(current: T[], fromServer: T[]): T[];
export {};
//# sourceMappingURL=orderReconciliation.d.ts.map