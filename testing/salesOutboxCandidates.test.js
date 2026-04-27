import test from 'node:test';
import assert from 'node:assert/strict';
import { selectSalesOutboxCandidates } from '../src/data/commands/salesOutboxCandidates.js';

test('incluye pendientes sin next_retry_at y excluye tipos distintos', () => {
  const queue = [
    { id: 'a', type: 'sale.create', status: 'pending', next_retry_at: null },
    { id: 'b', type: 'other', status: 'pending', next_retry_at: null }
  ];

  const result = selectSalesOutboxCandidates(queue, { nowMs: 1_000, maxEvents: 20 });
  assert.deepEqual(result.map((x) => x.id), ['a']);
});

test('excluye pending con next_retry_at futuro', () => {
  const futureIso = new Date(5_000).toISOString();
  const queue = [
    { id: 'a', type: 'sale.create', status: 'pending', next_retry_at: futureIso }
  ];

  const result = selectSalesOutboxCandidates(queue, { nowMs: 1_000, maxEvents: 20 });
  assert.equal(result.length, 0);
});

test('incluye error solo cuando next_retry_at ya venció', () => {
  const pastIso = new Date(500).toISOString();
  const futureIso = new Date(5_000).toISOString();
  const queue = [
    { id: 'a', type: 'sale.create', status: 'error', next_retry_at: pastIso },
    { id: 'b', type: 'sale.create', status: 'error', next_retry_at: futureIso },
    { id: 'c', type: 'sale.create', status: 'error', next_retry_at: null }
  ];

  const result = selectSalesOutboxCandidates(queue, { nowMs: 1_000, maxEvents: 20 });
  assert.deepEqual(result.map((x) => x.id), ['a']);
});

test('respeta maxEvents', () => {
  const queue = [
    { id: 'a', type: 'sale.create', status: 'pending' },
    { id: 'b', type: 'sale.create', status: 'pending' },
    { id: 'c', type: 'sale.create', status: 'pending' }
  ];

  const result = selectSalesOutboxCandidates(queue, { nowMs: 1_000, maxEvents: 2 });
  assert.deepEqual(result.map((x) => x.id), ['a', 'b']);
});
