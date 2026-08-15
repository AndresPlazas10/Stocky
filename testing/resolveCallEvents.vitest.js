import { describe, expect, it } from 'vitest';
import { resolveCallEvents, suppressDismissedCalls } from '@stocky/shared';

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

describe('suppressDismissedCalls — anti-parpadeo de la campana tras dismiss', () => {
  const NOW = Date.now();
  const RAW = new Date(NOW - 60_000).toISOString(); // call hace 1 min

  it('mesa descartada: call se convierte en undefined', () => {
    const dismissed = new Map([['t1', NOW - 30_000]]);
    const mesas = [mesa('t1', RAW), mesa('t2', RAW)];
    const result = suppressDismissedCalls(mesas, dismissed);
    expect(result[0].call_requested_at).toBeUndefined();
    expect(result[1].call_requested_at).toBe(RAW);
  });

  it('sin dismiss: lista intacta (misma referencia)', () => {
    const mesas = [mesa('t1', RAW)];
    expect(suppressDismissedCalls(mesas, null)).toBe(mesas);
    expect(suppressDismissedCalls(mesas, new Map())).toBe(mesas);
  });

  it('un call MÁS NUEVO que el dismiss NO se suprime (cocina volvió a llamar)', () => {
    const dismissed = new Map([['t1', NOW - 30_000]]);
    const newer = new Date(NOW).toISOString();
    const result = suppressDismissedCalls([mesa('t1', newer)], dismissed);
    expect(result[0].call_requested_at).toBe(newer);
  });

  it('ventana expirada (más de CALL_WINDOW_MS): no suprime y limpia la entrada', () => {
    const dismissed = new Map([['t1', NOW - 11 * 60 * 1000]]);
    const result = suppressDismissedCalls([mesa('t1', RAW)], dismissed);
    expect(result[0].call_requested_at).toBe(RAW);
    expect(dismissed.has('t1')).toBe(false);
  });

  it('inputs vacíos no rompen', () => {
    expect(suppressDismissedCalls([], new Map([['t1', NOW]])).length).toBe(0);
    expect(suppressDismissedCalls(null, new Map([['t1', NOW]]))).toBeNull();
    expect(suppressDismissedCalls(undefined, null)).toBeUndefined();
  });
});
