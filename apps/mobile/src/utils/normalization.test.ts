import { describe, it, expect } from 'vitest';
import { normalizeText, normalizeReference, normalizeNumber } from './normalization';

describe('normalizeText', () => {
  it('trims strings', () => {
    expect(normalizeText('  hello  ')).toBe('hello');
  });

  it('uses fallback for null/undefined', () => {
    expect(normalizeText(null)).toBe('');
    expect(normalizeText(undefined)).toBe('');
    expect(normalizeText(null, 'fallback')).toBe('fallback');
  });

  it('converts numbers to string', () => {
    expect(normalizeText(123)).toBe('123');
  });
});

describe('normalizeReference', () => {
  it('returns trimmed string when valid', () => {
    expect(normalizeReference('REF-001')).toBe('REF-001');
  });

  it('returns null for empty string', () => {
    expect(normalizeReference('   ')).toBeNull();
  });

  it('returns null for non-strings', () => {
    expect(normalizeReference(null)).toBeNull();
    expect(normalizeReference(123)).toBeNull();
  });
});

describe('normalizeNumber', () => {
  it('returns number when valid', () => {
    expect(normalizeNumber(42)).toBe(42);
  });

  it('parses numeric strings', () => {
    expect(normalizeNumber('3.14')).toBe(3.14);
  });

  it('uses fallback for invalid values', () => {
    expect(normalizeNumber(null)).toBe(0);
    expect(normalizeNumber('abc', -1)).toBe(-1);
  });
});
