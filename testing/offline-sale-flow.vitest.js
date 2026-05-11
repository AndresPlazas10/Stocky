import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

describe('Flujo de venta offline', () => {
  let createSaleWithOutbox, flushSalesOutbox, getSalesOutboxSnapshot;
  let mockStorage;

  beforeEach(async () => {
    mockStorage = {};
    const store = {
      getItem: vi.fn((key) => mockStorage[key] ?? null),
      setItem: vi.fn((key, value) => { mockStorage[key] = value; }),
      removeItem: vi.fn(),
    };
    vi.stubGlobal('localStorage', store);
    vi.stubGlobal('navigator', { onLine: false });
    vi.stubGlobal('crypto', { randomUUID: () => 'test-' + Math.random().toString(36).slice(2, 8) });
    mockStorage['stocky.sales.outbox.v1'] = null;

    const mod = await import('../src/data/commands/salesCommands.js');
    createSaleWithOutbox = mod.createSaleWithOutbox;
    flushSalesOutbox = mod.flushSalesOutbox;
    getSalesOutboxSnapshot = mod.getSalesOutboxSnapshot;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('C-1: misma venta enqueueada 2 veces no crea duplicado', async () => {
    const result1 = await createSaleWithOutbox({
      businessId: 'biz-1',
      cart: [{ product_id: 'p1', quantity: 1, price: 5000 }],
      total: 5000,
      idempotencyKey: 'key-1',
    });

    const result2 = await createSaleWithOutbox({
      businessId: 'biz-1',
      cart: [{ product_id: 'p1', quantity: 1, price: 5000 }],
      total: 5000,
      idempotencyKey: 'key-1',
    });

    // Both return same temp ID (idempotent)
    expect(result1.data.id).toBe(result2.data.id);
    expect(result1.data.pending_sync).toBe(true);

    // Only one event in queue
    const snapshot = getSalesOutboxSnapshot();
    expect(snapshot.total).toBe(1);
  });

  it('C-2: venta offline persiste al simular reapertura de app', async () => {
    const result = await createSaleWithOutbox({
      businessId: 'biz-1',
      cart: [{ product_id: 'p1', quantity: 2, price: 3000 }],
      total: 6000,
    });

    expect(result.data.pending_sync).toBe(true);

    // Outbox should have 1 pending event
    const snapshot = getSalesOutboxSnapshot();
    expect(snapshot.total).toBe(1);
    expect(snapshot.pending).toBe(1);
  });

  it('C-3: múltiples ventas offline se encolan en orden', async () => {
    const ids = [];
    for (let i = 0; i < 3; i++) {
      const result = await createSaleWithOutbox({
        businessId: 'biz-1',
        cart: [{ product_id: 'p' + i, quantity: 1, price: 1000 * (i + 1) }],
        total: 1000 * (i + 1),
        idempotencyKey: 'batch-' + i,
      });
      ids.push(result.data.id);
    }

    const snapshot = getSalesOutboxSnapshot();
    expect(snapshot.total).toBe(3);
    expect(snapshot.pending).toBe(3);
    expect(new Set(ids).size).toBe(3);
  });

  it('C-4: enqueuear sin idempotencyKey genera uno automático', async () => {
    const result = await createSaleWithOutbox({
      businessId: 'biz-1',
      cart: [{ product_id: 'p1', quantity: 1, price: 5000 }],
      total: 5000,
    });

    expect(result.success).toBe(true);
    expect(result.data.id).toBeTruthy();
    expect(result.data.pending_sync).toBe(true);
  });

  it('C-5: getSalesOutboxSnapshot reporta correctamente cuando vacío', async () => {
    const snapshot = getSalesOutboxSnapshot();
    expect(snapshot.total).toBe(0);
    expect(snapshot.pending).toBe(0);
    expect(snapshot.error).toBe(0);
  });
});
