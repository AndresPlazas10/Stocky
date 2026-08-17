import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createKitchenAlertCoalescer,
  KITCHEN_ALERT_PRIORITY,
  KITCHEN_ALERT_WINDOW_MS,
} from '@stocky/shared';

function item(partial = {}) {
  return { id: `item-${Math.random()}`, order_id: 'order-1', ...partial };
}

describe('createKitchenAlertCoalescer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('agrupa varias ediciones de la misma orden en UNA sola alerta', () => {
    const flushes = [];
    const coalescer = createKitchenAlertCoalescer({
      onFlush: (kind, orderId, payload) => flushes.push([kind, orderId, payload]),
    });

    coalescer.notify('update', 'order-1', item({ quantity: 2 }));
    coalescer.notify('notes', 'order-1', { id: 'order-1' });

    vi.advanceTimersByTime(KITCHEN_ALERT_WINDOW_MS);

    expect(flushes).toHaveLength(1);
    expect(flushes[0][0]).toBe('update');
    expect(flushes[0][1]).toBe('order-1');
  });

  it('usa el kind de mayor prioridad (new > update > notes) y el último payload', () => {
    const flushes = [];
    const coalescer = createKitchenAlertCoalescer({
      onFlush: (kind, orderId, payload) => flushes.push([kind, orderId, payload]),
    });

    coalescer.notify('notes', 'order-1', { id: 'order-1' });
    coalescer.notify('update', 'order-1', item({ quantity: 3 }));
    coalescer.notify('new', 'order-1', item({ id: 'item-x' }));

    vi.advanceTimersByTime(KITCHEN_ALERT_WINDOW_MS);

    expect(flushes).toHaveLength(1);
    expect(flushes[0][0]).toBe('new');
    expect(flushes[0][2].id).toBe('item-x');
  });

  it('no degrada el kind: un update posterior a un new no baja la prioridad', () => {
    const flushes = [];
    const coalescer = createKitchenAlertCoalescer({
      onFlush: (kind, orderId, payload) => flushes.push([kind, orderId, payload]),
    });

    coalescer.notify('new', 'order-1', item({ id: 'item-x' }));
    coalescer.notify('update', 'order-1', item({ id: 'item-y' }));

    vi.advanceTimersByTime(KITCHEN_ALERT_WINDOW_MS);

    expect(flushes).toHaveLength(1);
    expect(flushes[0][0]).toBe('new');
  });

  it('mesas distintas se notifican por separado', () => {
    const flushes = [];
    const coalescer = createKitchenAlertCoalescer({
      onFlush: (kind, orderId, payload) => flushes.push([kind, orderId, payload]),
    });

    coalescer.notify('update', 'order-1', item({ order_id: 'order-1' }));
    coalescer.notify('new', 'order-2', item({ order_id: 'order-2' }));

    vi.advanceTimersByTime(KITCHEN_ALERT_WINDOW_MS);

    expect(flushes).toHaveLength(2);
    expect(flushes.map(([, orderId]) => orderId).sort()).toEqual(['order-1', 'order-2']);
  });

  it('cada evento reinicia la ventana (debounce trailing)', () => {
    const flushes = [];
    const coalescer = createKitchenAlertCoalescer({
      onFlush: (kind, orderId, payload) => flushes.push([kind, orderId, payload]),
    });

    coalescer.notify('update', 'order-1', item({ quantity: 2 }));
    vi.advanceTimersByTime(KITCHEN_ALERT_WINDOW_MS - 200);
    coalescer.notify('notes', 'order-1', { id: 'order-1' });
    vi.advanceTimersByTime(KITCHEN_ALERT_WINDOW_MS - 200);
    expect(flushes).toHaveLength(0);

    vi.advanceTimersByTime(400);
    expect(flushes).toHaveLength(1);
  });

  it('flushPending emite la alerta pendiente sin esperar la ventana', () => {
    const flushes = [];
    const coalescer = createKitchenAlertCoalescer({
      onFlush: (kind, orderId, payload) => flushes.push([kind, orderId, payload]),
    });

    coalescer.notify('update', 'order-1', item());
    coalescer.flushPending();
    expect(flushes).toHaveLength(1);

    vi.advanceTimersByTime(KITCHEN_ALERT_WINDOW_MS * 2);
    expect(flushes).toHaveLength(1);
  });

  it('dispose limpia timers y deja de emitir (incluido notify posterior)', () => {
    const flushes = [];
    const coalescer = createKitchenAlertCoalescer({
      onFlush: (kind, orderId, payload) => flushes.push([kind, orderId, payload]),
    });

    coalescer.notify('new', 'order-1', item());
    coalescer.dispose();
    vi.advanceTimersByTime(KITCHEN_ALERT_WINDOW_MS);

    coalescer.notify('update', 'order-2', item({ order_id: 'order-2' }));
    vi.advanceTimersByTime(KITCHEN_ALERT_WINDOW_MS);

    expect(flushes).toHaveLength(0);
  });

  it('ignora notify sin orderId', () => {
    const flushes = [];
    const coalescer = createKitchenAlertCoalescer({
      onFlush: (kind, orderId, payload) => flushes.push([kind, orderId, payload]),
    });

    coalescer.notify('new', '', item());
    coalescer.notify('update', '   ', item());

    vi.advanceTimersByTime(KITCHEN_ALERT_WINDOW_MS);
    expect(flushes).toHaveLength(0);
  });

  it('KITCHEN_ALERT_PRIORITY ordena new > update > notes', () => {
    expect(KITCHEN_ALERT_PRIORITY.new).toBeGreaterThan(KITCHEN_ALERT_PRIORITY.update);
    expect(KITCHEN_ALERT_PRIORITY.update).toBeGreaterThan(KITCHEN_ALERT_PRIORITY.notes);
  });
});
