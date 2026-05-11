import { describe, it, expect } from 'vitest';
import { formatPrice } from '../src/utils/formatters.js';

describe('formatPrice', () => {
  it('returns $0 for null/undefined/NaN', () => {
    expect(formatPrice(null)).toBe('$0');
    expect(formatPrice(undefined)).toBe('$0');
    expect(formatPrice(NaN)).toBe('$0');
  });

  it('returns 0 without currency symbol', () => {
    expect(formatPrice(null, false)).toBe('0');
  });

  it('formats thousands with dot separator', () => {
    expect(formatPrice(2000)).toBe('$2.000');
    expect(formatPrice(1500)).toBe('$1.500');
  });

  it('formats millions with apostrophe', () => {
    expect(formatPrice(1200000)).toBe("$1'200.000");
  });

  it('formats numbers with decimals using comma', () => {
    expect(formatPrice(1500.50)).toBe('$1.500,50');
  });

  it('omits .00 decimals', () => {
    expect(formatPrice(1500.00)).toBe('$1.500');
  });

  it('formats zero as $0', () => {
    expect(formatPrice(0)).toBe('$0');
  });

  it('formats small numbers without separators', () => {
    expect(formatPrice(50)).toBe('$50');
  });

  it('formats numbers without currency symbol', () => {
    expect(formatPrice(1500, false)).toBe('1.500');
  });

  it('rounds numbers before formatting', () => {
    expect(formatPrice(1500.99)).toBe('$1.500,99');
  });
});
