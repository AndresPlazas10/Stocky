import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { printSaleReceipt } from '../src/utils/saleReceiptPrint';
import { printKitchenOrder } from '../src/utils/kitchenOrderPrint';

const createLocalStorageMock = () => {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  };
};

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

const sale = { id: 's-1', total: 10000, payment_method: 'cash', created_at: '2026-01-01T10:00:00Z' };
const saleDetails = [
  { quantity: 1, unit_price: 10000, subtotal: 10000, products: { name: 'Producto A', category: 'plato' } },
];

describe('print fallback to browser dialog (sin impresora configurada)', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', { value: createLocalStorageMock(), configurable: true, writable: true });
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it('printSaleReceipt cae al dialogo del navegador sin impresora', async () => {
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

  it('printKitchenOrder cae al dialogo del navegador sin impresora', async () => {
    const fakeWin = createFakePrintWindow();
    vi.stubGlobal('open', vi.fn(() => fakeWin));
    const onBridgeFallback = vi.fn();

    await printKitchenOrder({
      itemsParaCocina: [{ quantity: 2, products: { name: 'Bandeja paisa', category: 'plato' } }],
      tableNumber: 3,
      status: 'occupied',
      orderTotal: 20000,
      onBridgeFallback,
    });

    expect(fakeWin.print).toHaveBeenCalled();
    expect(onBridgeFallback).not.toHaveBeenCalled();
  });

  it('devuelve error cuando la ventana de impresion esta bloqueada', async () => {
    vi.stubGlobal('open', vi.fn(() => null));

    const result = await printSaleReceipt({ sale, saleDetails });

    expect(result.ok).toBe(false);
    expect(result.error).toContain('bloqueó');
  });
});
