import { describe, expect, it } from 'vitest';
import { requestDeduplicator } from '@/utils/queryCache';

describe('RequestDeduplicator — dedup de queries en vuelo', () => {
  it('comparte la misma promesa para llamadas simultáneas con la misma key', async () => {
    let calls = 0;
    const queryFn = () => {
      calls += 1;
      return new Promise((resolve) => setTimeout(() => resolve({ ok: true }), 20));
    };

    const [a, b, c] = await Promise.all([
      requestDeduplicator.execute('key:1', queryFn),
      requestDeduplicator.execute('key:1', queryFn),
      requestDeduplicator.execute('key:1', queryFn),
    ]);

    expect(calls).toBe(1);
    expect(a).toEqual({ ok: true });
    expect(b).toEqual({ ok: true });
    expect(c).toEqual({ ok: true });
  });

  it('no deduplica keys distintas', async () => {
    let calls = 0;
    const queryFn = () => {
      calls += 1;
      return Promise.resolve(calls);
    };

    await Promise.all([
      requestDeduplicator.execute('key:a', queryFn),
      requestDeduplicator.execute('key:b', queryFn),
    ]);

    expect(calls).toBe(2);
  });

  it('libera la key tras completar: una llamada posterior ejecuta de nuevo', async () => {
    let calls = 0;
    const queryFn = () => {
      calls += 1;
      return Promise.resolve(calls);
    };

    await requestDeduplicator.execute('key:seq', queryFn);
    await requestDeduplicator.execute('key:seq', queryFn);

    expect(calls).toBe(2);
  });
});
