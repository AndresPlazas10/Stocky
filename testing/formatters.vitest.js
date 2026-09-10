import { describe, it, expect } from 'vitest';
import { formatPrice } from '../src/utils/formatters.js';

describe('formatPrice', () => {
  it('returns $0 COP for null/undefined/NaN', () => {
    expect(formatPrice(null)).toBe('$0 COP');
    expect(formatPrice(undefined)).toBe('$0 COP');
    expect(formatPrice(NaN)).toBe('$0 COP');
  });

  it('returns 0 without currency symbol', () => {
    expect(formatPrice(null, false)).toBe('0');
  });

  it('formats thousands with dot separator', () => {
    expect(formatPrice(2000)).toBe('$\u00A02.000 COP');
    expect(formatPrice(1500)).toBe('$\u00A01.500 COP');
  });

  it('formats millions with dot separator', () => {
    expect(formatPrice(1200000)).toBe('$\u00A01.200.000 COP');
  });

  it('rounds decimals since maximumFractionDigits is 0', () => {
    expect(formatPrice(1500.50)).toBe('$\u00A01.501 COP');
  });

  it('formats integer amounts', () => {
    expect(formatPrice(1500.00)).toBe('$\u00A01.500 COP');
  });

  it('formats zero as $ 0 COP', () => {
    expect(formatPrice(0)).toBe('$\u00A00 COP');
  });

  it('formats small numbers without separators', () => {
    expect(formatPrice(50)).toBe('$\u00A050 COP');
  });

  it('formats numbers without currency symbol', () => {
    expect(formatPrice(1500, false)).toBe('1.500');
  });

  it('rounds numbers before formatting', () => {
    expect(formatPrice(1500.99)).toBe('$\u00A01.501 COP');
  });
});
