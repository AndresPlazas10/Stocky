export interface DateConfig {
    timezone?: string;
    locale?: string;
}
/**
 * Formats a timestamp to a readable date/time string
 * @param timestamp - PostgreSQL timestamptz, Date object, or ISO string
 * @param options - Intl.DateTimeFormat options
 * @param config - Timezone and locale configuration
 * @returns Formatted date string
 */
export declare function formatDate(timestamp: string | Date | number | null | undefined, options?: Intl.DateTimeFormatOptions, config?: DateConfig): string;
/**
 * Formats a timestamp to date only (no time)
 */
export declare function formatDateOnly(timestamp: string | Date | number | null | undefined, config?: DateConfig): string;
/**
 * Formats a timestamp to time only (12-hour format with AM/PM)
 */
export declare function formatTimeOnly(timestamp: string | Date | number | null | undefined, config?: DateConfig): string;
/**
 * Formats a timestamp to long date format with time
 */
export declare function formatDateLong(timestamp: string | Date | number | null | undefined, config?: DateConfig): string;
/**
 * Formats a timestamp for POS tickets/receipts
 */
export declare function formatDateTimeTicket(timestamp: string | Date | number | null | undefined, config?: DateConfig): string;
/**
 * Formats a timestamp to compact time for UI
 */
export declare function formatTimeCompact(timestamp: string | Date | number | null | undefined, config?: DateConfig): string;
/**
 * Formats a timestamp for reports (dd/mm/yyyy hh:mm AM/PM)
 */
export declare function formatDateTimeReport(timestamp: string | Date | number | null | undefined, config?: DateConfig): string;
//# sourceMappingURL=dates.d.ts.map