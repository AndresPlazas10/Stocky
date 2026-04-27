import test from 'node:test';
import assert from 'node:assert/strict';
import { findReusableSaleCreateOutboxEvent } from '../src/data/commands/salesOutboxIdempotency.js';

test('reutiliza evento sale.create pendiente con misma idempotencyKey', () => {
  const queue = [
    {
      id: 'evt-1',
      type: 'sale.create',
      status: 'pending',
      payload: { idempotencyKey: 'key-1' }
    }
  ];

  const reusable = findReusableSaleCreateOutboxEvent(queue, 'key-1');
  assert.equal(reusable?.id, 'evt-1');
});

test('reutiliza evento sale.create en error con misma idempotencyKey', () => {
  const queue = [
    {
      id: 'evt-2',
      type: 'sale.create',
      status: 'error',
      payload: { idempotencyKey: 'key-2' }
    }
  ];

  const reusable = findReusableSaleCreateOutboxEvent(queue, 'key-2');
  assert.equal(reusable?.id, 'evt-2');
});

test('no reutiliza evento ya sincronizado con misma idempotencyKey', () => {
  const queue = [
    {
      id: 'evt-3',
      type: 'sale.create',
      status: 'synced',
      payload: { idempotencyKey: 'key-3' }
    }
  ];

  const reusable = findReusableSaleCreateOutboxEvent(queue, 'key-3');
  assert.equal(reusable, null);
});

test('no reutiliza cuando idempotencyKey viene vacía', () => {
  const queue = [
    {
      id: 'evt-4',
      type: 'sale.create',
      status: 'pending',
      payload: { idempotencyKey: 'key-4' }
    }
  ];

  const reusable = findReusableSaleCreateOutboxEvent(queue, '   ');
  assert.equal(reusable, null);
});
