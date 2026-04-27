import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyOfflineStockConsumption,
  buildCartConsumptionByProduct,
  evaluateOfflineStockShortages
} from '../src/utils/offlineStockGuards.js';

test('evaluateOfflineStockShortages detecta faltantes mixtos (producto + combo) offline', () => {
  const products = [
    { id: 'p1', name: 'Pan', stock: 2, manage_stock: true },
    { id: 'p2', name: 'Queso', stock: 10, manage_stock: true }
  ];

  const comboById = new Map([
    ['c1', {
      id: 'c1',
      combo_items: [
        { producto_id: 'p1', cantidad: 2 },
        { producto_id: 'p2', cantidad: 1 }
      ]
    }]
  ]);

  const cart = [
    { item_type: 'combo', combo_id: 'c1', quantity: 1 },
    { item_type: 'product', product_id: 'p1', quantity: 1, name: 'Pan', manage_stock: true }
  ];

  const { comboStockShortages, simpleStockShortages } = evaluateOfflineStockShortages({
    cart,
    products,
    comboById
  });

  assert.equal(comboStockShortages.length, 0, 'el combo solo requiere 2 panes y hay 2');
  assert.equal(simpleStockShortages.length, 1, 'el producto adicional debe quedar bloqueado');
  assert.equal(simpleStockShortages[0]?.product_id, 'p1');
  assert.equal(simpleStockShortages[0]?.available_stock, 0);
  assert.equal(simpleStockShortages[0]?.required_quantity, 1);
});

test('applyOfflineStockConsumption nunca deja stock negativo tras consumos consecutivos', () => {
  const products = [
    { id: 'p1', name: 'Pan', stock: 3, manage_stock: true },
    { id: 'p2', name: 'Bebida', stock: 1, manage_stock: true },
    { id: 'p3', name: 'Servicio', stock: 0, manage_stock: false }
  ];

  const comboById = new Map([
    ['c2', { id: 'c2', combo_items: [{ producto_id: 'p1', cantidad: 2 }] }]
  ]);

  const cart = [
    { item_type: 'combo', combo_id: 'c2', quantity: 2 },
    { item_type: 'product', product_id: 'p2', quantity: 3 },
    { item_type: 'product', product_id: 'p3', quantity: 50, manage_stock: false }
  ];

  const consumptionByProduct = buildCartConsumptionByProduct({ cart, comboById });
  const nextProducts = applyOfflineStockConsumption({ products, consumptionByProduct });

  const pan = nextProducts.find((p) => p.id === 'p1');
  const bebida = nextProducts.find((p) => p.id === 'p2');
  const servicio = nextProducts.find((p) => p.id === 'p3');

  assert.equal(pan?.stock, 0, 'clamp en 0 cuando consumo supera stock');
  assert.equal(bebida?.stock, 0, 'clamp en 0 cuando consumo supera stock');
  assert.equal(servicio?.stock, 0, 'no cambia cuando manage_stock=false');
});
