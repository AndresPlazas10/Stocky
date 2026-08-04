import { describe, expect, it } from 'vitest';
import { buildAvailableMesaRecord, normalizeMesaRecord } from './mesaHelpers';

describe('normalizeMesaRecord empty release', () => {
  it('keeps available tables without order pointers', () => {
    const normalized = normalizeMesaRecord({
      id: 'table-1',
      business_id: 'biz-1',
      status: 'available',
      current_order_id: null,
      orders: { id: 'stale', status: 'open', total: 0 },
    });

    expect(normalized.status).toBe('available');
    expect(normalized.current_order_id).toBeNull();
    expect(normalized.orders).toBeNull();
  });

  it('frees closed orders', () => {
    const normalized = normalizeMesaRecord({
      id: 'table-2',
      business_id: 'biz-1',
      status: 'occupied',
      current_order_id: 'order-2',
      orders: { id: 'order-2', status: 'closed', total: 12000 },
    });

    expect(normalized.status).toBe('available');
    expect(normalized.current_order_id).toBeNull();
    expect(normalized.orders).toBeNull();
  });

  it('keeps occupied open orders even with total 0', () => {
    const normalized = normalizeMesaRecord({
      id: 'table-3',
      business_id: 'biz-1',
      status: 'occupied',
      current_order_id: 'order-3',
      orders: { id: 'order-3', status: 'open', total: 0 },
    });

    expect(normalized.status).toBe('occupied');
    expect(normalized.current_order_id).toBe('order-3');
    expect(normalized.orders).toBeTruthy();
  });

  it('buildAvailableMesaRecord always clears order association', () => {
    const available = buildAvailableMesaRecord(
      {
        id: 'table-4',
        business_id: 'biz-1',
        status: 'occupied',
        current_order_id: 'order-4',
        orders: { id: 'order-4', status: 'open', total: 0 },
        sync_version: 4,
      },
      5,
    );

    expect(available.status).toBe('available');
    expect(available.current_order_id).toBeNull();
    expect(available.orders).toBeNull();
    expect(available.sync_version).toBe(5);
  });
});
