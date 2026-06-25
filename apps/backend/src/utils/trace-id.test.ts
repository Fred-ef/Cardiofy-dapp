import { describe, it, expect } from 'vitest';
import type { Request } from 'express';
import { getTraceId } from './trace-id.js';

describe('getTraceId', () => {
  it('prefers req.id when set', () => {
    const req = { id: 'abc', headers: { 'x-request-id': 'def' } } as unknown as Request;
    expect(getTraceId(req)).toBe('abc');
  });

  it('falls back to x-request-id header if req.id is missing', () => {
    const req = { headers: { 'x-request-id': 'def' } } as unknown as Request;
    expect(getTraceId(req)).toBe('def');
  });

  it('returns undefined when neither is available', () => {
    const req = { headers: {} } as unknown as Request;
    expect(getTraceId(req)).toBeUndefined();
  });
});
