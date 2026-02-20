const PRINTER_WIDTH_KEY = 'stocky_printer_paper_width_mm';
const AUTO_PRINT_RECEIPT_KEY = 'stocky_auto_print_receipt_enabled';
const ALLOWED_WIDTHS = new Set([58, 80]);
const DEFAULT_WIDTH = 80;

export const getThermalPaperWidthMm = () => {
  try {
    const raw = window.localStorage.getItem(PRINTER_WIDTH_KEY);
    const parsed = Number(raw);
    if (ALLOWED_WIDTHS.has(parsed)) return parsed;
    return DEFAULT_WIDTH;
  } catch {
    return DEFAULT_WIDTH;
  }
};

export const setThermalPaperWidthMm = (width) => {
  const parsed = Number(width);
  if (!ALLOWED_WIDTHS.has(parsed)) return false;
  try {
    window.localStorage.setItem(PRINTER_WIDTH_KEY, String(parsed));
    return true;
  } catch {
    return false;
  }
};

export const isAutoPrintReceiptEnabled = () => {
  try {
    return window.localStorage.getItem(AUTO_PRINT_RECEIPT_KEY) === 'true';
  } catch {
    return false;
  }
};

export const setAutoPrintReceiptEnabled = (enabled) => {
  try {
    window.localStorage.setItem(AUTO_PRINT_RECEIPT_KEY, enabled ? 'true' : 'false');
    return true;
  } catch {
    return false;
  }
};
