import { describe, expect, it } from 'vitest';
import { formatElapsedTime } from '@stocky/shared';

describe('formatElapsedTime — temporizador de cocina', () => {
  it('0 ms → 00:00 (pedido recién llegado)', () => {
    expect(formatElapsedTime(0)).toBe('00:00');
  });

  it('segundos sueltos', () => {
    expect(formatElapsedTime(5000)).toBe('00:05');
    expect(formatElapsedTime(59_000)).toBe('00:59');
    expect(formatElapsedTime(61_000)).toBe('01:01');
  });

  it('minutos y segundos', () => {
    expect(formatElapsedTime(5 * 60_000 + 32_000)).toBe('05:32');
    expect(formatElapsedTime(59 * 60_000 + 59_000)).toBe('59:59');
  });

  it('una hora o más → hh:mm:ss', () => {
    expect(formatElapsedTime(3_600_000)).toBe('1:00:00');
    expect(formatElapsedTime(3_600_000 + 5 * 60_000 + 32_000)).toBe('1:05:32');
    expect(formatElapsedTime(25 * 3_600_000)).toBe('25:00:00');
  });

  it('no trunca ni redondea mal con ms intermedios', () => {
    expect(formatElapsedTime(61_999)).toBe('01:01');
    expect(formatElapsedTime(-5000)).toBe('00:00');
  });
});
