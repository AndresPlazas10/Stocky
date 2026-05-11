import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCloseOrderLocks } from '../src/hooks/useCloseOrderLocks.js';

const mockStorage = {};
beforeEach(() => {
  Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key) => mockStorage[key] ?? null),
    setItem: vi.fn((key, value) => { mockStorage[key] = value; }),
  });
  vi.useFakeTimers();
});

describe('useCloseOrderLocks', () => {
  it('acquires a lock successfully', () => {
    const { result } = renderHook(() => useCloseOrderLocks());

    const acquired = result.current.acquireCloseOrderLock('order-123');
    expect(acquired).toBe(true);
  });

  it('returns false for empty lock key', () => {
    const { result } = renderHook(() => useCloseOrderLocks());

    expect(result.current.acquireCloseOrderLock('')).toBe(false);
    expect(result.current.acquireCloseOrderLock(null)).toBe(false);
  });

  it('prevents double acquisition', () => {
    const { result } = renderHook(() => useCloseOrderLocks());

    expect(result.current.acquireCloseOrderLock('order-1')).toBe(true);
    expect(result.current.acquireCloseOrderLock('order-1')).toBe(false);
  });

  it('releases a lock', () => {
    const { result } = renderHook(() => useCloseOrderLocks());

    result.current.acquireCloseOrderLock('order-1');
    result.current.releaseCloseOrderLock('order-1');

    expect(result.current.acquireCloseOrderLock('order-1')).toBe(true);
  });

  it('releasing non-existent lock does not throw', () => {
    const { result } = renderHook(() => useCloseOrderLocks());

    expect(() => result.current.releaseCloseOrderLock('nonexistent')).not.toThrow();
  });

  it('acquiring different locks does not conflict', () => {
    const { result } = renderHook(() => useCloseOrderLocks());

    expect(result.current.acquireCloseOrderLock('order-1')).toBe(true);
    expect(result.current.acquireCloseOrderLock('order-2')).toBe(true);
  });

  it('lock expires after TTL', () => {
    const { result } = renderHook(() => useCloseOrderLocks());

    result.current.acquireCloseOrderLock('order-1');
    expect(result.current.acquireCloseOrderLock('order-1')).toBe(false);

    // Advance past TTL (15 seconds default)
    vi.advanceTimersByTime(20000);

    expect(result.current.acquireCloseOrderLock('order-1')).toBe(true);
  });

  it('persists locks to localStorage', () => {
    const { result } = renderHook(() => useCloseOrderLocks());

    result.current.acquireCloseOrderLock('order-1');

    expect(localStorage.setItem).toHaveBeenCalled();
  });

  it('clears lock from localStorage on release', () => {
    const { result } = renderHook(() => useCloseOrderLocks());

    result.current.acquireCloseOrderLock('order-1');
    result.current.releaseCloseOrderLock('order-1');

    expect(localStorage.setItem).toHaveBeenCalledTimes(2);
  });
});
