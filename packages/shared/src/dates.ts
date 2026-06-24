const DEFAULT_TIMEZONE = 'America/Bogota';
const DEFAULT_LOCALE = 'es-CO';

/**
 * Formats a timestamp to a readable date/time string
 * @param timestamp - PostgreSQL timestamptz, Date object, or ISO string
 * @param options - Intl.DateTimeFormat options
 * @returns Formatted date string
 */
export function formatDate(
  timestamp: string | Date | number | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!timestamp) return 'Sin fecha';
  
  try {
    let date: Date;
    
    if (timestamp instanceof Date) {
      date = timestamp;
    } else if (typeof timestamp === 'string') {
      date = new Date(timestamp);
    } else if (typeof timestamp === 'number') {
      date = new Date(timestamp);
    } else {
      return 'Formato inválido';
    }
    
    if (isNaN(date.getTime())) {
      return 'Fecha inválida';
    }
    
    const defaultOptions: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: DEFAULT_TIMEZONE,
      ...options
    };
    
    return date.toLocaleString(DEFAULT_LOCALE, defaultOptions);
  } catch {
    return 'Error de formato';
  }
}

/**
 * Formats a timestamp to date only (no time)
 * @param timestamp - PostgreSQL timestamptz, Date object, or ISO string
 * @returns Formatted date string (e.g., "15 dic 2025")
 */
export function formatDateOnly(
  timestamp: string | Date | number | null | undefined
): string {
  if (!timestamp) return 'Fecha inválida';
  
  try {
    const date = new Date(timestamp);
    
    if (isNaN(date.getTime())) {
      return 'Fecha inválida';
    }
    
    return date.toLocaleDateString(DEFAULT_LOCALE, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: DEFAULT_TIMEZONE
    });
  } catch {
    return 'Fecha inválida';
  }
}

/**
 * Formats a timestamp to time only (12-hour format with AM/PM)
 * @param timestamp - PostgreSQL timestamptz, Date object, or ISO string
 * @returns Formatted time string (e.g., "02:30 PM")
 */
export function formatTimeOnly(
  timestamp: string | Date | number | null | undefined
): string {
  if (!timestamp) return 'Hora inválida';
  
  try {
    const date = new Date(timestamp);
    
    if (isNaN(date.getTime())) {
      return 'Hora inválida';
    }
    
    return date.toLocaleTimeString(DEFAULT_LOCALE, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: DEFAULT_TIMEZONE
    });
  } catch {
    return 'Hora inválida';
  }
}

/**
 * Formats a timestamp to long date format with time
 * @param timestamp - PostgreSQL timestamptz, Date object, or ISO string
 * @returns Formatted string (e.g., "15 de diciembre de 2025, 02:30 PM")
 */
export function formatDateLong(
  timestamp: string | Date | number | null | undefined
): string {
  if (!timestamp) return 'Fecha inválida';
  
  try {
    const date = new Date(timestamp);
    
    if (isNaN(date.getTime())) {
      return 'Fecha inválida';
    }
    
    return date.toLocaleDateString(DEFAULT_LOCALE, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: DEFAULT_TIMEZONE
    });
  } catch {
    return 'Fecha inválida';
  }
}

/**
 * Formats a timestamp for POS tickets/receipts
 * @param timestamp - PostgreSQL timestamptz, Date object, or ISO string
 * @returns Formatted string (e.g., "lunes, 15 de diciembre de 2025 - 02:30 PM")
 */
export function formatDateTimeTicket(
  timestamp: string | Date | number | null | undefined
): string {
  if (!timestamp) return 'Fecha inválida';
  
  try {
    const date = new Date(timestamp);
    
    if (isNaN(date.getTime())) {
      return 'Fecha inválida';
    }
    
    const dateOptions: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: DEFAULT_TIMEZONE
    };
    
    const timeOptions: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: DEFAULT_TIMEZONE
    };
    
    const datePart = date.toLocaleDateString(DEFAULT_LOCALE, dateOptions);
    const timePart = date.toLocaleTimeString(DEFAULT_LOCALE, timeOptions);
    
    return `${datePart} - ${timePart}`;
  } catch {
    return 'Fecha inválida';
  }
}

/**
 * Formats a timestamp to compact time for UI
 * @param timestamp - PostgreSQL timestamptz, Date object, or ISO string
 * @returns Formatted time string (e.g., "2:30 PM")
 */
export function formatTimeCompact(
  timestamp: string | Date | number | null | undefined
): string {
  if (!timestamp) return 'Hora inválida';
  
  try {
    const date = new Date(timestamp);
    
    if (isNaN(date.getTime())) {
      return 'Hora inválida';
    }
    
    return date.toLocaleTimeString(DEFAULT_LOCALE, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: DEFAULT_TIMEZONE
    });
  } catch {
    return 'Hora inválida';
  }
}

/**
 * Formats a timestamp for reports (dd/mm/yyyy hh:mm AM/PM)
 * @param timestamp - PostgreSQL timestamptz, Date object, or ISO string
 * @returns Formatted string (e.g., "15/12/2025 02:30 PM")
 */
export function formatDateTimeReport(
  timestamp: string | Date | number | null | undefined
): string {
  if (!timestamp) return 'Fecha inválida';
  
  try {
    const date = new Date(timestamp);
    
    if (isNaN(date.getTime())) {
      return 'Fecha inválida';
    }
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    
    const timeFormatted = date.toLocaleTimeString(DEFAULT_LOCALE, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: DEFAULT_TIMEZONE
    });
    
    return `${day}/${month}/${year} ${timeFormatted}`;
  } catch {
    return 'Fecha inválida';
  }
}
