import test from 'node:test';
import assert from 'node:assert/strict';
import { detectTableOrderInconsistencies } from '../src/services/tableConsistencyDetect.js';

test('detecta y propone resolver conflicto duro de multiples ordenes abiertas por mesa', () => {
  const now = new Date().toISOString();
  const earlier = new Date(Date.now() - 60_000).toISOString();

  const { findings, fixes } = detectTableOrderInconsistencies({
    tables: [
      {
        id: 'table-1',
        business_id: 'biz-1',
        current_order_id: 'order-b',
        status: 'occupied',
        orders: { id: 'order-b', status: 'open' }
      }
    ],
    openOrders: [
      { id: 'order-a', business_id: 'biz-1', table_id: 'table-1', status: 'open', opened_at: earlier },
      { id: 'order-b', business_id: 'biz-1', table_id: 'table-1', status: 'open', opened_at: now }
    ]
  });

  assert.ok(findings.some((item) => item.code === 'order_table_pointer_conflict'));
  assert.ok(
    fixes.some((item) =>
      item.type === 'update_order'
      && item.target?.orderId === 'order-a'
      && item.payload?.status === 'cancelled'
    )
  );
  assert.ok(
    fixes.some((item) =>
      item.type === 'update_table'
      && item.target?.tableId === 'table-1'
      && item.payload?.current_order_id === 'order-b'
    )
  );
});

test('detecta mesa apuntando a orden cerrada/inexistente y propone liberar', () => {
  const { findings, fixes } = detectTableOrderInconsistencies({
    tables: [
      {
        id: 'table-2',
        business_id: 'biz-1',
        current_order_id: 'order-z',
        status: 'occupied',
        orders: { id: 'order-z', status: 'closed' }
      }
    ],
    openOrders: []
  });

  assert.ok(findings.some((item) => item.code === 'table_points_to_closed_or_missing_order'));
  assert.ok(
    fixes.some((item) =>
      item.type === 'update_table'
      && item.target?.tableId === 'table-2'
      && item.payload?.current_order_id === null
      && item.payload?.status === 'available'
    )
  );
});

test('detecta orden abierta sin puntero en mesa y propone ocuparla', () => {
  const { findings, fixes } = detectTableOrderInconsistencies({
    tables: [
      {
        id: 'table-3',
        business_id: 'biz-1',
        current_order_id: null,
        status: 'available'
      }
    ],
    openOrders: [
      { id: 'order-c', business_id: 'biz-1', table_id: 'table-3', status: 'open' }
    ]
  });

  assert.ok(findings.some((item) => item.code === 'open_order_without_table_pointer'));
  assert.ok(
    fixes.some((item) =>
      item.type === 'update_table'
      && item.target?.tableId === 'table-3'
      && item.payload?.current_order_id === 'order-c'
      && item.payload?.status === 'occupied'
    )
  );
});
