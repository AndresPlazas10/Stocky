import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isCloseOrderLockActive,
  sanitizeCloseOrderLocksRecord,
  removeCloseOrderLockFromRecord,
  upsertCloseOrderLockInRecord
} from '../src/utils/closeOrderLocks.js';

test('isCloseOrderLockActive detecta lock activo dentro del TTL', () => {
  const now = 1_000_000;
  const ts = now - 1_000;
  assert.equal(isCloseOrderLockActive(ts, { now, ttlMs: 15_000 }), true);
});

test('isCloseOrderLockActive detecta lock expirado fuera del TTL', () => {
  const now = 1_000_000;
  const ts = now - 20_000;
  assert.equal(isCloseOrderLockActive(ts, { now, ttlMs: 15_000 }), false);
});

test('sanitizeCloseOrderLocksRecord conserva solo locks activos y normaliza llaves', () => {
  const now = 1_000_000;
  const sanitized = sanitizeCloseOrderLocksRecord({
    '  a  ': now - 1_000,
    b: now - 20_000,
    c: 'invalid-ts'
  }, { now, ttlMs: 15_000 });

  assert.deepEqual(sanitized, { a: now - 1_000 });
});

test('removeCloseOrderLockFromRecord elimina la llave solicitada', () => {
  const next = removeCloseOrderLockFromRecord({ a: 1, b: 2 }, 'a');
  assert.deepEqual(next, { b: 2 });
});

test('upsertCloseOrderLockInRecord inserta o reemplaza lock por llave', () => {
  const next = upsertCloseOrderLockInRecord({ a: 1 }, 'a', 999);
  assert.deepEqual(next, { a: 999 });
});
