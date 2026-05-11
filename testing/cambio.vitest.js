import { describe, it, expect } from 'vitest';
import { parseCopAmount, calcularCambio } from '../src/utils/cambio.js';

describe('parseCopAmount', () => {
  it('returns NaN for null/undefined', () => {
    expect(parseCopAmount(null)).toBeNaN();
    expect(parseCopAmount(undefined)).toBeNaN();
  });

  it('returns rounded number for numeric input', () => {
    expect(parseCopAmount(1500)).toBe(1500);
    expect(parseCopAmount(1500.75)).toBe(1501);
  });

  it('parses es-CO format (dots as thousands, comma as decimal)', () => {
    expect(parseCopAmount('1.500,00')).toBe(1500);
    expect(parseCopAmount('1.500.000')).toBe(1500000);
  });

  it('parses en-US format (commas as thousands)', () => {
    expect(parseCopAmount('1,500')).toBe(1500);
  });

  it('parses simple number strings', () => {
    expect(parseCopAmount('1500')).toBe(1500);
    expect(parseCopAmount('1500.50')).toBe(1501);
  });

  it('handles $ prefix', () => {
    expect(parseCopAmount('$1.500')).toBe(1500);
    expect(parseCopAmount('$ 1.500')).toBe(1500);
  });

  it('handles whitespace', () => {
    expect(parseCopAmount('  1.500  ')).toBe(1500);
  });

  it('returns NaN for empty string', () => {
    expect(parseCopAmount('')).toBeNaN();
  });

  it('returns NaN for non-numeric', () => {
    expect(parseCopAmount('abc')).toBeNaN();
  });

  it('parses digits-only fallback', () => {
    expect(parseCopAmount('abc123def')).toBe(123);
  });
});

describe('calcularCambio', () => {
  it('returns invalid_total when total <= 0', () => {
    const result = calcularCambio(0, 1000);
    expect(result.isValid).toBe(false);
    expect(result.reason).toBe('invalid_total');
  });

  it('returns invalid_paid when payment is NaN or <= 0', () => {
    const result = calcularCambio(500, 0);
    expect(result.isValid).toBe(false);
    expect(result.reason).toBe('invalid_paid');
  });

  it('returns insufficient when payment is less than total', () => {
    const result = calcularCambio(5000, 3000);
    expect(result.isValid).toBe(false);
    expect(result.reason).toBe('insufficient');
  });

  it('calculates exact change with breakdown', () => {
    const result = calcularCambio(15000, 50000);
    expect(result.isValid).toBe(true);
    expect(result.change).toBe(35000);
    expect(result.breakdown.length).toBeGreaterThan(0);
  });

  it('returns zero change and empty breakdown for exact payment', () => {
    const result = calcularCambio(20000, 20000);
    expect(result.isValid).toBe(true);
    expect(result.change).toBe(0);
    expect(result.breakdown).toEqual([]);
  });

  it('returns correct breakdown for 50000 - 27200 = 22800', () => {
    const result = calcularCambio(27200, 50000);
    expect(result.isValid).toBe(true);
    expect(result.change).toBe(22800);
    expect(result.breakdown).toEqual([
      { denomination: 20000, count: 1 },
      { denomination: 2000, count: 1 },
      { denomination: 500, count: 1 },
      { denomination: 200, count: 1 },
      { denomination: 100, count: 1 },
    ]);
  });

  it('uses greedy algorithm with Colombian denominations', () => {
    const result = calcularCambio(1, 100000);
    expect(result.isValid).toBe(true);
    expect(result.change).toBe(99999);
    expect(result.breakdown[0].denomination).toBe(50000);
  });
});
