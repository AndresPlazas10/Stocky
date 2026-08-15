import { describe, expect, it } from 'vitest';
import { resolveCallEvents } from '@stocky/shared';

function mesa(id, raw) {
  return { id, call_requested_at: raw };
}

describe('resolveCallEvents — baseline de llamadas de cocina', () => {
  it('sin baseline y sin mesas cargadas: no marca baseline (race: mesas cargando)', () => {
    const result = resolveCallEvents([], new Map(), false);
    expect(result).toEqual({ newEvents: [], baselineSeeded: false, seenEntries: [] });
  });

  it('sin baseline y con mesas cargadas sin calls: siembra en silencio', () => {
    const result = resolveCallEvents([mesa('t1', ''), mesa('t2', '')], new Map(), false);
    expect(result).toEqual({ newEvents: [], baselineSeeded: true, seenEntries: [] });
  });

  it('sin baseline y con calls existentes: siembra en silencio (cero eventos)', () => {
    const mesas = [mesa('t1', '2026-08-15T12:00:00Z'), mesa('t2', '2026-08-15T12:01:00Z')];
    const result = resolveCallEvents(mesas, new Map(), false);
    expect(result.baselineSeeded).toBe(true);
    expect(result.newEvents).toEqual([]);
    // El caller debe marcar estos como vistos (siembra del baseline)
    expect(result.seenEntries).toEqual([
      { mesaId: 't1', raw: '2026-08-15T12:00:00Z' },
      { mesaId: 't2', raw: '2026-08-15T12:01:00Z' },
    ]);
  });

  it('post-baseline: un call nuevo genera evento', () => {
    const seen = new Map([['t1', '2026-08-15T12:00:00Z']]);
    const result = resolveCallEvents([mesa('t1', '2026-08-15T12:00:00Z'), mesa('t2', '2026-08-15T12:01:00Z')], seen, true);
    expect(result.newEvents).toEqual([{ mesaId: 't2', raw: '2026-08-15T12:01:00Z' }]);
    expect(result.seenEntries).toEqual([]);
  });

  it('post-baseline: el mismo call repetido no genera evento', () => {
    const seen = new Map([['t1', '2026-08-15T12:00:00Z']]);
    const result = resolveCallEvents([mesa('t1', '2026-08-15T12:00:00Z')], seen, true);
    expect(result.newEvents).toEqual([]);
  });

  it('post-baseline: la misma mesa con un raw nuevo genera evento', () => {
    const seen = new Map([['t1', '2026-08-15T12:00:00Z']]);
    const result = resolveCallEvents([mesa('t1', '2026-08-15T12:05:00Z')], seen, true);
    expect(result.newEvents).toEqual([{ mesaId: 't1', raw: '2026-08-15T12:05:00Z' }]);
  });

  it('post-baseline: call descartado (raw vacío) deja de estar en el diff', () => {
    const seen = new Map([['t1', '2026-08-15T12:00:00Z']]);
    const result = resolveCallEvents([mesa('t1', '')], seen, true);
    expect(result.newEvents).toEqual([]);
  });

  it('REGRESIÓN doble toast: un estado stale (sin call) no olvida el raw visto', () => {
    // Simula: toast #1 marcó t1:rawA en el seen. Luego un fetch stale sin el
    // call resuelve y el caller NO reconstruye el seen desde ese estado.
    // Cuando el call reaparece (mismo raw), NO debe generar otro evento.
    const seen = new Map([['t1', '2026-08-15T12:00:00Z']]);
    // Estado stale sin call:
    expect(resolveCallEvents([mesa('t1', '')], seen, true).newEvents).toEqual([]);
    // El raw reaparece idéntico:
    expect(resolveCallEvents([mesa('t1', '2026-08-15T12:00:00Z')], seen, true).newEvents).toEqual([]);
  });

  it('ignora mesas sin id o sin call', () => {
    const seen = new Map();
    const result = resolveCallEvents([{ id: null, call_requested_at: 'x' }, { id: 't2' }, null], seen, true);
    expect(result.newEvents).toEqual([]);
  });

  it('inputs vacíos no rompen', () => {
    expect(resolveCallEvents(null, new Map(), true).newEvents).toEqual([]);
    expect(resolveCallEvents(undefined, new Map(), false).baselineSeeded).toBe(false);
  });
});
