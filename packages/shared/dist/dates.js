const DEFAULT_TIMEZONE = 'America/Bogota';
const DEFAULT_LOCALE = 'es-CO';
function getFallbacks(locale) {
    const isEnglish = (locale || '').startsWith('en');
    return {
        noDate: isEnglish ? 'No date' : 'Sin fecha',
        invalidFormat: isEnglish ? 'Invalid format' : 'Formato inválido',
        invalidDate: isEnglish ? 'Invalid date' : 'Fecha inválida',
        invalidTime: isEnglish ? 'Invalid time' : 'Hora inválida',
        formatError: isEnglish ? 'Format error' : 'Error de formato',
    };
}
/**
 * Formats a timestamp to a readable date/time string
 * @param timestamp - PostgreSQL timestamptz, Date object, or ISO string
 * @param options - Intl.DateTimeFormat options
 * @param config - Timezone and locale configuration
 * @returns Formatted date string
 */
export function formatDate(timestamp, options, config) {
    const timezone = config?.timezone || DEFAULT_TIMEZONE;
    const locale = config?.locale || DEFAULT_LOCALE;
    const fb = getFallbacks(locale);
    if (!timestamp)
        return fb.noDate;
    try {
        let date;
        if (timestamp instanceof Date) {
            date = timestamp;
        }
        else if (typeof timestamp === 'string') {
            date = new Date(timestamp);
        }
        else if (typeof timestamp === 'number') {
            date = new Date(timestamp);
        }
        else {
            return fb.invalidFormat;
        }
        if (isNaN(date.getTime())) {
            return fb.invalidDate;
        }
        const defaultOptions = {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
            timeZone: timezone,
            ...options
        };
        return date.toLocaleString(locale, defaultOptions);
    }
    catch {
        return fb.formatError;
    }
}
/**
 * Formats a timestamp to date only (no time)
 */
export function formatDateOnly(timestamp, config) {
    const timezone = config?.timezone || DEFAULT_TIMEZONE;
    const locale = config?.locale || DEFAULT_LOCALE;
    const fb = getFallbacks(locale);
    if (!timestamp)
        return fb.invalidDate;
    try {
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) {
            return fb.invalidDate;
        }
        return date.toLocaleDateString(locale, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            timeZone: timezone
        });
    }
    catch {
        return fb.invalidDate;
    }
}
/**
 * Formats a timestamp to time only (12-hour format with AM/PM)
 */
export function formatTimeOnly(timestamp, config) {
    const timezone = config?.timezone || DEFAULT_TIMEZONE;
    const locale = config?.locale || DEFAULT_LOCALE;
    const fb = getFallbacks(locale);
    if (!timestamp)
        return fb.invalidTime;
    try {
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) {
            return fb.invalidTime;
        }
        return date.toLocaleTimeString(locale, {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
            timeZone: timezone
        });
    }
    catch {
        return fb.invalidTime;
    }
}
/**
 * Formats a timestamp to long date format with time
 */
export function formatDateLong(timestamp, config) {
    const timezone = config?.timezone || DEFAULT_TIMEZONE;
    const locale = config?.locale || DEFAULT_LOCALE;
    const fb = getFallbacks(locale);
    if (!timestamp)
        return fb.invalidDate;
    try {
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) {
            return fb.invalidDate;
        }
        return date.toLocaleDateString(locale, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
            timeZone: timezone
        });
    }
    catch {
        return fb.invalidDate;
    }
}
/**
 * Formats a timestamp for POS tickets/receipts
 */
export function formatDateTimeTicket(timestamp, config) {
    const timezone = config?.timezone || DEFAULT_TIMEZONE;
    const locale = config?.locale || DEFAULT_LOCALE;
    const fb = getFallbacks(locale);
    if (!timestamp)
        return fb.invalidDate;
    try {
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) {
            return fb.invalidDate;
        }
        const dateOptions = {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: timezone
        };
        const timeOptions = {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
            timeZone: timezone
        };
        const datePart = date.toLocaleDateString(locale, dateOptions);
        const timePart = date.toLocaleTimeString(locale, timeOptions);
        return `${datePart} - ${timePart}`;
    }
    catch {
        return fb.invalidDate;
    }
}
/**
 * Formats a timestamp to compact time for UI
 */
export function formatTimeCompact(timestamp, config) {
    const timezone = config?.timezone || DEFAULT_TIMEZONE;
    const locale = config?.locale || DEFAULT_LOCALE;
    const fb = getFallbacks(locale);
    if (!timestamp)
        return fb.invalidTime;
    try {
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) {
            return fb.invalidTime;
        }
        return date.toLocaleTimeString(locale, {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
            timeZone: timezone
        });
    }
    catch {
        return fb.invalidTime;
    }
}
/**
 * Formats a timestamp for reports (dd/mm/yyyy hh:mm AM/PM)
 */
export function formatDateTimeReport(timestamp, config) {
    const timezone = config?.timezone || DEFAULT_TIMEZONE;
    const locale = config?.locale || DEFAULT_LOCALE;
    const fb = getFallbacks(locale);
    if (!timestamp)
        return fb.invalidDate;
    try {
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) {
            return fb.invalidDate;
        }
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const timeFormatted = date.toLocaleTimeString(locale, {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
            timeZone: timezone
        });
        return `${day}/${month}/${year} ${timeFormatted}`;
    }
    catch {
        return fb.invalidDate;
    }
}
//# sourceMappingURL=dates.js.map