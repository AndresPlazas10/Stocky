import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildProcessingOutboxEventPatch,
  resolveFailedOutboxSyncTransition
} from '../src/data/commands/salesOutboxTransitions.js';
import { SALES_OUTBOX_BASE_RETRY_MS } from '../src/data/commands/salesOutboxRetryPolicy.js';

test('buildProcessingOutboxEventPatch mueve a processing y aumenta intentos', () => {
  const current = { id: 'evt-1', status: 'pending', attempts: 2, next_retry_at: 'x' };
  const nowIso = '2026-04-19T12:00:00.000Z';

  const patch = buildProcessingOutboxEventPatch(current, { nowIso });

  assert.equal(patch.status, 'processing');
  assert.equal(patch.attempts, 3);
  assert.equal(patch.next_retry_at, null);
  assert.equal(patch.updated_at, nowIso);
});

test('resolveFailedOutboxSyncTransition devuelve pending con retry y break para conectividad', () => {
  const nowMs = Date.UTC(2026, 3, 19, 12, 0, 0, 0);
  const nowIso = new Date(nowMs).toISOString();

  const result = resolveFailedOutboxSyncTransition({
    event: { attempts: 0 },
    errorMessage: 'Failed to fetch',
    nowMs,
    nowIso
  });

  assert.equal(result.shouldBreak, true);
  assert.equal(result.patch.status, 'pending');
  assert.equal(result.patch.attempts, 1);
  assert.equal(result.patch.last_error, 'Failed to fetch');
  assert.equal(Date.parse(result.patch.next_retry_at), nowMs + (SALES_OUTBOX_BASE_RETRY_MS * 2));
  assert.equal(result.patch.updated_at, nowIso);
});

test('resolveFailedOutboxSyncTransition devuelve error sin retry para permanentes', () => {
  const nowMs = Date.UTC(2026, 3, 19, 12, 0, 0, 0);
  const nowIso = new Date(nowMs).toISOString();

  const result = resolveFailedOutboxSyncTransition({
    event: { attempts: 4 },
    errorMessage: 'unauthorized',
    nowMs,
    nowIso
  });

  assert.equal(result.shouldBreak, false);
  assert.equal(result.patch.status, 'error');
  assert.equal(result.patch.last_error, 'unauthorized');
  assert.equal(result.patch.next_retry_at, null);
  assert.equal(result.patch.updated_at, nowIso);
});

test('resolveFailedOutboxSyncTransition devuelve pending con retry para error desconocido', () => {
  const nowMs = Date.UTC(2026, 3, 19, 12, 0, 0, 0);
  const nowIso = new Date(nowMs).toISOString();

  const result = resolveFailedOutboxSyncTransition({
    event: { attempts: 1 },
    errorMessage: 'timeout intermitente',
    nowMs,
    nowIso
  });

  assert.equal(result.shouldBreak, false);
  assert.equal(result.patch.status, 'pending');
  assert.equal(result.patch.attempts, 2);
  assert.equal(result.patch.last_error, 'timeout intermitente');
  assert.ok(result.patch.next_retry_at);
  assert.equal(result.patch.updated_at, nowIso);
});
