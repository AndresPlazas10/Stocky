import test from 'node:test';
import assert from 'node:assert/strict';
import { applySaleSyncToSnapshot } from '../src/data/commands/salesSnapshotSync.js';

test('reemplaza tempSaleId por remoteSaleId y marca sincronizada', () => {
  const snapshot = [
    { id: 'offline-1', pending_sync: true, total: 10000 },
    { id: 'offline-2', pending_sync: true, total: 20000 }
  ];

  const syncedAt = '2026-04-19T12:00:00.000Z';
  const { nextSnapshot, updated } = applySaleSyncToSnapshot(snapshot, {
    tempSaleId: 'offline-1',
    remoteSaleId: 'sale-remote-1',
    syncedAt
  });

  assert.equal(updated, true);
  assert.equal(nextSnapshot[0].id, 'sale-remote-1');
  assert.equal(nextSnapshot[0].pending_sync, false);
  assert.equal(nextSnapshot[0].synced_at, syncedAt);
  assert.equal(nextSnapshot[1].id, 'offline-2');
});

test('no cambia snapshot cuando no encuentra tempSaleId', () => {
  const snapshot = [{ id: 'offline-3', pending_sync: true }];

  const { nextSnapshot, updated } = applySaleSyncToSnapshot(snapshot, {
    tempSaleId: 'offline-x',
    remoteSaleId: 'sale-remote-x',
    syncedAt: '2026-04-19T12:01:00.000Z'
  });

  assert.equal(updated, false);
  assert.deepEqual(nextSnapshot, snapshot);
});

test('devuelve snapshot original cuando faltan ids', () => {
  const snapshot = [{ id: 'offline-4', pending_sync: true }];

  const a = applySaleSyncToSnapshot(snapshot, {
    tempSaleId: '',
    remoteSaleId: 'sale-remote-4'
  });
  const b = applySaleSyncToSnapshot(snapshot, {
    tempSaleId: 'offline-4',
    remoteSaleId: ''
  });

  assert.equal(a.updated, false);
  assert.equal(b.updated, false);
  assert.deepEqual(a.nextSnapshot, snapshot);
  assert.deepEqual(b.nextSnapshot, snapshot);
});

test('maneja snapshot inválido sin romper', () => {
  const { nextSnapshot, updated } = applySaleSyncToSnapshot(null, {
    tempSaleId: 'offline-5',
    remoteSaleId: 'sale-remote-5'
  });

  assert.equal(updated, false);
  assert.deepEqual(nextSnapshot, []);
});
