import { describe, it, expect } from 'vitest';
import { formatCopAmount, formatCop } from './money';

describe('formatCopAmount', () => {
  it('formats positive numbers with Colombian pesos', () => {
    expect(formatCopAmount(1000)).toBe('$ 1.000');
  });

  it('rounds decimals to whole pesos', () => {
    expect(formatCopAmount(1500.5)).toBe('$ 1.501');
  });

  it('returns $ 0 for null/undefined', () => {
    expect(formatCopAmount(null)).toBe('$ 0');
    expect(formatCopAmount(undefined)).toBe('$ 0');
  });
});

describe('formatCop', () => {
  it('delegates to formatCopAmount', () => {
    expect(formatCop(2500)).toBe('$ 2.500');
  });
});
