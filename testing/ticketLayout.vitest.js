import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  buildTicketHtml,
  estimateTicketHeightMm,
  getBaseFontPx,
  getReceiptColumns,
  getTicketPrintableHeightMm,
  getTicketPrintableWidthMm,
  itemLines,
  threeColumnLine,
  TICKET_LINE_HEIGHT_MM,
  TICKET_DOUBLE_LINE_HEIGHT_MM,
  TICKET_MAX_PAGE_HEIGHT_MM,
} from '../src/utils/receiptLayout.js';
import { buildSaleReceiptHtml } from '../src/utils/saleReceiptPrint.js';
import { buildKitchenOrderHtml } from '../src/utils/kitchenOrderPrint.js';
import {
  getThermalPaperWidthMm,
  setThermalPaperWidthMm,
} from '../src/utils/printer.js';

const createLocalStorageMock = () => {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  };
};

describe('receiptLayout: formato fisico del comprobante', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', { value: createLocalStorageMock(), configurable: true, writable: true });
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it('interlineado 8mm por linea y todo el recibo cabe en 3276', () => {
    expect(TICKET_LINE_HEIGHT_MM).toBe(8);
    expect(TICKET_DOUBLE_LINE_HEIGHT_MM).toBe(16);
    const lineMm = estimateTicketHeightMm([{ text: 'x' }], 58) - 4;
    expect(lineMm).toBeCloseTo(8, 5);
    const typicalLines = 64;
    const typicalDouble = 2;
    const total = 4 + typicalLines * lineMm + typicalDouble * lineMm;
    expect(total).toBeLessThan(getTicketPrintableHeightMm(TICKET_MAX_PAGE_HEIGHT_MM));
  });

  it('estimateTicketHeightMm suma lineas normales y dobles en mm', () => {
    const base = estimateTicketHeightMm([{ text: 'a' }, { text: 'b' }], 58);
    const withDouble = estimateTicketHeightMm([{ text: 'a', double: true }, { text: 'b' }], 58);
    expect(withDouble).toBeGreaterThan(base);
    expect(base).toBe(4 + 2 * TICKET_LINE_HEIGHT_MM);
    expect(withDouble).toBe(4 + TICKET_DOUBLE_LINE_HEIGHT_MM + TICKET_LINE_HEIGHT_MM);
  });

  it('getTicketPrintableHeightMm descuenta el margen de seguridad', () => {
    expect(getTicketPrintableHeightMm(297)).toBe(289);
    expect(getTicketPrintableHeightMm(210)).toBe(202);
  });

  it('58mm usa 27 columnas y area imprimible de 55mm', () => {
    expect(getReceiptColumns(58)).toBe(27);
    expect(getReceiptColumns(80)).toBe(35);
    expect(getReceiptColumns(104)).toBe(47);
    expect(getTicketPrintableWidthMm(58)).toBe(55);
  });

  it('fuente 58mm ~11.8px (3.1mm) con metrica real de 0.65em', () => {
    expect(getBaseFontPx(58)).toBe(11.8);
  });

  it('80mm y 104mm mantienen el mismo tamano de letra (~12px)', () => {
    expect(getBaseFontPx(80)).toBe(12.0);
    expect(getBaseFontPx(104)).toBe(11.9);
    const line80 = itemLines({ name: 'Producto largo de ejemplo', quantity: 1, subtotalText: '$5.000' }, 35);
    expect(line80[0]).toHaveLength(35);
    const header80 = threeColumnLine('Producto', 'Cant.', 'Total', 35);
    expect(header80).toHaveLength(35);
  });

  it('fila de item 27 columnas: nombre 12 | cantidad 5 | total 10', () => {
    const lines = itemLines({ name: 'Cafe', quantity: 2, subtotalText: '$10.000' }, 27);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toHaveLength(27);
    expect(lines[0]).toBe('Cafe' + ' '.repeat(9) + 'x2' + ' '.repeat(5) + '$10.000');
    const header = threeColumnLine('Producto', 'Cant.', 'Total', 27);
    expect(header).toHaveLength(27);
  });

  it('nombres largos envuelven dentro de la columna de nombre (12 chars)', () => {
    const lines = itemLines({ name: 'Hamburguesa doble con queso extra', quantity: 1, subtotalText: '$20.000' }, 27);
    const joined = lines.join('');
    expect(joined).toContain('$20.000');
    expect(lines[0]).toHaveLength(27);
    for (const line of lines.slice(1)) {
      expect(line).toHaveLength(17);
    }
  });

  it('linea doble larga se ajusta al ancho imprimible (sin corte)', () => {
    const html = buildKitchenOrderHtml([{ quantity: 1, products: { name: 'Cafe' } }], 3, 10000, 58);
    const titleLine = html.split('\n').find((l) => l.includes('ORDEN DE COCINA'));
    expect(titleLine).toContain('font-size:21.3px');
    const maxPx = 55 * (96 / 25.4);
    expect(15 * 0.65 * 21.3).toBeLessThanOrEqual(maxPx);
  });

  it('total doble largo en ventas se ajusta en vez de cortarse', () => {
    const receipt = makeReceipt(1);
    receipt.totals = { voluntaryTip: 0, totalText: '$38.500' };
    const html = buildSaleReceiptHtml(receipt, 58);
    const totalLine = html.split('\n').find((l) => l.includes('TOTAL: $38.500'));
    expect(totalLine).toBeTruthy();
    expect(totalLine).toContain('font-size:22.8px');
    const maxPx = 55 * (96 / 25.4);
    expect(14 * 0.65 * 22.8).toBeLessThanOrEqual(maxPx);
  });

  it('lineas normales mantienen la fuente de diseno (11.8px)', () => {
    const html = buildTicketHtml([{ text: 'x'.repeat(27) }], 58);
    expect(html).toContain('font-size:11.8px');
  });

  it('buildTicketHtml usa @page explicito sin auto, bloquea overflow y altura mm por linea', () => {
    const html = buildTicketHtml([{ text: 'Hola' }], 58, 297);
    const pageRule = html.split('\n').find((line) => line.includes('@page'));
    expect(pageRule).toContain('size:58mm 297mm');
    expect(pageRule).not.toContain('auto');
    expect(html).toContain('overflow:hidden');
    expect(html).toContain('break-inside:avoid');
    expect(html).toContain(`height:${TICKET_LINE_HEIGHT_MM}mm`);
  });

  it('contenido alineado a la izquierda para llenar el area imprimible (sin margen extra)', () => {
    const html = buildSaleReceiptHtml(makeReceipt(1), 58);
    expect(html).toContain('width:55mm; max-width:55mm; margin:0; padding:1mm 0;');
    expect(html).not.toContain('margin:0 auto');
  });

  it('recibo usa pagina de rollo 58x3276mm por defecto', () => {
    const html = buildSaleReceiptHtml(makeReceipt(1), 58);
    expect(html).toContain('@page { size:58mm 3276mm; margin:0; }');
    expect(html).not.toContain('RECIBO MUY LARGO');
  });

  it('recibo largo tambien usa una sola pagina de rollo 58x3276mm', () => {
    const html = buildSaleReceiptHtml(makeReceipt(50), 58);
    expect(html).toContain('@page { size:58mm 3276mm; margin:0; }');
    expect(html).not.toContain('RECIBO MUY LARGO');
  });

  it('orden de cocina usa pagina de rollo 58x3276mm por defecto', () => {
    const items = Array.from({ length: 50 }, (_, i) => ({ quantity: 1, products: { name: `Item largo ${i}` } }));
    const html = buildKitchenOrderHtml(items, 3, 50000, 58);
    expect(html).toContain('@page { size:58mm 3276mm; margin:0; }');
    expect(html).not.toContain('ORDEN MUY LARGA');
  });

  it('printer: ancho de papel por defecto 58 y validado', () => {
    expect(getThermalPaperWidthMm()).toBe(58);
    expect(setThermalPaperWidthMm(80)).toBe(true);
    expect(getThermalPaperWidthMm()).toBe(80);
    expect(setThermalPaperWidthMm(999)).toBe(false);
  });
});

function makeReceipt(itemCount) {
  const items = Array.from({ length: itemCount }, (_, i) => ({
    name: `Producto de prueba ${i}`,
    quantity: 2,
    subtotalText: '$10.000',
  }));
  return {
    type: 'sale',
    header: { title: 'COMPROBANTE', businessName: 'Mi Tienda', dateText: '08/05/2026 10:00 a.m.' },
    metadata: [
      { label: 'Comprobante:', value: 'CPV-1' },
      { label: 'Vendedor:', value: 'Admin' },
      { label: 'Cliente:', value: 'Venta general' },
    ],
    productHeader: 'Producto',
    quantityAbbreviation: 'Cant.',
    total: 'Total',
    items,
    totals: { voluntaryTip: 0, totalText: '$10.000' },
    tipLabel: 'Propina:',
    totalLabel: 'TOTAL',
    methodLabel: 'Metodo:',
    payment: { methodText: 'Efectivo' },
    footer: { message: 'Gracias por su compra' },
  };
}
