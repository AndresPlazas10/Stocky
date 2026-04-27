import AsyncStorage from '@react-native-async-storage/async-storage';

const PRINTER_WIDTH_KEY = 'stocky_printer_paper_width_mm';
const AUTO_PRINT_RECEIPT_KEY = 'stocky_auto_print_receipt_enabled';
const ALLOWED_WIDTHS = new Set([58, 80]);
const DEFAULT_WIDTH = 80;
const DEFAULT_AUTO_PRINT_ENABLED = true;

export async function getThermalPaperWidthMm(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(PRINTER_WIDTH_KEY);
    const parsed = Number(raw);
    if (ALLOWED_WIDTHS.has(parsed)) return parsed;
    return DEFAULT_WIDTH;
  } catch {
    return DEFAULT_WIDTH;
  }
}

export async function setThermalPaperWidthMm(width: number): Promise<boolean> {
  const parsed = Number(width);
  if (!ALLOWED_WIDTHS.has(parsed)) return false;

  try {
    await AsyncStorage.setItem(PRINTER_WIDTH_KEY, String(parsed));
    return true;
  } catch {
    return false;
  }
}

export async function isAutoPrintReceiptEnabled(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(AUTO_PRINT_RECEIPT_KEY);
    if (raw === null) return DEFAULT_AUTO_PRINT_ENABLED;
    return raw === 'true';
  } catch {
    return DEFAULT_AUTO_PRINT_ENABLED;
  }
}

export async function setAutoPrintReceiptEnabled(enabled: boolean): Promise<boolean> {
  try {
    await AsyncStorage.setItem(AUTO_PRINT_RECEIPT_KEY, enabled ? 'true' : 'false');
    return true;
  } catch {
    return false;
  }
}
