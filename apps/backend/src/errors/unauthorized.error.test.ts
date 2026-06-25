import { describe, it, expect } from 'vitest';
import { UnauthorizedError } from './unauthorized.error.js';
import { BaseAppError } from './base-app.error.js';

describe('UnauthorizedError', () => {
  it('extends BaseAppError with 401 UNAUTHORIZED defaults', () => {
    const e = new UnauthorizedError();
    expect(e).toBeInstanceOf(BaseAppError);
    expect(e.statusCode).toBe(401);
    expect(e.code).toBe('UNAUTHORIZED');
    expect(e.isOperational).toBe(true);
  });

  it('accepts a custom message', () => {
    const e = new UnauthorizedError('bad token');
    expect(e.message).toBe('bad token');
  });
});
