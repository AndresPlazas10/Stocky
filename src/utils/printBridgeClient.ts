import { getThermalPaperWidthMm } from '@/utils/printer';

const PRINT_TIMEOUT_MS = 4500;
const STATUS_TIMEOUT_MS = 2000;
const DEFAULT_BRIDGE_ENDPOINT = 'http://127.0.0.1:41780';

const PRINT_BRIDGE_ENABLED_KEY = 'stocky_print_bridge_enabled';
const PRINT_BRIDGE_ENDPOINT_KEY = 'stocky_print_bridge_endpoint';
const PRINT_BRIDGE_TOKEN_KEY = 'stocky_print_bridge_token';

const withTimeout = async (promise: (signal: AbortSignal) => Promise<Response>, timeoutMs: number) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await promise(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
};

export const isPrintBridgeEnabled = (): boolean => {
  try {
    return window.localStorage.getItem(PRINT_BRIDGE_ENABLED_KEY) === 'true';
  } catch {
    return false;
  }
};

export const setPrintBridgeEnabled = (enabled: boolean): boolean => {
  try {
    window.localStorage.setItem(PRINT_BRIDGE_ENABLED_KEY, enabled ? 'true' : 'false');
    return true;
  } catch {
    return false;
  }
};

export const getPrintBridgeEndpoint = (): string => {
  try {
    const stored = String(window.localStorage.getItem(PRINT_BRIDGE_ENDPOINT_KEY) || '').trim();
    return stored || DEFAULT_BRIDGE_ENDPOINT;
  } catch {
    return DEFAULT_BRIDGE_ENDPOINT;
  }
};

export const setPrintBridgeEndpoint = (endpoint: string): boolean => {
  try {
    const normalized = String(endpoint || '').trim() || DEFAULT_BRIDGE_ENDPOINT;
    window.localStorage.setItem(PRINT_BRIDGE_ENDPOINT_KEY, normalized);
    return true;
  } catch {
    return false;
  }
};

export const getPrintBridgeToken = (): string => {
  try {
    return String(window.localStorage.getItem(PRINT_BRIDGE_TOKEN_KEY) || '').trim();
  } catch {
    return '';
  }
};

export const setPrintBridgeToken = (token: string): boolean => {
  try {
    window.localStorage.setItem(PRINT_BRIDGE_TOKEN_KEY, String(token || '').trim());
    return true;
  } catch {
    return false;
  }
};

export const getPrintBridgeSettings = () => ({
  enabled: isPrintBridgeEnabled(),
  endpoint: getPrintBridgeEndpoint(),
  token: getPrintBridgeToken(),
  paperWidthMm: getThermalPaperWidthMm(),
});

export const getBridgePrinterLabel = () => {
  const settings = getPrintBridgeSettings();
  if (!settings.enabled) return '';
  return `${settings.endpoint} (${settings.paperWidthMm}mm) - Stocky Print Bridge`;
};

export type BridgeStatus = {
  ok: boolean;
  enabled?: boolean;
  name?: string;
  portPath?: string;
  paperWidthMm?: number;
  error?: string;
};

export type PrintBridgeResult = {
  ok: boolean;
  data?: Record<string, unknown>;
  fallback?: boolean;
  reason?: string;
  error?: string;
};

export const checkPrintBridgeStatus = async ({ timeoutMs = STATUS_TIMEOUT_MS } = {}): Promise<BridgeStatus> => {
  const endpoint = getPrintBridgeEndpoint();

  try {
    const response = await withTimeout((signal) => fetch(`${endpoint}/v1/status`, {
      method: 'GET',
      signal,
    }), timeoutMs);

    if (!response.ok) {
      return { ok: false, error: `bridge_http_${response.status}` };
    }

    const data = await response.json().catch(() => ({}));
    return {
      ok: true,
      enabled: Boolean(data?.enabled),
      name: String(data?.name || ''),
      portPath: String(data?.portPath || ''),
      paperWidthMm: Number(data?.paperWidthMm || 0),
    };
  } catch (err) {
    return {
      ok: false,
      error: (err as Error)?.name === 'AbortError' ? 'bridge_timeout' : 'bridge_unavailable',
    };
  }
};

export const sendReceiptToPrintBridge = async ({
  receipt,
  paperWidthMm,
  timeoutMs = PRINT_TIMEOUT_MS,
}: {
  receipt: Record<string, unknown>;
  paperWidthMm?: number;
  timeoutMs?: number;
}): Promise<PrintBridgeResult> => {
  const settings = getPrintBridgeSettings();

  if (!settings.enabled) {
    return { ok: false, fallback: true, reason: 'bridge_disabled' };
  }

  if (!settings.token) {
    return { ok: false, fallback: true, reason: 'missing_bridge_token' };
  }

  const endpoint = String(settings.endpoint || '').replace(/\/+$/, '');
  if (!endpoint) {
    return { ok: false, fallback: true, reason: 'missing_bridge_endpoint' };
  }

  try {
    const response = await withTimeout((signal) => fetch(`${endpoint}/v1/print`, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        'X-Stocky-Bridge-Token': settings.token,
        'X-Stocky-Origin': window.location.origin,
      },
      body: JSON.stringify({
        source: 'stocky',
        paperWidthMm: Number(paperWidthMm || settings.paperWidthMm || 80),
        receipt,
      }),
    }), timeoutMs);

    if (!response.ok) {
      return { ok: false, fallback: true, reason: `bridge_http_${response.status}` };
    }

    const data = await response.json().catch(() => ({}));
    return { ok: true, data };
  } catch (err) {
    return {
      ok: false,
      fallback: true,
      reason: (err as Error)?.name === 'AbortError' ? 'bridge_timeout' : 'bridge_unavailable',
      error: (err as Error)?.message || String(err),
    };
  }
};
