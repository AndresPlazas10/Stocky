import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebounce } from '../src/hooks/optimized.js';

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('returns initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('hello', 300));
    expect(result.current).toBe('hello');
  });

  it('does not update before delay', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: 'initial' } }
    );

    rerender({ value: 'updated' });
    act(() => { vi.advanceTimersByTime(200); });

    expect(result.current).toBe('initial');
  });

  it('updates after delay', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: 'initial' } }
    );

    rerender({ value: 'updated' });
    act(() => { vi.advanceTimersByTime(350); });

    expect(result.current).toBe('updated');
  });

  it('resets timer on rapid changes', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: 'a' } }
    );

    rerender({ value: 'ab' });
    act(() => { vi.advanceTimersByTime(200); });
    rerender({ value: 'abc' });
    act(() => { vi.advanceTimersByTime(200); });
    rerender({ value: 'abcd' });
    act(() => { vi.advanceTimersByTime(200); });

    // Still not past 300ms since last change
    expect(result.current).toBe('a');

    act(() => { vi.advanceTimersByTime(350); });
    expect(result.current).toBe('abcd');
  });

  it('uses custom delay', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 100),
      { initialProps: { value: 'old' } }
    );

    rerender({ value: 'new' });
    act(() => { vi.advanceTimersByTime(150); });

    expect(result.current).toBe('new');
  });
});
