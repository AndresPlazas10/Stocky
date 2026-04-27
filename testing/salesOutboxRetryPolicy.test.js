import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isConnectivityError,
  isPermanentSyncError,
  computeNextRetryAt,
  SALES_OUTBOX_BASE_RETRY_MS,
  SALES_OUTBOX_MAX_RETRY_MS
} from '../src/data/commands/salesOutboxRetryPolicy.js';

test('isConnectivityError detecta errores de red comunes', () => {
  assert.equal(isConnectivityError('Failed to fetch'), true);
  assert.equal(isConnectivityError('Network request failed'), true);
  assert.equal(isConnectivityError('Timeout desconocido'), false);
});

test('isPermanentSyncError marca errores permanentes conocidos', () => {
  assert.equal(isPermanentSyncError('unauthorized'), true);
  assert.equal(isPermanentSyncError('violates row-level security'), true);
  assert.equal(isPermanentSyncError('item invalido en carrito'), true);
});

test('isPermanentSyncError no marca errores de conectividad', () => {
  assert.equal(isPermanentSyncError('Failed to fetch'), false);
  assert.equal(isPermanentSyncError('NetworkError when attempting to fetch resource'), false);
});

test('computeNextRetryAt aplica backoff exponencial base', () => {
  const nowMs = Date.UTC(2026, 3, 19, 12, 0, 0, 0);
  const iso = computeNextRetryAt(0, { nowMs });
  assert.equal(Date.parse(iso), nowMs + SALES_OUTBOX_BASE_RETRY_MS);
});

test('computeNextRetryAt respeta tope máximo', () => {
  const nowMs = Date.UTC(2026, 3, 19, 12, 0, 0, 0);
  const iso = computeNextRetryAt(20, { nowMs });
  assert.equal(Date.parse(iso), nowMs + SALES_OUTBOX_MAX_RETRY_MS);
});
