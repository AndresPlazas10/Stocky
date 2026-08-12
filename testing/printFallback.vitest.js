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

describe('impresion via dialogo del navegador (driver del sistema)', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', { value: createLocalStorageMock(), configurable: true, writable: true });
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it('printSaleReceipt abre el dialogo del navegador con el recibo', async () => {
    const fakeWin = createFakePrintWindow();
    const openSpy = vi.fn(() => fakeWin);
    vi.stubGlobal('open', openSpy);

    const result = await printSaleReceipt({ sale, saleDetails });

    expect(result.ok).toBe(true);
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(fakeWin.document.write).toHaveBeenCalled();
    expect(fakeWin.print).toHaveBeenCalled();
  });

  it('printKitchenOrder abre el dialogo del navegador con la orden', async () => {
    const fakeWin = createFakePrintWindow();
    vi.stubGlobal('open', vi.fn(() => fakeWin));

    await printKitchenOrder({
      itemsParaCocina: [{ quantity: 2, products: { name: 'Bandeja paisa', category: 'plato' } }],
      tableNumber: 3,
      status: 'occupied',
      orderTotal: 20000,
    });

    expect(fakeWin.print).toHaveBeenCalled();
  });

  it('devuelve error cuando la ventana de impresion esta bloqueada', async () => {
    vi.stubGlobal('open', vi.fn(() => null));

    const result = await printSaleReceipt({ sale, saleDetails });

    expect(result.ok).toBe(false);
    expect(result.error).toContain('bloqueó');
  });
});
