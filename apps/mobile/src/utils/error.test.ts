import { describe, it, expect } from 'vitest';
import { getErrorMessage, getErrorCode } from './error';

describe('getErrorMessage', () => {
  it('returns message from Error instance', () => {
    expect(getErrorMessage(new Error('fail'))).toBe('fail');
  });

  it('returns string as-is', () => {
    expect(getErrorMessage('plain error')).toBe('plain error');
  });

  it('returns message from object', () => {
    expect(getErrorMessage({ message: 'object error' })).toBe('object error');
  });

  it('returns default message for null/undefined', () => {
    expect(getErrorMessage(null)).toBe('Ocurrió un error inesperado.');
    expect(getErrorMessage(undefined)).toBe('Ocurrió un error inesperado.');
  });
});

describe('getErrorCode', () => {
  it('returns code when present', () => {
    expect(getErrorCode({ code: 'E123' })).toBe('E123');
  });

  it('returns undefined when absent', () => {
    expect(getErrorCode('plain')).toBeUndefined();
  });
});
