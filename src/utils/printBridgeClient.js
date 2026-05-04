import { getPrintBridgeSettings } from './printer.js';

const PRINT_TIMEOUT_MS = 4500;

const withTimeout = async (promise, timeoutMs = PRINT_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await promise(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
};

export const getBridgePrinterLabel = () => {
  const settings = getPrintBridgeSettings();
  if (!settings.enabled) return '';

  const printerName = settings.printerName || 'Impresora configurada';
  return `${printerName} ${settings.paperWidthMm}mm - Stocky Print Bridge`;
};

export const sendReceiptToPrintBridge = async ({ receipt, paperWidthMm }) => {
  const settings = getPrintBridgeSettings();

  if (!settings.enabled) {
    return { ok: false, fallback: true, reason: 'bridge_disabled' };
  }

  if (!settings.token) {
    return { ok: false, fallback: false, reason: 'missing_bridge_token' };
  }

  const endpoint = String(settings.endpoint || '').replace(/\/+$/, '');
  if (!endpoint) {
    return { ok: false, fallback: false, reason: 'missing_bridge_endpoint' };
  }

  try {
    const response = await withTimeout((signal) => fetch(`${endpoint}/v1/print`, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'text/plain',
      },
      body: JSON.stringify({
        source: 'stocky',
        token: settings.token,
        paperWidthMm: Number(paperWidthMm || settings.paperWidthMm || 80),
        receipt,
      }),
    }));

    if (!response.ok) {
      return { ok: false, fallback: false, reason: `bridge_http_${response.status}` };
    }

    const data = await response.json().catch(() => ({}));
    return { ok: true, data };
  } catch (err) {
    return {
      ok: false,
      fallback: false,
      reason: err?.name === 'AbortError' ? 'bridge_timeout' : 'bridge_unavailable',
      error: err?.message || String(err),
    };
  }
};

export const checkPrintBridgeStatus = async () => {
  const settings = getPrintBridgeSettings();
  if (!settings.enabled) return { ok: false, reason: 'bridge_disabled' };

  const endpoint = String(settings.endpoint || '').replace(/\/+$/, '');
  if (!endpoint) return { ok: false, reason: 'missing_bridge_endpoint' };

  try {
    const response = await withTimeout((signal) => fetch(`${endpoint}/v1/status`, {
      method: 'GET',
      signal,
    }), 2500);

    const data = await response.json().catch(() => ({}));
    return response.ok
      ? { ok: true, data }
      : { ok: false, reason: `bridge_http_${response.status}`, data };
  } catch (err) {
    return {
      ok: false,
      reason: err?.name === 'AbortError' ? 'bridge_timeout' : 'bridge_unavailable',
      error: err?.message || String(err),
    };
  }
};
