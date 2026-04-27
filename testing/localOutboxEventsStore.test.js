import test from 'node:test';
import assert from 'node:assert/strict';
import {
  __unsafeResetLocalOutboxStoreForTests,
  enqueueLocalOutboxEvent,
  listLocalOutboxEvents,
  clearLocalOutboxEvents,
  updateLocalOutboxEventStatus
} from '../src/localdb/outboxEventsStore.js';

test('enqueueLocalOutboxEvent guarda evento y deduplica por mutation_id', async () => {
  __unsafeResetLocalOutboxStoreForTests();

  const first = await enqueueLocalOutboxEvent({
    businessId: 'biz-1',
    mutationType: 'order.create',
    payload: { order_id: 'o-1' },
    mutationId: 'm-1'
  });

  const second = await enqueueLocalOutboxEvent({
    businessId: 'biz-1',
    mutationType: 'order.create',
    payload: { order_id: 'o-1-dup' },
    mutationId: 'm-1'
  });

  assert.ok(first?.id);
  assert.equal(second?.id, first?.id);

  const events = await listLocalOutboxEvents();
  assert.equal(events.length, 1);
});

test('listLocalOutboxEvents filtra por businessId', async () => {
  __unsafeResetLocalOutboxStoreForTests();

  await enqueueLocalOutboxEvent({
    businessId: 'biz-1',
    mutationType: 'product.update',
    payload: {},
    mutationId: 'm-2'
  });
  await enqueueLocalOutboxEvent({
    businessId: 'biz-2',
    mutationType: 'invoice.create',
    payload: {},
    mutationId: 'm-3'
  });

  const biz1 = await listLocalOutboxEvents({ businessId: 'biz-1' });
  const biz2 = await listLocalOutboxEvents({ businessId: 'biz-2' });

  assert.equal(biz1.length, 1);
  assert.equal(biz2.length, 1);
  assert.equal(biz1[0].business_id, 'biz-1');
  assert.equal(biz2[0].business_id, 'biz-2');
});

test('updateLocalOutboxEventStatus actualiza estado y retry_count', async () => {
  __unsafeResetLocalOutboxStoreForTests();

  const event = await enqueueLocalOutboxEvent({
    businessId: 'biz-3',
    mutationType: 'stock.adjust',
    payload: {},
    mutationId: 'm-4'
  });

  const updated = await updateLocalOutboxEventStatus({
    eventId: event.id,
    status: 'rejected',
    lastError: 'forbidden',
    retryCount: 2
  });

  assert.equal(updated?.status, 'rejected');
  assert.equal(updated?.last_error, 'forbidden');
  assert.equal(updated?.retry_count, 2);
});

test('clearLocalOutboxEvents limpia por negocio o todo', async () => {
  __unsafeResetLocalOutboxStoreForTests();

  await enqueueLocalOutboxEvent({ businessId: 'biz-a', mutationType: 'x', payload: {}, mutationId: 'm-a' });
  await enqueueLocalOutboxEvent({ businessId: 'biz-b', mutationType: 'y', payload: {}, mutationId: 'm-b' });

  await clearLocalOutboxEvents({ businessId: 'biz-a' });
  let events = await listLocalOutboxEvents();
  assert.equal(events.length, 1);
  assert.equal(events[0].business_id, 'biz-b');

  await clearLocalOutboxEvents();
  events = await listLocalOutboxEvents();
  assert.equal(events.length, 0);
});
