import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'http';
import {
  isPrintBridgeEnabled,
  getPrintBridgeEndpoint,
  getPrintBridgeToken,
  sendReceiptToPrintBridge,
  checkPrintBridgeStatus,
} from '../src/utils/printBridgeClient';

const ENABLED_KEY = 'stocky_print_bridge_enabled';
const ENDPOINT_KEY = 'stocky_print_bridge_endpoint';
const TOKEN_KEY = 'stocky_print_bridge_token';

const createLocalStorageMock = () => {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  };
};

const startMockBridge = ({ status = 200, body = { ok: true }, validate = null } = {}) => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => {
      if (validate) {
        const problem = validate(req, raw ? JSON.parse(raw) : {});
        if (problem) {
          res.writeHead(problem.status || 422, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: problem.message }));
          return;
        }
      }
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    });
  });
  server.listen(0, '127.0.0.1', () => resolve(server));
});

const bridgeUrl = (server) => `http://127.0.0.1:${server.address().port}`;

const sampleReceipt = {
  type: 'sale',
  version: 1,
  requiredSections: ['items', 'totals'],
  header: { title: 'COMPROBANTE', businessName: 'Test', dateText: '01/01/2026', alignment: 'center' },
  metadata: [],
  items: [{ name: 'Producto', quantity: 1, unitPrice: 100, subtotal: 100, subtotalText: '$100' }],
  totals: { subtotal: 100, subtotalText: '$100', voluntaryTip: 0, voluntaryTipText: '$0', total: 100, totalText: '$100' },
  payment: { method: 'cash', methodText: 'Efectivo' },
  footer: { message: 'Gracias', alignment: 'center' },
};

describe('printBridgeClient', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', { value: createLocalStorageMock(), configurable: true, writable: true });
    window.localStorage.clear();
    window.localStorage.setItem(ENABLED_KEY, 'true');
    window.localStorage.setItem(ENDPOINT_KEY, '');
    window.localStorage.setItem(TOKEN_KEY, 'token-test');
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('defaults the endpoint to 127.0.0.1:41780', () => {
    expect(getPrintBridgeEndpoint()).toBe('http://127.0.0.1:41780');
  });

  it('reports disabled bridge with bridge_disabled reason', async () => {
    window.localStorage.setItem(ENABLED_KEY, 'false');
    const result = await sendReceiptToPrintBridge({ receipt: sampleReceipt });
    expect(result).toEqual({ ok: false, fallback: true, reason: 'bridge_disabled' });
  });

  it('reports missing token with missing_bridge_token reason', async () => {
    window.localStorage.setItem(TOKEN_KEY, '');
    const result = await sendReceiptToPrintBridge({ receipt: sampleReceipt });
    expect(result).toEqual({ ok: false, fallback: true, reason: 'missing_bridge_token' });
  });

  it('sends receipt and returns ok on success', async () => {
    const server = await startMockBridge({
      validate: (req, payload) => {
        if (req.url !== '/v1/print') return { status: 404, message: 'not found' };
        if (req.headers['x-stocky-bridge-token'] !== 'token-test') return { status: 401, message: 'bad token' };
        if (payload.source !== 'stocky') return { status: 422, message: 'bad source' };
        if (payload.receipt?.type !== 'sale') return { status: 422, message: 'bad type' };
        if (!payload.receipt?.items?.length) return { status: 422, message: 'no items' };
        if (Number(payload.paperWidthMm) !== 80) return { status: 422, message: 'bad width' };
        return null;
      },
    });
    window.localStorage.setItem(ENDPOINT_KEY, bridgeUrl(server));
    try {
      const result = await sendReceiptToPrintBridge({ receipt: sampleReceipt, paperWidthMm: 80 });
      expect(result.ok).toBe(true);
    } finally {
      server.close();
    }
  });

  it('classifies a 401 as bridge_http_401', async () => {
    const server = await startMockBridge({ status: 401, body: { ok: false, error: 'Token invalido' } });
    window.localStorage.setItem(ENDPOINT_KEY, bridgeUrl(server));
    try {
      const result = await sendReceiptToPrintBridge({ receipt: sampleReceipt });
      expect(result).toEqual({ ok: false, fallback: true, reason: 'bridge_http_401' });
    } finally {
      server.close();
    }
  });

  it('classifies a 422 as bridge_http_422', async () => {
    const server = await startMockBridge({ status: 422, body: { ok: false, error: 'El recibo no tiene items' } });
    window.localStorage.setItem(ENDPOINT_KEY, bridgeUrl(server));
    try {
      const result = await sendReceiptToPrintBridge({ receipt: sampleReceipt });
      expect(result).toEqual({ ok: false, fallback: true, reason: 'bridge_http_422' });
    } finally {
      server.close();
    }
  });

  it('classifies an unreachable bridge as bridge_unavailable', async () => {
    window.localStorage.setItem(ENDPOINT_KEY, 'http://127.0.0.1:1');
    const result = await sendReceiptToPrintBridge({ receipt: sampleReceipt });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('bridge_unavailable');
  });

  it('checks bridge status and returns printer name', async () => {
    const server = await startMockBridge({
      body: { ok: true, enabled: true, name: 'XP-58', portPath: 'COM3', paperWidthMm: 58 },
    });
    window.localStorage.setItem(ENDPOINT_KEY, bridgeUrl(server));
    try {
      const result = await checkPrintBridgeStatus({ timeoutMs: 3000 });
      expect(result.ok).toBe(true);
      expect(result.name).toBe('XP-58');
      expect(result.portPath).toBe('COM3');
      expect(result.paperWidthMm).toBe(58);
    } finally {
      server.close();
    }
  });

  it('returns unavailable when status endpoint is unreachable', async () => {
    window.localStorage.setItem(ENDPOINT_KEY, 'http://127.0.0.1:1');
    const result = await checkPrintBridgeStatus({ timeoutMs: 3000 });
    expect(result.ok).toBe(false);
    expect(result.error).toBe('bridge_unavailable');
  });

  it('returns disabled state when bridge toggle is off', () => {
    window.localStorage.setItem(ENABLED_KEY, 'false');
    window.localStorage.setItem(TOKEN_KEY, '');
    expect(isPrintBridgeEnabled()).toBe(false);
    expect(getPrintBridgeToken()).toBe('');
  });
});
