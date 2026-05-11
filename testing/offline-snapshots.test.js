import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

describe('Snapshots offline', () => {
  let mockStorage;

  beforeEach(async () => {
    mockStorage = {};
    const store = {
      getItem: vi.fn((key) => mockStorage[key] ?? null),
      setItem: vi.fn((key, value) => { mockStorage[key] = value; }),
      removeItem: vi.fn(),
    };
    vi.stubGlobal('window', { localStorage: store });
    vi.stubGlobal('navigator', { onLine: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('H-1: save + read mantiene consistencia', async () => {
    const { saveOfflineSnapshot, readOfflineSnapshot } = await import('../src/utils/offlineSnapshot.js');
    const data = [{ id: 'p1', name: 'Café', price: 5000 }];
    saveOfflineSnapshot('test_products', data);
    const read = readOfflineSnapshot('test_products', []);
    expect(read).toEqual(data);
  });

  it('H-2: read retorna fallback para clave inexistente', async () => {
    const { readOfflineSnapshot } = await import('../src/utils/offlineSnapshot.js');
    const fallback = [{ id: 'default' }];
    const read = readOfflineSnapshot('nonexistent_key', fallback);
    expect(read).toEqual(fallback);
  });

  it('H-3: snapshot corrupto retorna fallback sin crashear', async () => {
    mockStorage['stocky.offline_snapshot.bad_key'] = '{not valid json';
    const { readOfflineSnapshot } = await import('../src/utils/offlineSnapshot.js');
    const fallback = [{ id: 'safe' }];
    const read = readOfflineSnapshot('bad_key', fallback);
    expect(read).toEqual(fallback);
  });

  it('H-4: isOfflineMode detecta online/offline', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    const mod1 = await import('../src/utils/offlineSnapshot.js?_=1');
    expect(mod1.isOfflineMode()).toBe(false);

    vi.stubGlobal('navigator', { onLine: false });
    const mod2 = await import('../src/utils/offlineSnapshot.js?_=2');
    expect(mod2.isOfflineMode()).toBe(true);
  });
});
