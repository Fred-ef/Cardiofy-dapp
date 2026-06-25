import { describe, it, expect } from 'vitest';
import { ConflictError } from './conflict.error.js';
import { NotFoundError } from './not-found.error.js';
import { ValidationError } from './validation.error.js';
import { PayloadTooLargeError } from './payload-too-large.error.js';
import { BaseAppError } from './base-app.error.js';

describe('BaseAppError subclasses', () => {
  it('NotFoundError → 404 NOT_FOUND', () => {
    const e = new NotFoundError('asset 1 not found');
    expect(e).toBeInstanceOf(BaseAppError);
    expect(e).toBeInstanceOf(NotFoundError);
    expect(e.statusCode).toBe(404);
    expect(e.code).toBe('NOT_FOUND');
    expect(e.isOperational).toBe(true);
    expect(e.message).toBe('asset 1 not found');
  });

  it('ConflictError → 409 CONFLICT', () => {
    const e = new ConflictError();
    expect(e.statusCode).toBe(409);
    expect(e.code).toBe('CONFLICT');
  });

  it('ValidationError → 400 VALIDATION_ERROR, carries issues', () => {
    const e = new ValidationError('bad payload', [
      { path: 'foo', message: 'required' },
    ]);
    expect(e.statusCode).toBe(400);
    expect(e.code).toBe('VALIDATION_ERROR');
    expect(e.issues).toEqual([{ path: 'foo', message: 'required' }]);
  });

  it('PayloadTooLargeError → 413 PAYLOAD_TOO_LARGE', () => {
    const e = new PayloadTooLargeError();
    expect(e.statusCode).toBe(413);
    expect(e.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('preserves the prototype chain across V8 captureStackTrace', () => {
    const e = new NotFoundError();
    expect(Object.getPrototypeOf(e)).toBe(NotFoundError.prototype);
    expect(typeof e.stack).toBe('string');
  });
});
