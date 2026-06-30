/**
 * Formatea un número como precio en formato colombiano
 * Miles: punto (2.000)
 * Millones: apóstrofe (1'000.000)
 * Decimales: solo si no son .00
 * Ejemplo: 1200000 -> $1'200.000
 * Ejemplo: 2000 -> $2.000
 * Ejemplo: 1500.50 -> $1.500,50
 */
export const formatPrice = (value: number | null | undefined, includeCurrency: boolean = true): string => {
  if (value === null || value === undefined || isNaN(value)) {
    return includeCurrency ? '$0' : '0';
  }

  const numValue = Number(value);
  
  // Separar parte entera y decimal
  const [integerPart, decimalPart] = numValue.toFixed(2).split('.');
  
  // Formatear parte entera:
  // - Punto (.) para miles (cada 3 dígitos)
  // - Apóstrofe (') para millones (cada 6 dígitos desde la derecha)
  let formattedInteger = integerPart;
  
  // Si tiene más de 6 dígitos (millones), usar apóstrofe para separar millones
  if (integerPart.length > 6) {
    // Separar millones del resto
    const millions = integerPart.slice(0, -6);
    const remainder = integerPart.slice(-6);
    
    // Formatear la parte de miles dentro de millones y el resto
    const formattedMillions = millions.replace(/\B(?=(\d{3})+(?!\d))/g, "'");
    const formattedRemainder = remainder.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    
    formattedInteger = `${formattedMillions}'${formattedRemainder}`;
  } else {
    // Solo miles, usar punto
    formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }
  
  // Solo agregar decimales si no son .00
  let formattedNumber = formattedInteger;
  if (decimalPart !== '00') {
    formattedNumber = `${formattedInteger},${decimalPart}`;
  }
  
  return includeCurrency ? `$${formattedNumber}` : formattedNumber;
};

/**
 * Formatea un número sin símbolo de moneda
 * Ejemplo: 1200000 -> 1'200.000
 * Ejemplo: 2000 -> 2.000
 */
export const formatNumber = (value: number | null | undefined): string => {
  return formatPrice(value, false);
};

/**
 * Convierte entradas de precio comunes en número.
 * Soporta:
 * - Miles con punto: "5.000" -> 5000
 * - Miles con coma: "5,000" -> 5000
 * - Formato es-CO: "1.500,50" -> 1500.5
 * - Formato en-US: "1500.50" -> 1500.5
 */
export const parsePriceInput = (value: string | number | null | undefined, fallback: number = 0): number => {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;

  const raw = String(value)
    .trim()
    .replace(/\s/g, '')
    .replace(/COP/gi, '')
    .replace(/\$/g, '')
    .replace(/'/g, '');

  if (!raw) return fallback;

  const hasDot = raw.includes('.');
  const hasComma = raw.includes(',');

  if (hasDot && hasComma) {
    const parsed = Number(raw.replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  if (hasDot) {
    const dotThousandsPattern = /^\d{1,3}(\.\d{3})+$/;
    const parsed = dotThousandsPattern.test(raw)
      ? Number(raw.replace(/\./g, ''))
      : Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  if (hasComma) {
    const commaThousandsPattern = /^\d{1,3}(,\d{3})+$/;
    const parsed = commaThousandsPattern.test(raw)
      ? Number(raw.replace(/,/g, ''))
      : Number(raw.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/**
 * Convierte un string formateado a número
 * Ejemplo: "1'200.000" -> 1200000
 * Ejemplo: "2.000" -> 2000
 */
export const parseFormattedNumber = (formattedValue: string | null | undefined): number => {
  return parsePriceInput(formattedValue, 0);
};

/**
 * Formatea una fecha/timestamp de PostgreSQL timestamptz a formato local
 * Maneja correctamente las fechas con timezone de Supabase
 */
export const formatDate = (timestamp: string | Date | number | null | undefined, options: Intl.DateTimeFormatOptions = {}): string => {
  // Validar entrada
  if (!timestamp || timestamp === null || timestamp === undefined) {
    
    return 'Sin fecha';
  }
  
  try {
    let date: Date;
    
    // Manejar diferentes formatos de entrada
    if (timestamp instanceof Date) {
      date = timestamp;
    } else if (typeof timestamp === 'string') {
      // PostgreSQL timestamptz viene en formato ISO: "2025-12-15T19:30:00+00:00"
      // JavaScript's new Date() maneja esto correctamente
      date = new Date(timestamp);
    } else if (typeof timestamp === 'number') {
      // Timestamp en milisegundos
      date = new Date(timestamp);
    } else {
      
      return 'Formato inválido';
    }
    
    // Validar que la fecha sea válida
    if (isNaN(date.getTime())) {
      
      return 'Fecha inválida';
    }
    
    const defaultOptions: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true, // Formato de 12 horas con AM/PM
      timeZone: 'America/Bogota',
      ...options
    };
    
    return date.toLocaleString('es-CO', defaultOptions);
  } catch {
    
    return 'Error de formato';
  }
};

/**
 * Formatea solo la fecha (sin hora)
 */
export const formatDateOnly = (timestamp: string | Date | number | null | undefined): string => {
  if (!timestamp) {
    
    return 'Fecha inválida';
  }
  
  try {
    const date = new Date(timestamp as string | number);
    
    if (isNaN(date.getTime())) {
      
      return 'Fecha inválida';
    }
    
    return date.toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'America/Bogota'
    });
  } catch {
    
    return 'Fecha inválida';
  }
};

/**
 * Formatea solo la hora en formato de 12 horas con AM/PM
 */
export const formatTimeOnly = (timestamp: string | Date | number | null | undefined): string => {
  if (!timestamp) {
    
    return 'Hora inválida';
  }
  
  try {
    const date = new Date(timestamp as string | number);
    
    if (isNaN(date.getTime())) {
      
      return 'Hora inválida';
    }
    
    return date.toLocaleTimeString('es-CO', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true, // Formato de 12 horas con AM/PM
      timeZone: 'America/Bogota'
    });
  } catch {
    
    return 'Hora inválida';
  }
};

/**
 * Formatea fecha en formato completo con hora de 12 horas
 */
export const formatDateLong = (timestamp: string | Date | number | null | undefined): string => {
  if (!timestamp) {
    
    return 'Fecha inválida';
  }
  
  try {
    const date = new Date(timestamp as string | number);
    
    if (isNaN(date.getTime())) {
      
      return 'Fecha inválida';
    }
    
    return date.toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true, // Formato de 12 horas con AM/PM
      timeZone: 'America/Bogota'
    });
  } catch {
    
    return 'Fecha inválida';
  }
};

/**
 * Formatea fecha y hora completa para tickets y recibos
 * Formato legible para impresiones POS
 */
export const formatDateTimeTicket = (timestamp: string | Date | number | null | undefined): string => {
  if (!timestamp) {
    return 'Fecha inválida';
  }
  
  try {
    const date = new Date(timestamp as string | number);
    
    if (isNaN(date.getTime())) {
      return 'Fecha inválida';
    }
    
    const dateOptions: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'America/Bogota'
    };
    
    const timeOptions: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/Bogota'
    };
    
    const datePart = date.toLocaleDateString('es-CO', dateOptions);
    const timePart = date.toLocaleTimeString('es-CO', timeOptions);
    
    return `${datePart} - ${timePart}`;
  } catch {
    return 'Fecha inválida';
  }
};

/**
 * Formatea solo la hora de forma compacta para UI
 */
export const formatTimeCompact = (timestamp: string | Date | number | null | undefined): string => {
  if (!timestamp) {
    return 'Hora inválida';
  }
  
  try {
    const date = new Date(timestamp as string | number);
    
    if (isNaN(date.getTime())) {
      return 'Hora inválida';
    }
    
    return date.toLocaleTimeString('es-CO', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/Bogota'
    });
  } catch {
    return 'Hora inválida';
  }
};

/**
 * Formatea fecha y hora de forma completa para reportes
 */
export const toFiniteNumber = (value, fallback = 0) => { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; };

export const formatDateTimeReport = (timestamp: string | Date | number | null | undefined): string => {
  if (!timestamp) {
    return 'Fecha inválida';
  }
  
  try {
    const date = new Date(timestamp as string | number);
    
    if (isNaN(date.getTime())) {
      return 'Fecha inválida';
    }
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    
    const timeFormatted = date.toLocaleTimeString('es-CO', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/Bogota'
    });
    
    return `${day}/${month}/${year} ${timeFormatted}`;
  } catch {
    return 'Fecha inválida';
  }
};
