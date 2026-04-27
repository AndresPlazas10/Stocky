import test from 'node:test';
import assert from 'node:assert/strict';
import {
  __unsafeResetLocalOutboxStoreForTests,
  enqueueLocalOutboxEvent,
  listLocalOutboxEvents
} from '../src/localdb/outboxEventsStore.js';
import { processLocalOutboxEvents } from '../src/sync/outboxProcessor.js';

test('processLocalOutboxEvents mueve pending a acked cuando handler confirma', async () => {
  __unsafeResetLocalOutboxStoreForTests();

  await enqueueLocalOutboxEvent({
    businessId: 'biz-1',
    mutationType: 'product.update',
    payload: { product_id: 'p-1' },
    mutationId: 'm-ack-1'
  });

  const result = await processLocalOutboxEvents({
    maxEvents: 10,
    handler: async () => ({ ack: true })
  });

  assert.equal(result.processed, 1);
  assert.equal(result.acked, 1);
  assert.equal(result.rejected, 0);

  const acked = await listLocalOutboxEvents({ statuses: ['acked'] });
  assert.equal(acked.length, 1);
});

test('processLocalOutboxEvents mueve pending a rejected cuando handler rechaza', async () => {
  __unsafeResetLocalOutboxStoreForTests();

  await enqueueLocalOutboxEvent({
    businessId: 'biz-2',
    mutationType: 'invoice.create',
    payload: { invoice_id: 'i-1' },
    mutationId: 'm-rej-1'
  });

  const result = await processLocalOutboxEvents({
    maxEvents: 10,
    handler: async () => ({ ack: false, error: 'simulated rejection' })
  });

  assert.equal(result.processed, 1);
  assert.equal(result.acked, 0);
  assert.equal(result.rejected, 1);

  const rejected = await listLocalOutboxEvents({ statuses: ['rejected'] });
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].last_error, 'simulated rejection');
  assert.equal(Number(rejected[0].retry_count), 1);
});

test('processLocalOutboxEvents mantiene pending si handler lanza excepción retryable de red', async () => {
  __unsafeResetLocalOutboxStoreForTests();

  await enqueueLocalOutboxEvent({
    businessId: 'biz-3',
    mutationType: 'order.create',
    payload: { order_id: 'o-1' },
    mutationId: 'm-err-1'
  });

  const result = await processLocalOutboxEvents({
    maxEvents: 10,
    handler: async () => {
      throw new Error('network down');
    }
  });

  assert.equal(result.processed, 1);
  assert.equal(result.rejected, 0);

  const pending = await listLocalOutboxEvents({ statuses: ['pending'] });
  assert.equal(pending.length, 1);
  assert.equal(pending[0].last_error, 'network down');
  assert.equal(Number(pending[0].retry_count), 1);
});

test('processLocalOutboxEvents marca rejected si handler lanza excepción no retryable', async () => {
  __unsafeResetLocalOutboxStoreForTests();

  await enqueueLocalOutboxEvent({
    businessId: 'biz-4',
    mutationType: 'order.create',
    payload: { order_id: 'o-2' },
    mutationId: 'm-err-2'
  });

  const result = await processLocalOutboxEvents({
    maxEvents: 10,
    handler: async () => {
      throw new Error('forbidden mutation');
    }
  });

  assert.equal(result.processed, 1);
  assert.equal(result.rejected, 1);

  const rejected = await listLocalOutboxEvents({ statuses: ['rejected'] });
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].last_error, 'forbidden mutation');
  assert.equal(Number(rejected[0].retry_count), 1);
});
