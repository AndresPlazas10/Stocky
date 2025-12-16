/**
 * Formatea un número como precio en formato colombiano
 * Miles: punto (2.000)
 * Millones: apóstrofe (1'000.000)
 * Decimales: solo si no son .00
 * Ejemplo: 1200000 -> 1'200.000 COP
 * Ejemplo: 2000 -> 2.000 COP
 * Ejemplo: 1500.50 -> 1.500,50 COP
 * @param {number} value - El valor numérico a formatear
 * @param {boolean} includeCurrency - Si incluir "COP" al final (default: true)
 * @returns {string} - El precio formateado
 */
export const formatPrice = (value, includeCurrency = true) => {
  if (value === null || value === undefined || isNaN(value)) {
    return includeCurrency ? '0 COP' : '0';
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
  
  return includeCurrency ? `${formattedNumber} COP` : formattedNumber;
};

/**
 * Formatea un número sin símbolo de moneda
 * Ejemplo: 1200000 -> 1'200.000
 * Ejemplo: 2000 -> 2.000
 * @param {number} value - El valor numérico a formatear
 * @returns {string} - El número formateado
 */
export const formatNumber = (value) => {
  return formatPrice(value, false);
};

/**
 * Convierte un string formateado a número
 * Ejemplo: "1'200.000" -> 1200000
 * Ejemplo: "2.000" -> 2000
 * @param {string} formattedValue - El valor formateado
 * @returns {number} - El valor numérico
 */
export const parseFormattedNumber = (formattedValue) => {
  if (!formattedValue) return 0;
  
  // Remover apóstrofes, puntos de miles, "COP" y espacios
  const cleaned = formattedValue
    .replace(/'/g, '')
    .replace(/\./g, '')
    .replace(/,/g, '.')  // Coma decimal a punto
    .replace(/COP/g, '')
    .replace(/\s/g, '')
    .trim();
  
  return parseFloat(cleaned) || 0;
};

/**
 * Formatea una fecha/timestamp de PostgreSQL timestamptz a formato local
 * Maneja correctamente las fechas con timezone de Supabase
 * @param {string|Date} timestamp - Timestamp de PostgreSQL o objeto Date
 * @param {Object} options - Opciones de formato (default: fecha y hora colombiana)
 * @returns {string} - Fecha formateada o "Fecha inválida"
 */
export const formatDate = (timestamp, options = {}) => {
  // Validar entrada
  if (!timestamp || timestamp === null || timestamp === undefined) {
    console.warn('formatDate: timestamp vacío o null');
    return 'Sin fecha';
  }
  
  try {
    let date;
    
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
      console.error('formatDate: Tipo de dato no soportado ->', typeof timestamp, timestamp);
      return 'Formato inválido';
    }
    
    // Validar que la fecha sea válida
    if (isNaN(date.getTime())) {
      console.error('formatDate: Fecha inválida después de parsear ->', timestamp);
      return 'Fecha inválida';
    }
    
    const defaultOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Bogota',
      ...options
    };
    
    return date.toLocaleString('es-CO', defaultOptions);
  } catch (error) {
    console.error('formatDate: Error al formatear ->', error.message, timestamp);
    return 'Error de formato';
  }
};

/**
 * Formatea solo la fecha (sin hora)
 * @param {string|Date} timestamp - Timestamp de PostgreSQL o objeto Date
 * @returns {string} - Fecha formateada (ej: "15 dic 2025")
 */
export const formatDateOnly = (timestamp) => {
  if (!timestamp) {
    console.warn('formatDateOnly: timestamp vacío');
    return 'Fecha inválida';
  }
  
  try {
    const date = new Date(timestamp);
    
    if (isNaN(date.getTime())) {
      console.error('formatDateOnly: Fecha inválida ->', timestamp);
      return 'Fecha inválida';
    }
    
    return date.toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'America/Bogota'
    });
  } catch (error) {
    console.error('formatDateOnly: Error al formatear ->', error, timestamp);
    return 'Fecha inválida';
  }
};

/**
 * Formatea solo la hora
 * @param {string|Date} timestamp - Timestamp de PostgreSQL o objeto Date
 * @returns {string} - Hora formateada (ej: "14:30")
 */
export const formatTimeOnly = (timestamp) => {
  if (!timestamp) {
    console.warn('formatTimeOnly: timestamp vacío');
    return 'Hora inválida';
  }
  
  try {
    const date = new Date(timestamp);
    
    if (isNaN(date.getTime())) {
      console.error('formatTimeOnly: Fecha inválida ->', timestamp);
      return 'Hora inválida';
    }
    
    return date.toLocaleTimeString('es-CO', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Bogota'
    });
  } catch (error) {
    console.error('formatTimeOnly: Error al formatear ->', error, timestamp);
    return 'Hora inválida';
  }
};

/**
 * Formatea fecha en formato completo
 * @param {string|Date} timestamp - Timestamp de PostgreSQL o objeto Date
 * @returns {string} - Fecha formateada (ej: "15 de diciembre de 2025, 14:30")
 */
export const formatDateLong = (timestamp) => {
  if (!timestamp) {
    console.warn('formatDateLong: timestamp vacío');
    return 'Fecha inválida';
  }
  
  try {
    const date = new Date(timestamp);
    
    if (isNaN(date.getTime())) {
      console.error('formatDateLong: Fecha inválida ->', timestamp);
      return 'Fecha inválida';
    }
    
    return date.toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Bogota'
    });
  } catch (error) {
    console.error('formatDateLong: Error al formatear ->', error, timestamp);
    return 'Fecha inválida';
  }
};
