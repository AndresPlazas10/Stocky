import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { StrictMode } from 'react';
import { useKitchenOrderAlerts } from '@/components/Dashboard/mesas/useKitchenOrderAlerts';

const t = (key, opts) => String(key) + (opts ? JSON.stringify(opts) : '');

function makeMesa(id, orderId, overrides = {}) {
  return {
    id,
    table_number: 3,
    status: 'occupied',
    current_order_id: orderId,
    orders: { id: orderId, status: 'open', notes: '' },
    ...overrides,
  };
}

function setup(mesas, isKitchenRole = true) {
  const mesasRef = { current: mesas };
  const beeps = [];
  const arrivals = [];
  const toasts = [];
  const showInfo = (title, message) => toasts.push({ title, message });

  const { result } = renderHook(() =>
    useKitchenOrderAlerts({
      isKitchenRole,
      mesasRef,
      recordOrderArrival: (orderId) => arrivals.push(orderId),
      playNewOrderBeep: () => beeps.push(1),
      showInfo,
      t,
    }),
  );

  return { notify: result.current, mesasRef, beeps, arrivals, toasts };
}

describe('useKitchenOrderAlerts — una sola alerta por modificación de mesa', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('editar productos + guardar comentario en la misma orden → 1 solo toast y 1 solo beep', () => {
    const mesa = makeMesa('m1', 'order-1');
    const { notify, beeps, arrivals, toasts } = setup([mesa]);

    act(() => {
      notify('update', { order_id: 'order-1', id: 'item-1' });
      notify('notes', { id: 'order-1' });
    });

    expect(toasts).toHaveLength(0);

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(toasts).toHaveLength(1);
    expect(beeps).toHaveLength(1);
    expect(arrivals).toEqual(['order-1']);
    expect(toasts[0].title).toBe('mesas:toast.updatedOrder.title');
    expect(toasts[0].message).toContain('mesas:labels.tableNumber');
  });

  it('si en la sesión se agregó un producto (new), la alerta es "Nuevo pedido"', () => {
    const mesa = makeMesa('m1', 'order-1');
    const { notify, toasts } = setup([mesa]);

    act(() => {
      notify('new', { order_id: 'order-1', id: 'item-1' });
      notify('update', { order_id: 'order-1', id: 'item-2' });
      notify('notes', { id: 'order-1' });
    });
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(toasts).toHaveLength(1);
    expect(toasts[0].title).toBe('mesas:toast.newOrder.title');
  });

  it('mesas distintas editadas juntas → 1 alerta por cada mesa', () => {
    const mesas = [makeMesa('m1', 'order-1'), makeMesa('m2', 'order-2')];
    const { notify, toasts } = setup(mesas);

    act(() => {
      notify('update', { order_id: 'order-1', id: 'item-1' });
      notify('update', { order_id: 'order-2', id: 'item-2' });
    });
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(toasts).toHaveLength(2);
  });

  it('no alerta por orden cerrada ni por mesa ya liberada', () => {
    const closedMesa = makeMesa('m1', 'order-1', {
      orders: { id: 'order-1', status: 'closed' },
    });
    const availableMesa = makeMesa('m2', 'order-2', { status: 'available' });
    const { notify, toasts } = setup([closedMesa, availableMesa]);

    act(() => {
      notify('update', { order_id: 'order-1', id: 'item-1' });
      notify('update', { order_id: 'order-2', id: 'item-2' });
    });
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(toasts).toHaveLength(0);
  });

  it('new sin mesa aún cargada sí alerta (INSERT llega antes que el UPDATE de la mesa)', () => {
    const { notify, toasts } = setup([]);

    act(() => {
      notify('new', { order_id: 'order-1', id: 'item-1' });
    });
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(toasts).toHaveLength(1);
    expect(toasts[0].title).toBe('mesas:toast.newOrder.title');
  });

  it('update/notes sin mesa no alertan (orden fantasma)', () => {
    const { notify, toasts } = setup([]);

    act(() => {
      notify('update', { order_id: 'order-1', id: 'item-1' });
      notify('notes', { id: 'order-1' });
    });
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(toasts).toHaveLength(0);
  });

  it('no alerta cuando el rol no es cocina', () => {
    const mesa = makeMesa('m1', 'order-1');
    const { notify, toasts } = setup([mesa], false);

    act(() => {
      notify('update', { order_id: 'order-1', id: 'item-1' });
    });
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(toasts).toHaveLength(0);
  });

  it('sobrevive al doble-mount de React StrictMode (dev) y sigue alertando', () => {
    const mesa = makeMesa('m1', 'order-1');
    const mesasRef = { current: [mesa] };
    const toasts = [];
    const showInfo = (title, message) => toasts.push({ title, message });

    const { result } = renderHook(
      () =>
        useKitchenOrderAlerts({
          isKitchenRole: true,
          mesasRef,
          recordOrderArrival: () => {},
          playNewOrderBeep: () => {},
          showInfo,
          t,
        }),
      { wrapper: StrictMode },
    );

    act(() => {
      result.current('update', { order_id: 'order-1', id: 'item-1' });
      result.current('notes', { id: 'order-1' });
    });
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(toasts).toHaveLength(1);
  });
});
