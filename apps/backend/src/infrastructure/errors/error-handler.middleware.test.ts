import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ErrorHandlerMiddleware } from './error-handler.middleware.js';
import { ValidationError } from '#errors/validation.error.js';
import { NotFoundError } from '#errors/not-found.error.js';
import type { IErrorHandler } from './interfaces/i-error-handler.js';
import type { Request, Response, NextFunction } from 'express';

function makeRes(): Response {
  const res = {
    status: vi.fn(),
    json:   vi.fn(),
  } as unknown as Response;
  (res.status as ReturnType<typeof vi.fn>).mockReturnValue(res);
  return res;
}

function makeReq(extra: Partial<Request> = {}): Request {
  return {
    headers: {},
    id: 'trace-abc',
    originalUrl: '/x',
    ...extra,
  } as unknown as Request;
}

describe('ErrorHandlerMiddleware', () => {
  let inner: IErrorHandler;
  let mw: ErrorHandlerMiddleware;

  beforeEach(() => {
    inner = { handleError: vi.fn().mockResolvedValue(undefined) };
    mw = new ErrorHandlerMiddleware(inner);
  });

  it('maps a BaseAppError to its status code and JSON shape', async () => {
    const res = makeRes();
    const err = new ValidationError('bad input', [{ path: 'a', message: 'b' }]);
    await mw.handle(err, makeReq(), res, vi.fn() as unknown as NextFunction);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'bad input',
      traceId: 'trace-abc',
      issues: [{ path: 'a', message: 'b' }],
    }));
  });

  it('maps a NotFoundError to 404', async () => {
    const res = makeRes();
    await mw.handle(new NotFoundError(), makeReq(), res, vi.fn() as unknown as NextFunction);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('maps unknown errors to 500 INTERNAL_SERVER_ERROR', async () => {
    const res = makeRes();
    await mw.handle(new Error('boom'), makeReq(), res, vi.fn() as unknown as NextFunction);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      statusCode: 500,
      code: 'INTERNAL_SERVER_ERROR',
    }));
  });

  it('forwards every error to the inner error handler before responding', async () => {
    const err = new Error('telemetry me');
    await mw.handle(err, makeReq(), makeRes(), vi.fn() as unknown as NextFunction);
    expect(inner.handleError).toHaveBeenCalledWith(err);
  });
});
