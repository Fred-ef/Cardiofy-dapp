import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { HealthService } from './health.service.js';
import { makeAppConfigMock, makeLoggerMock } from '#tests/support/mocks.js';
import type { DatabaseConnection } from '#infrastructure/database/database.connection.js';

function makeDbMock(behavior: 'ok' | 'fail'): DatabaseConnection {
  return {
    testConnection: vi.fn().mockImplementation(async () => {
      if (behavior === 'fail') throw new Error('db unreachable');
    }),
  } as unknown as DatabaseConnection;
}

describe('HealthService', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('reports ready=true when database is up and RPC is not configured', async () => {
    const db = makeDbMock('ok');
    const cfg = makeAppConfigMock({
      NOTARY: {
        RPC_URL: undefined as unknown as string,
        PRIVATE_KEY: undefined as unknown as string,
        CONTRACT_ADDRESS: undefined as unknown as string,
        DEPLOY_BLOCK: undefined as unknown as number,
        CHAIN_ID: 11155111,
        CONFIRMATIONS: 1,
      },
    });
    const svc = new HealthService(db, cfg, makeLoggerMock());
    const report = await svc.checkReadiness();

    expect(report.ready).toBe(true);
    expect(report.checks.find((c) => c.name === 'database')?.status).toBe('ok');
    expect(report.checks.find((c) => c.name === 'notary-rpc')?.status).toBe('skip');
  });

  it('reports ready=false when database is down', async () => {
    const db = makeDbMock('fail');
    const svc = new HealthService(db, makeAppConfigMock(), makeLoggerMock());
    const report = await svc.checkReadiness();
    expect(report.ready).toBe(false);
    expect(report.checks.find((c) => c.name === 'database')?.status).toBe('fail');
  });

  it('reports RPC ok when JSON-RPC responds with a result field', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ jsonrpc: '2.0', id: 1, result: '0xaa36a7' }),
    }) as unknown as typeof fetch;

    const svc = new HealthService(makeDbMock('ok'), makeAppConfigMock(), makeLoggerMock());
    const report = await svc.checkReadiness();
    expect(report.ready).toBe(true);
    expect(report.checks.find((c) => c.name === 'notary-rpc')?.status).toBe('ok');
  });

  it('reports RPC fail when JSON-RPC returns an error object', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ jsonrpc: '2.0', id: 1, error: { message: 'broken' } }),
    }) as unknown as typeof fetch;

    const svc = new HealthService(makeDbMock('ok'), makeAppConfigMock(), makeLoggerMock());
    const report = await svc.checkReadiness();
    expect(report.ready).toBe(false);
    expect(report.checks.find((c) => c.name === 'notary-rpc')?.status).toBe('fail');
  });

  it('reports RPC fail on a non-2xx HTTP response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({}),
    }) as unknown as typeof fetch;

    const svc = new HealthService(makeDbMock('ok'), makeAppConfigMock(), makeLoggerMock());
    const report = await svc.checkReadiness();
    expect(report.ready).toBe(false);
    expect(report.checks.find((c) => c.name === 'notary-rpc')?.error).toMatch(/HTTP 503/);
  });

  it('reports RPC fail on a malformed JSON-RPC payload (no string result)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ jsonrpc: '2.0', id: 1, result: 12345 }),
    }) as unknown as typeof fetch;

    const svc = new HealthService(makeDbMock('ok'), makeAppConfigMock(), makeLoggerMock());
    const report = await svc.checkReadiness();
    expect(report.ready).toBe(false);
    expect(report.checks.find((c) => c.name === 'notary-rpc')?.status).toBe('fail');
  });
});
