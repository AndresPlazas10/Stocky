import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

describe('Recuperación offline', () => {
  let useCloseOrderLocks;
  let mockStorage;

  beforeEach(async () => {
    mockStorage = {};
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key) => mockStorage[key] ?? null),
      setItem: vi.fn((key, value) => { mockStorage[key] = value; }),
      removeItem: vi.fn(),
    });
    vi.useFakeTimers();

    const mod = await import('../src/hooks/useCloseOrderLocks.js');
    useCloseOrderLocks = mod.useCloseOrderLocks;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('R-1: lock expira después del TTL', () => {
    const { result } = renderHook(() => useCloseOrderLocks());
    expect(result.current.acquireCloseOrderLock('order-1')).toBe(true);
    expect(result.current.acquireCloseOrderLock('order-1')).toBe(false);
    act(() => { vi.advanceTimersByTime(20000); });
    expect(result.current.acquireCloseOrderLock('order-1')).toBe(true);
  });

  it('R-2: locks diferentes no se bloquean', () => {
    const { result } = renderHook(() => useCloseOrderLocks());
    expect(result.current.acquireCloseOrderLock('A')).toBe(true);
    expect(result.current.acquireCloseOrderLock('B')).toBe(true);
    expect(result.current.acquireCloseOrderLock('C')).toBe(true);
  });

  it('R-3: release + re-acquire', () => {
    const { result } = renderHook(() => useCloseOrderLocks());
    result.current.acquireCloseOrderLock('order-1');
    result.current.releaseCloseOrderLock('order-1');
    expect(result.current.acquireCloseOrderLock('order-1')).toBe(true);
  });

  it('R-4: release sin lock no lanza error', () => {
    const { result } = renderHook(() => useCloseOrderLocks());
    expect(() => result.current.releaseCloseOrderLock('no-existe')).not.toThrow();
  });

  it('R-5: empty/null key', () => {
    const { result } = renderHook(() => useCloseOrderLocks());
    expect(result.current.acquireCloseOrderLock('')).toBe(false);
  });
});
