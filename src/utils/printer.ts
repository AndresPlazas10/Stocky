const PRINTER_WIDTH_KEY = 'stocky_printer_paper_width_mm';
const AUTO_PRINT_RECEIPT_KEY = 'stocky_auto_print_receipt_enabled';
const AUTO_CUT_KEY = 'stocky_printer_auto_cut_enabled';
const PRINTER_BAUD_RATE_KEY = 'stocky_printer_baud_rate';
const ALLOWED_WIDTHS = new Set([58, 80, 104]);
const DEFAULT_WIDTH = 58;
const ALLOWED_BAUD_RATES = new Set([9600, 19200, 38400, 115200]);
const DEFAULT_BAUD_RATE = 9600;

export const getPrinterBaudRate = (): number => {
  try {
    const raw = window.localStorage.getItem(PRINTER_BAUD_RATE_KEY);
    const parsed = Number(raw);
    if (ALLOWED_BAUD_RATES.has(parsed)) return parsed;
    return DEFAULT_BAUD_RATE;
  } catch {
    return DEFAULT_BAUD_RATE;
  }
};

export const setPrinterBaudRate = (baudRate: number): boolean => {
  const parsed = Number(baudRate);
  if (!ALLOWED_BAUD_RATES.has(parsed)) return false;
  try {
    window.localStorage.setItem(PRINTER_BAUD_RATE_KEY, String(parsed));
    return true;
  } catch {
    return false;
  }
};

export const getThermalPaperWidthMm = (): number => {
  try {
    const raw = window.localStorage.getItem(PRINTER_WIDTH_KEY);
    const parsed = Number(raw);
    if (ALLOWED_WIDTHS.has(parsed)) return parsed;
    return DEFAULT_WIDTH;
  } catch {
    return DEFAULT_WIDTH;
  }
};

export const setThermalPaperWidthMm = (width: number): boolean => {
  const parsed = Number(width);
  if (!ALLOWED_WIDTHS.has(parsed)) return false;
  try {
    window.localStorage.setItem(PRINTER_WIDTH_KEY, String(parsed));
    return true;
  } catch {
    return false;
  }
};

export const isAutoPrintReceiptEnabled = (): boolean => {
  try {
    const stored = window.localStorage.getItem(AUTO_PRINT_RECEIPT_KEY);
    if (stored === null) return true;
    return stored === 'true';
  } catch {
    return true;
  }
};

export const setAutoPrintReceiptEnabled = (enabled: boolean): boolean => {
  try {
    window.localStorage.setItem(AUTO_PRINT_RECEIPT_KEY, enabled ? 'true' : 'false');
    return true;
  } catch {
    return false;
  }
};

export const isAutoCutEnabled = (): boolean => {
  try {
    const stored = window.localStorage.getItem(AUTO_CUT_KEY);
    if (stored === null) return false;
    return stored === 'true';
  } catch {
    return false;
  }
};

export const setAutoCutEnabled = (enabled: boolean): boolean => {
  try {
    window.localStorage.setItem(AUTO_CUT_KEY, enabled ? 'true' : 'false');
    return true;
  } catch {
    return false;
  }
};
