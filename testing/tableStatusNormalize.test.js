import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTableRecord } from '../src/utils/tableStatus.js';

test('mantiene mesa ocupada cuando hay orden abierta aunque order_items llegue vacío', () => {
  const normalized = normalizeTableRecord({
    id: 'table-1',
    status: 'occupied',
    current_order_id: 'order-1',
    orders: {
      id: 'order-1',
      status: 'open',
      total: 35000,
      order_items: []
    }
  });

  assert.equal(normalized.status, 'occupied');
  assert.equal(normalized.current_order_id, 'order-1');
  assert.ok(normalized.orders);
});

test('libera mesa cuando la orden está cerrada', () => {
  const normalized = normalizeTableRecord({
    id: 'table-2',
    status: 'occupied',
    current_order_id: 'order-2',
    orders: {
      id: 'order-2',
      status: 'closed',
      total: 12000,
      order_items: [{ id: 'item-1', quantity: 1, price: 12000 }]
    }
  });

  assert.equal(normalized.status, 'available');
  assert.equal(normalized.current_order_id, null);
  assert.equal(normalized.orders, null);
});

