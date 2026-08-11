import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { printSaleReceipt } from '../src/utils/saleReceiptPrint';
import { printKitchenOrder } from '../src/utils/kitchenOrderPrint';
import { buildKitchenReceiptTemplate } from '../src/utils/receiptTemplate';

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

const installLocalStorageMock = () => {
  Object.defineProperty(window, 'localStorage', { value: createLocalStorageMock(), configurable: true, writable: true });
};

const sale = { id: 's-1', total: 10000, payment_method: 'cash', created_at: '2026-01-01T10:00:00Z' };
const saleDetails = [
  { quantity: 1, unit_price: 10000, subtotal: 10000, products: { name: 'Producto A', category: 'plato' } },
];

const createFakePrintWindow = () => {
  const win = {
    document: { write: vi.fn(), close: vi.fn() },
    print: vi.fn(() => { win.closed = true; }),
    focus: vi.fn(),
    close: vi.fn(),
    closed: false,
  };
  return win;
};

const enableBridge = () => {
  window.localStorage.setItem(ENABLED_KEY, 'true');
  window.localStorage.setItem(ENDPOINT_KEY, 'http://127.0.0.1:1');
  window.localStorage.setItem(TOKEN_KEY, 'token-test');
};

describe('printSaleReceipt fallback behavior', () => {
  beforeEach(() => {
    installLocalStorageMock();
    window.localStorage.clear();
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('connect ECONNREFUSED'))));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it('prints via the browser when the bridge is disabled', async () => {
    const fakeWin = createFakePrintWindow();
    const openSpy = vi.fn(() => fakeWin);
    vi.stubGlobal('open', openSpy);

    const result = await printSaleReceipt({ sale, saleDetails });

    expect(result.ok).toBe(true);
    expect(result.via).toBe('browser');
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(fakeWin.document.write).toHaveBeenCalled();
    expect(fakeWin.print).toHaveBeenCalled();
  });

  it('falls back to the browser print dialog when the bridge is unreachable', async () => {
    enableBridge();
    const fakeWin = createFakePrintWindow();
    vi.stubGlobal('open', vi.fn(() => fakeWin));

    const result = await printSaleReceipt({ sale, saleDetails });

    expect(result.ok).toBe(true);
    expect(result.via).toBe('browser');
    expect(result.fallbackReason).toBe('bridge_unavailable');
    expect(fakeWin.print).toHaveBeenCalled();
  });

  it('returns bridge success without opening a print window', async () => {
    enableBridge();
    const openSpy = vi.fn(() => createFakePrintWindow());
    vi.stubGlobal('open', openSpy);
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
    })));

    const result = await printSaleReceipt({ sale, saleDetails });

    expect(result.ok).toBe(true);
    expect(result.via).toBe('bridge');
    expect(result.printerLabel).toContain('Stocky Print Bridge');
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('returns an error when the print window is blocked', async () => {
    vi.stubGlobal('open', vi.fn(() => null));

    const result = await printSaleReceipt({ sale, saleDetails });

    expect(result.ok).toBe(false);
    expect(result.error).toContain('bloqueó');
  });
});

describe('printKitchenOrder fallback behavior', () => {
  const kitchenItems = [
    { quantity: 2, products: { name: 'Bandeja paisa', category: 'plato' } },
    { quantity: 1, combos: { nombre: 'Combo familiar' } },
  ];

  beforeEach(() => {
    installLocalStorageMock();
    window.localStorage.clear();
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('connect ECONNREFUSED'))));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it('prints via the browser when the bridge is disabled', async () => {
    const fakeWin = createFakePrintWindow();
    const openSpy = vi.fn(() => fakeWin);
    vi.stubGlobal('open', openSpy);
    const onBridgeFallback = vi.fn();

    await printKitchenOrder({
      itemsParaCocina: kitchenItems,
      tableNumber: 3,
      status: 'occupied',
      orderTotal: 25000,
      onBridgeFallback,
    });

    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(fakeWin.print).toHaveBeenCalled();
    expect(onBridgeFallback).not.toHaveBeenCalled();
  });

  it('falls back to the browser when the bridge is unreachable', async () => {
    enableBridge();
    const fakeWin = createFakePrintWindow();
    vi.stubGlobal('open', vi.fn(() => fakeWin));
    const onBridgeFallback = vi.fn();

    await printKitchenOrder({
      itemsParaCocina: kitchenItems,
      tableNumber: 3,
      status: 'occupied',
      orderTotal: 25000,
      onBridgeFallback,
    });

    expect(onBridgeFallback).toHaveBeenCalledWith('bridge_unavailable');
    expect(fakeWin.print).toHaveBeenCalled();
  });

  it('notifies success when the bridge prints the kitchen order', async () => {
    enableBridge();
    vi.stubGlobal('open', vi.fn(() => createFakePrintWindow()));
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
    })));
    const onBridgeFallback = vi.fn();
    const onBridgeSuccess = vi.fn();

    await printKitchenOrder({
      itemsParaCocina: kitchenItems,
      tableNumber: 3,
      status: 'occupied',
      orderTotal: 25000,
      onBridgeFallback,
      onBridgeSuccess,
    });

    expect(onBridgeSuccess).toHaveBeenCalled();
    expect(onBridgeFallback).not.toHaveBeenCalled();
  });
});

describe('buildKitchenReceiptTemplate', () => {
  it('builds a kitchen receipt with the bridge contract', () => {
    const receipt = buildKitchenReceiptTemplate({
      itemsParaCocina: [
        { quantity: 2, products: { name: 'Bandeja paisa' } },
        { quantity: 1, combos: { nombre: 'Combo familiar' } },
      ],
      tableNumber: 5,
      status: 'occupied',
      orderTotal: 30000,
    });

    expect(receipt.type).toBe('kitchen');
    expect(receipt.requiredSections).toEqual(['items']);
    expect(receipt.items).toHaveLength(2);
    expect(receipt.items[0]).toEqual({
      name: 'Bandeja paisa',
      quantity: 2,
      unitPrice: 0,
      subtotal: 0,
      subtotalText: '',
    });
    expect(receipt.items[1].name).toBe('Combo familiar');
    expect(receipt.metadata).toEqual([
      { label: 'Mesa', value: '#5' },
      { label: 'Estado', value: 'Ocupada' },
      { label: 'Productos', value: '3' },
    ]);
    expect(receipt.totals.total).toBe(30000);
  });
});
