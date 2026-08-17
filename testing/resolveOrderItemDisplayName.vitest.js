import { describe, expect, it } from 'vitest';
import { resolveOrderItemDisplayNameFrom } from '@/components/Dashboard/mesas/mesaHelpers';

const FALLBACK = 'Producto';

function item(partial = {}) {
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

describe('resolveOrderItemDisplayNameFrom — nombres en cocina web', () => {
  const catalog = new Map([
    ['p:prod-1', 'Agua con gas'],
    ['c:combo-1', 'Combo Familiar'],
  ]);

  it('usa el nombre embebido del producto cuando existe', () => {
    expect(
      resolveOrderItemDisplayNameFrom(item({ products: { name: 'Jugo de naranja' } }), catalog, FALLBACK),
    ).toBe('Jugo de naranja');
  });

  it('usa el nombre embebido del combo cuando existe', () => {
    expect(
      resolveOrderItemDisplayNameFrom(item({ combos: { nombre: 'Combo Burger' } }), catalog, FALLBACK),
    ).toBe('Combo Burger');
  });

  it('cae al catálogo por product_id cuando el nombre embebido falta', () => {
    expect(resolveOrderItemDisplayNameFrom(item({ product_id: 'prod-1' }), catalog, FALLBACK)).toBe('Agua con gas');
  });

  it('cae al catálogo por combo_id cuando el nombre embebido falta', () => {
    expect(resolveOrderItemDisplayNameFrom(item({ combo_id: 'combo-1' }), catalog, FALLBACK)).toBe('Combo Familiar');
  });

  it('respeta el fallback cuando el catálogo no tiene el item', () => {
    expect(resolveOrderItemDisplayNameFrom(item({ product_id: 'prod-x' }), catalog, FALLBACK)).toBe('Producto');
  });

  it('inputs vacíos no rompen', () => {
    expect(resolveOrderItemDisplayNameFrom(null, catalog, FALLBACK)).toBe('Producto');
    expect(resolveOrderItemDisplayNameFrom(undefined, catalog, FALLBACK)).toBe('Producto');
    expect(resolveOrderItemDisplayNameFrom(item({ product_id: 'prod-1' }), new Map(), FALLBACK)).toBe('Producto');
  });

  it('usa el fallback personalizado cuando se provee', () => {
    expect(resolveOrderItemDisplayNameFrom(item({ product_id: 'prod-x' }), catalog, 'Item')).toBe('Item');
  });
});