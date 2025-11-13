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
