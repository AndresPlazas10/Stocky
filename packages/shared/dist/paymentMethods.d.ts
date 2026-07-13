/**
 * Payment method types for Stocky POS
 */
export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'mixed' | 'nequi' | 'bancolombia' | 'banco_bogota' | 'nu' | 'davivienda' | 'daviplata' | 'spei' | 'oxxo' | 'yape' | 'plin' | 'mercadopago' | 'venmo' | 'cashapp' | 'zelle';
/**
 * All valid payment method values
 */
export declare const PAYMENT_METHODS: PaymentMethod[];
/**
 * Labels for payment methods (Spanish)
 */
export declare const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string>;
/**
 * Bank-specific payment methods
 */
export declare const BANK_METHODS: PaymentMethod[];
/**
 * Checks if a payment method is a bank-specific method
 * @param method - The payment method to check
 * @returns true if the method is a bank method
 */
export declare function isBankPaymentMethod(method: string | null | undefined): boolean;
/**
 * Gets the Spanish label for a payment method
 * @param method - The payment method key
 * @param options - Optional configuration
 * @param options.withEmoji - If true, prepends emoji to the label
 * @returns The localized label or the original method string
 */
export declare function getPaymentMethodLabel(method: string | null | undefined, options?: {
    withEmoji?: boolean;
}): string;
//# sourceMappingURL=paymentMethods.d.ts.map