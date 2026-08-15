import { describe, expect, it } from 'vitest';
import { resolveOrderItemDisplayNameFrom } from './mesaHelpers';

function item(partial) {
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

describe('resolveOrderItemDisplayNameFrom — nombres en cocina móvil', () => {
  const catalog = new Map([
    ['p:prod-1', 'Aguila 330ml'],
    ['c:combo-1', 'Combo Familiar'],
  ]);

  it('usa el nombre embebido del producto cuando existe', () => {
    const result = resolveOrderItemDisplayNameFrom(
      item({ products: { name: 'Agua con gas' } }),
      catalog,
    );
    expect(result).toBe('Agua con gas');
  });

  it('usa el nombre embebido del combo cuando existe', () => {
    const result = resolveOrderItemDisplayNameFrom(
      item({ combos: { nombre: 'Combo Burger' } }),
      catalog,
    );
    expect(result).toBe('Combo Burger');
  });

  it('cae al catálogo por product_id cuando el nombre embebido falta', () => {
    const result = resolveOrderItemDisplayNameFrom(item({ product_id: 'prod-1' }), catalog);
    expect(result).toBe('Aguila 330ml');
  });

  it('cae al catálogo por combo_id cuando el nombre embebido falta', () => {
    const result = resolveOrderItemDisplayNameFrom(item({ combo_id: 'combo-1' }), catalog);
    expect(result).toBe('Combo Familiar');
  });

  it('el catálogo gana sobre un embebido "Item"', () => {
    const result = resolveOrderItemDisplayNameFrom(
      item({ product_id: 'prod-1', products: { name: 'Item' } }),
      catalog,
    );
    expect(result).toBe('Aguila 330ml');
  });

  it('fallback final "Item" sin embebido ni catálogo', () => {
    const result = resolveOrderItemDisplayNameFrom(item({ product_id: 'prod-x' }), catalog);
    expect(result).toBe('Item');
  });

  it('inputs vacíos no rompen', () => {
    expect(resolveOrderItemDisplayNameFrom(null, catalog)).toBe('Item');
    expect(resolveOrderItemDisplayNameFrom(undefined, catalog)).toBe('Item');
    expect(resolveOrderItemDisplayNameFrom(item({ product_id: 'prod-1' }), new Map())).toBe('Item');
  });
});
