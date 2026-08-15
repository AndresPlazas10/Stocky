import { describe, expect, it } from 'vitest';
import { buildOrderSignature } from '../utils/orderSignature';
import type { MesaOrderItem } from '../../../services/mesaOrderService';

function item(partial: Partial<MesaOrderItem>): MesaOrderItem {
  return {
    id: 'item-1',
    order_id: 'order-1',
    product_id: null,
    combo_id: null,
    quantity: 1,
    price: 1000,
    subtotal: 1000,
    ...partial,
  };
}

describe('buildOrderSignature', () => {
  it('ignora el orden de los items (firma estable ante reordenamiento)', () => {
    const a = [item({ id: '1', product_id: 'p1', quantity: 2 }), item({ id: '2', combo_id: 'c1', quantity: 1 })];
    const b = [item({ id: '2', combo_id: 'c1', quantity: 1 }), item({ id: '1', product_id: 'p1', quantity: 2 })];
    expect(buildOrderSignature(a, '')).toBe(buildOrderSignature(b, ''));
  });

  it('cambia cuando la cantidad sube o baja', () => {
    const base = [item({ product_id: 'p1', quantity: 2 })];
    expect(buildOrderSignature(base, '')).not.toBe(
      buildOrderSignature([item({ product_id: 'p1', quantity: 3 })], ''),
    );
    expect(buildOrderSignature(base, '')).not.toBe(
      buildOrderSignature([item({ product_id: 'p1', quantity: 1 })], ''),
    );
  });

  it('cambia cuando se agrega o elimina un producto', () => {
    const one = [item({ product_id: 'p1', quantity: 1 })];
    const two = [item({ product_id: 'p1', quantity: 1 }), item({ product_id: 'p2', quantity: 1 })];
    expect(buildOrderSignature(one, '')).not.toBe(buildOrderSignature(two, ''));
    expect(buildOrderSignature(two, '')).not.toBe(buildOrderSignature(one, ''));
  });

  it('cambia cuando el comentario de la mesa cambia', () => {
    const items = [item({ product_id: 'p1', quantity: 1 })];
    expect(buildOrderSignature(items, 'sin cebolla')).not.toBe(buildOrderSignature(items, 'sin sal'));
  });

  it('trata items idénticos con distintos comentarios como distintos', () => {
    const items = [item({ product_id: 'p1', quantity: 1 })];
    expect(buildOrderSignature(items, '')).not.toBe(buildOrderSignature(items, 'sin cebolla'));
  });

  it('no cambia con items idénticos y mismo comentario', () => {
    const items = [item({ product_id: 'p1', quantity: 1 })];
    expect(buildOrderSignature(items, 'sin cebolla')).toBe(buildOrderSignature(items, 'sin cebolla'));
  });
});
