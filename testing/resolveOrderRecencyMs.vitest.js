import { describe, expect, it } from 'vitest';
import { resolveOrderRecencyMs } from '@stocky/shared';

function mesa(overrides = {}) {
  return {
    id: 't1',
    current_order_id: 'order-1',
    status: 'occupied',
    orders: {
      id: 'order-1',
      updated_at: '2026-08-15T12:00:00.000Z',
      opened_at: '2026-08-15T11:00:00.000Z',
    },
    ...overrides,
  };
}

describe('resolveOrderRecencyMs — clave de recencia de la cocina', () => {
  const persistedUpdated = Date.parse('2026-08-15T12:00:00.000Z');
  const persistedOpened = Date.parse('2026-08-15T11:00:00.000Z');

  it('prioriza el timestamp de llegada en sesión (arrivalTs)', () => {
    const arrivalMap = new Map([['order-1', 99999]]);
    expect(resolveOrderRecencyMs(mesa(), arrivalMap)).toBe(99999);
  });

  it('cae a orders.updated_at cuando no hay arrival en sesión', () => {
    expect(resolveOrderRecencyMs(mesa())).toBe(persistedUpdated);
  });

  it('cae a orders.opened_at cuando updated_at falta', () => {
    expect(
      resolveOrderRecencyMs(mesa({ orders: { id: 'order-1', opened_at: '2026-08-15T11:00:00.000Z' } })),
    ).toBe(persistedOpened);
  });

  it('devuelve 0 sin order id ni timestamps', () => {
    expect(resolveOrderRecencyMs({ id: 't1', status: 'available' })).toBe(0);
  });

  it('ignora timestamps inválidos y cae al siguiente nivel', () => {
    const m = mesa({ orders: { id: 'order-1', updated_at: 'no-es-fecha', opened_at: '2026-08-15T11:00:00.000Z' } });
    expect(resolveOrderRecencyMs(m)).toBe(persistedOpened);
  });

  it('ignora arrivals inválidos y usa persisted', () => {
    const arrivalMap = new Map([['order-1', NaN]]);
    expect(resolveOrderRecencyMs(mesa(), arrivalMap)).toBe(persistedUpdated);
  });

  it('orden descendente coloca el más reciente primero', () => {
    const old = mesa({
      id: 't1',
      current_order_id: 'order-old',
      orders: { id: 'order-old', updated_at: '2026-08-15T10:00:00.000Z', opened_at: '2026-08-15T10:00:00.000Z' },
    });
    const recent = mesa({
      id: 't2',
      current_order_id: 'order-new',
      orders: { id: 'order-new', updated_at: '2026-08-15T12:00:00.000Z', opened_at: '2026-08-15T12:00:00.000Z' },
    });
    expect(resolveOrderRecencyMs(recent) - resolveOrderRecencyMs(old)).toBeGreaterThan(0);
  });
});
