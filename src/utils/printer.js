const PRINTER_WIDTH_KEY = 'stocky_printer_paper_width_mm';
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

