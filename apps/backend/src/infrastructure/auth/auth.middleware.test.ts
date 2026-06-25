import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthMiddleware } from './auth.middleware.js';
import { makeAppConfigMock, makeLoggerMock } from '#tests/support/mocks.js';
import type { ILoggerService } from '#infrastructure/logger/interfaces/i-logger.service.js';
import type { Request, Response, NextFunction } from 'express';
import type { AppConfig } from '#infrastructure/config/index.js';

const VALID_TOKEN = 'a'.repeat(32);

function makeReq(opts: { path?: string; authHeader?: string } = {}): Request {
  return {
    path: opts.path ?? '/api/v1/assets/asset-1',
    headers: opts.authHeader ? { authorization: opts.authHeader } : {},
  } as unknown as Request;
}

function makeMw(auth: AppConfig['env']['AUTH'], logger: ILoggerService = makeLoggerMock()): AuthMiddleware {
  const cfg = makeAppConfigMock();
  cfg.env.AUTH = auth;
  return new AuthMiddleware(cfg, logger);
}

describe('AuthMiddleware', () => {
  describe('disabled mode', () => {
    it('is a no-op that stamps the principal when AUTH_ENABLED=false', () => {
      const mw = makeMw({ ENABLED: false, TOKEN: undefined });
      const req = makeReq();
      const next = vi.fn() as unknown as NextFunction;
      mw.use(req, {} as Response, next);
      expect(next).toHaveBeenCalled();
      expect(req.principal).toEqual({ kind: 'core-service' });
    });
  });

  describe('configuration safeguards', () => {
    it('throws at construction time if AUTH_ENABLED=true but no token configured', () => {
      const cfg = makeAppConfigMock();
      cfg.env.AUTH = { ENABLED: true, TOKEN: undefined };
      expect(() => new AuthMiddleware(cfg, makeLoggerMock())).toThrowError(/CORE_AUTH_TOKEN/);
    });
  });

  describe('enabled mode — never throws, only stamps the principal', () => {
    let next: ReturnType<typeof vi.fn>;
    let logger: ILoggerService;
    let mw: AuthMiddleware;

    beforeEach(() => {
      next = vi.fn();
      logger = makeLoggerMock();
      mw = makeMw({ ENABLED: true, TOKEN: VALID_TOKEN }, logger);
    });

    it('stamps the principal for a correct Bearer token', () => {
      const req = makeReq({ authHeader: `Bearer ${VALID_TOKEN}` });
      mw.use(req, {} as Response, next as unknown as NextFunction);
      expect(next).toHaveBeenCalled();
      expect(req.principal).toEqual({ kind: 'core-service' });
    });

    it('leaves the principal undefined when no Authorization header is present', () => {
      const req = makeReq();
      mw.use(req, {} as Response, next as unknown as NextFunction);
      expect(next).toHaveBeenCalled();
      expect(req.principal).toBeUndefined();
    });

    it('leaves the principal undefined for a wrong scheme', () => {
      const req = makeReq({ authHeader: `Basic ${VALID_TOKEN}` });
      mw.use(req, {} as Response, next as unknown as NextFunction);
      expect(req.principal).toBeUndefined();
    });

    it('leaves the principal undefined for a token of different length (constant-time guard)', () => {
      const req = makeReq({ authHeader: 'Bearer short' });
      mw.use(req, {} as Response, next as unknown as NextFunction);
      expect(next).toHaveBeenCalled();
      expect(req.principal).toBeUndefined();
    });

    it('leaves the principal undefined and warns for a wrong token', () => {
      const req = makeReq({ authHeader: `Bearer ${'b'.repeat(32)}` });
      mw.use(req, {} as Response, next as unknown as NextFunction);
      expect(req.principal).toBeUndefined();
      expect(logger.warn).toHaveBeenCalledWith(
        '[AuthMiddleware] invalid bearer token',
        expect.objectContaining({ path: expect.any(String) }),
      );
    });
  });
});
