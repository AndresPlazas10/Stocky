import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

describe('Detección de red', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('window', {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    vi.stubGlobal('document', {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      visibilityState: 'visible',
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('M-1: isOfflineMode online devuelve false', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    const { isOfflineMode } = await import('../src/utils/offlineSnapshot.js?_=10');
    expect(isOfflineMode()).toBe(false);
  });

  it('M-2: isOfflineMode offline devuelve true', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    const { isOfflineMode } = await import('../src/utils/offlineSnapshot.js?_=20');
    expect(isOfflineMode()).toBe(true);
  });

  it('M-3: navigator.onLine se puede cambiar en runtime', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    expect(typeof navigator !== 'undefined' && navigator.onLine).toBe(true);

    vi.stubGlobal('navigator', { onLine: false });
    expect(typeof navigator !== 'undefined' && navigator.onLine).toBe(false);
  });

  it('M-4: flushSalesOutbox no procesa cuando offline', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    const store = {
      getItem: vi.fn((key) => (key === 'stocky.sales.outbox.v1' ? '[]' : null)),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };
    vi.stubGlobal('localStorage', store);

    const { flushSalesOutbox } = await import('../src/data/commands/salesCommands.js');
    const result = await flushSalesOutbox();
    expect(result.synced).toBe(0);
    expect(result.pending).toBe(0);
  });
});
