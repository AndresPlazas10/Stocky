const PRINTER_WIDTH_KEY = 'stocky_printer_paper_width_mm';
const AUTO_PRINT_RECEIPT_KEY = 'stocky_auto_print_receipt_enabled';
const PRINT_BRIDGE_ENABLED_KEY = 'stocky_print_bridge_enabled';
const PRINT_BRIDGE_ENDPOINT_KEY = 'stocky_print_bridge_endpoint';
const PRINT_BRIDGE_TOKEN_KEY = 'stocky_print_bridge_token';
const PRINT_BRIDGE_PRINTER_NAME_KEY = 'stocky_print_bridge_printer_name';
const ALLOWED_WIDTHS = new Set([58, 80, 104]);
const DEFAULT_WIDTH = 80;
const DEFAULT_BRIDGE_ENDPOINT = 'http://127.0.0.1:41780';

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
    const stored = window.localStorage.getItem(AUTO_PRINT_RECEIPT_KEY);
    if (stored === null) return true;
    return stored === 'true';
  } catch {
    return true;
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

export const isPrintBridgeEnabled = () => {
  try {
    return window.localStorage.getItem(PRINT_BRIDGE_ENABLED_KEY) === 'true';
  } catch {
    return false;
  }
};

export const setPrintBridgeEnabled = (enabled) => {
  try {
    window.localStorage.setItem(PRINT_BRIDGE_ENABLED_KEY, enabled ? 'true' : 'false');
    return true;
  } catch {
    return false;
  }
};

export const getPrintBridgeEndpoint = () => {
  try {
    const stored = String(window.localStorage.getItem(PRINT_BRIDGE_ENDPOINT_KEY) || '').trim();
    return stored || DEFAULT_BRIDGE_ENDPOINT;
  } catch {
    return DEFAULT_BRIDGE_ENDPOINT;
  }
};

export const setPrintBridgeEndpoint = (endpoint) => {
  try {
    const normalized = String(endpoint || '').trim() || DEFAULT_BRIDGE_ENDPOINT;
    window.localStorage.setItem(PRINT_BRIDGE_ENDPOINT_KEY, normalized);
    return true;
  } catch {
    return false;
  }
};

export const getPrintBridgeToken = () => {
  try {
    return String(window.localStorage.getItem(PRINT_BRIDGE_TOKEN_KEY) || '').trim();
  } catch {
    return '';
  }
};

export const setPrintBridgeToken = (token) => {
  try {
    window.localStorage.setItem(PRINT_BRIDGE_TOKEN_KEY, String(token || '').trim());
    return true;
  } catch {
    return false;
  }
};

export const getConfiguredPrinterName = () => {
  try {
    return String(window.localStorage.getItem(PRINT_BRIDGE_PRINTER_NAME_KEY) || '').trim();
  } catch {
    return '';
  }
};

export const setConfiguredPrinterName = (printerName) => {
  try {
    window.localStorage.setItem(PRINT_BRIDGE_PRINTER_NAME_KEY, String(printerName || '').trim());
    return true;
  } catch {
    return false;
  }
};

export const getPrintBridgeSettings = () => ({
  enabled: isPrintBridgeEnabled(),
  endpoint: getPrintBridgeEndpoint(),
  token: getPrintBridgeToken(),
  printerName: getConfiguredPrinterName(),
  paperWidthMm: getThermalPaperWidthMm(),
});
