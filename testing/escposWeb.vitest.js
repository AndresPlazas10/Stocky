import { describe, it, expect } from 'vitest';
import { buildSaleEscPos, buildKitchenEscPos, cleanText } from '../src/utils/escposService';

const saleReceipt = {
  type: 'sale',
  header: { title: 'COMPROBANTE DE VENTA', businessName: 'Mi Negocio', dateText: '11/08/2026 10:30 a.m.', alignment: 'center' },
  metadata: [
    { label: 'Vendedor', value: 'Empleado' },
    { label: 'Cliente', value: 'Venta general' },
  ],
  items: [
    { name: 'Bandeja paisa', quantity: 2, unitPrice: 15000, subtotal: 30000, subtotalText: '$30.000' },
    { name: 'Limonada', quantity: 1, unitPrice: 5000, subtotal: 5000, subtotalText: '$5.000' },
  ],
  totals: { subtotal: 35000, subtotalText: '$35.000', voluntaryTip: 0, voluntaryTipText: '$0', total: 35000, totalText: '$35.000' },
  payment: { method: 'cash', methodText: 'Efectivo' },
  footer: { message: 'Gracias por su compra', alignment: 'center' },
  productHeader: 'Producto',
  quantityAbbreviation: 'Cant.',
  total: 'Total',
  tipLabel: 'Propina',
  totalLabel: 'TOTAL',
  methodLabel: 'Metodo',
  notSpecified: 'No especificado',
};

const kitchenReceipt = {
  type: 'kitchen',
  header: { title: 'ORDEN DE COCINA', businessName: 'Sistema Stocky', dateText: '11/08/2026 10:30 a.m.', alignment: 'center' },
  metadata: [
    { label: 'Mesa', value: '#5' },
    { label: 'Estado', value: 'Ocupada' },
    { label: 'Productos', value: '3' },
  ],
  items: [
    { name: 'Bandeja paisa', quantity: 2, subtotalText: '' },
    { name: 'Combo familiar', quantity: 1, subtotalText: '' },
  ],
  footer: { message: '*** ORDEN PARA COCINA ***', alignment: 'center' },
  productHeader: 'Producto',
  quantityAbbreviation: 'Cant.',
};

describe('escpos encoder (web)', () => {
  it('serializes a sale receipt starting with ESC/POS init', () => {
    const bytes = buildSaleEscPos(saleReceipt, 80);
    expect(bytes instanceof Uint8Array).toBe(true);
    expect(bytes[0]).toBe(0x1b);
    expect(bytes[1]).toBe(0x40);
    const text = Buffer.from(bytes).toString('ascii');
    expect(text).toContain('COMPROBANTE DE VENTA');
    expect(text).toContain('Mi Negocio');
    expect(text).toContain('Bandeja paisa');
    expect(text).toContain('x2');
    expect(text).toContain('TOTAL: $35.000');
    expect(text).toContain('Efectivo');
  });

  it('uses 32 columns for 58mm paper', () => {
    const bytes = buildSaleEscPos(saleReceipt, 58);
    const text = Buffer.from(bytes).toString('ascii');
    const line = text.split('\n').find((l) => l.includes('=')) || '';
    const run = (line.match(/=+/) || [''])[0];
    expect(run.length).toBe(32);
  });

  it('uses 48 columns for 80mm paper', () => {
    const bytes = buildSaleEscPos(saleReceipt, 80);
    const text = Buffer.from(bytes).toString('ascii');
    const line = text.split('\n').find((l) => l.includes('=')) || '';
    const run = (line.match(/=+/) || [''])[0];
    expect(run.length).toBe(48);
  });

  it('appends the cut command only when autoCut is enabled', () => {
    const withCut = buildSaleEscPos(saleReceipt, 80, true);
    const withoutCut = buildSaleEscPos(saleReceipt, 80, false);
    const cutBytes = [0x1d, 0x56, 0x42, 0x00];
    const endsWithCut = (bytes) => {
      const last = bytes.subarray(bytes.length - 4);
      return last[0] === cutBytes[0] && last[1] === cutBytes[1] && last[2] === cutBytes[2] && last[3] === cutBytes[3];
    };
    expect(endsWithCut(withCut)).toBe(true);
    expect(endsWithCut(withoutCut)).toBe(false);
  });

  it('serializes a kitchen order without totals', () => {
    const bytes = buildKitchenEscPos(kitchenReceipt, 80);
    const text = Buffer.from(bytes).toString('ascii');
    expect(text).toContain('ORDEN DE COCINA');
    expect(text).toContain('Mesa');
    expect(text).toContain('#5');
    expect(text).toContain('Combo familiar');
    expect(text).not.toContain('TOTAL:');
  });

  it('strips accents and unsupported characters', () => {
    const text = cleanText('Café con leche áéíóú ñ Ñ €');
    expect(text).toBe('Cafe con leche aeiou n N ');
    const bytes = buildSaleEscPos({
      ...saleReceipt,
      items: [{ name: 'Café con leche', quantity: 1, subtotal: 5000, subtotalText: '$5.000' }],
    }, 58);
    const printed = Buffer.from(bytes).toString('ascii');
    expect(printed).toContain('Cafe');
    expect(printed).not.toContain('é');
    expect(printed).not.toContain('€');
  });
});
