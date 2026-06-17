import { describe, it, expect } from 'vitest';
import { isFunctionUnavailableError, isMissingColumnError, wrapDbError } from './supabaseErrors';

describe('isFunctionUnavailableError', () => {
  it('returns true for code 42883', () => {
    expect(isFunctionUnavailableError({ code: '42883' }, 'any_fn')).toBe(true);
  });

  it('returns true when message contains function name', () => {
    expect(
      isFunctionUnavailableError({ message: 'function "my_fn" does not exist' }, 'my_fn'),
    ).toBe(true);
  });

  it('returns false otherwise', () => {
    expect(isFunctionUnavailableError({ message: 'something else' }, 'my_fn')).toBe(false);
  });
});

describe('isMissingColumnError', () => {
  it('returns true for code 42703 with matching column', () => {
    expect(
      isMissingColumnError(
        { code: '42703', message: 'column deleted_at does not exist' },
        { columnName: 'deleted_at' },
      ),
    ).toBe(true);
  });

  it('returns false when column does not match', () => {
    expect(
      isMissingColumnError(
        { code: '42703', message: 'column foo does not exist' },
        { columnName: 'deleted_at' },
      ),
    ).toBe(false);
  });

  it('returns false for other codes', () => {
    expect(
      isMissingColumnError(
        { code: '42883', message: 'column deleted_at does not exist' },
        { columnName: 'deleted_at' },
      ),
    ).toBe(false);
  });
});

describe('wrapDbError', () => {
  it('creates Error with message and code', () => {
    const err = wrapDbError({ message: 'db fail', code: 'E001' }, 'fallback');
    expect(err.message).toBe('db fail');
    expect(err.code).toBe('E001');
  });

  it('uses fallback when message is absent', () => {
    const err = wrapDbError({}, 'fallback');
    expect(err.message).toBe('fallback');
    expect(err.code).toBeUndefined();
  });
});
