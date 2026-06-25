import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Application } from './application.js';
import { makeAppConfigMock, makeLoggerMock } from '#tests/support/mocks.js';
import type { DatabaseConnection } from '#infrastructure/database/database.connection.js';
import type { ExpressApi } from '#src/express.api.js';
import type { BatchJob } from '#modules/batches/batch.job.js';
import type { ReconcileJob } from '#modules/reconciliation/reconciliation.job.js';

type Handler = (...args: unknown[]) => void;
const TIMEOUT_MS = 5_000; // = makeAppConfigMock().env.SERVER.SHUTDOWN_TIMEOUT_MS

/** Svuota la coda di microtask (la catena di shutdown è tutta promise-based). */
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

function setup(closeImpl?: (cb: (err?: Error) => void) => void) {
  const handlers: Record<string, Handler> = {};
  vi.spyOn(process, 'on').mockImplementation(((event: string, h: Handler) => {
    handlers[event] = h;
    return process;
  }) as never);
  const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((() => undefined) as never));

  const fakeServer = {
    close: vi.fn((cb?: (err?: Error) => void) => {
      if (closeImpl) closeImpl(cb ?? (() => {}));
      else cb?.(); // default: chiusura immediata con successo
      return fakeServer;
    }),
    closeIdleConnections: vi.fn(),
    closeAllConnections: vi.fn(),
  };
  const db = {
    testConnection: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  };
  const expressApi = { app: { listen: vi.fn((_p: number, cb?: () => void) => { cb?.(); return fakeServer; }) } };
  const batchJob = { start: vi.fn(), stop: vi.fn() };
  const reconcileJob = { start: vi.fn(), stop: vi.fn() };
  const logger = makeLoggerMock();

  const app = new Application(
    db as unknown as DatabaseConnection,
    expressApi as unknown as ExpressApi,
    makeAppConfigMock(),
    logger,
    batchJob as unknown as BatchJob,
    reconcileJob as unknown as ReconcileJob,
  );
  return { app, handlers, exitSpy, fakeServer, db, batchJob, reconcileJob, logger };
}

describe('Application — graceful shutdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    process.exitCode = 7; // sentinella: prova che sia il codice a portarlo a 0
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    process.exitCode = 0;
  });

  it('on SIGTERM: drains (close + closeIdleConnections, stop jobs, close db) and sets exitCode=0 without forcing exit', async () => {
    const ctx = setup();
    await ctx.app.run();

    ctx.handlers['SIGTERM']!();
    await flush();

    expect(ctx.fakeServer.close).toHaveBeenCalled();
    expect(ctx.fakeServer.closeIdleConnections).toHaveBeenCalled();
    expect(ctx.batchJob.stop).toHaveBeenCalled();
    expect(ctx.reconcileJob.stop).toHaveBeenCalled();
    expect(ctx.db.close).toHaveBeenCalled();
    expect(process.exitCode).toBe(0);
    expect(ctx.exitSpy).not.toHaveBeenCalled(); // niente process.exit() sul path di successo
  });

  it('on SIGINT: same graceful drain', async () => {
    const ctx = setup();
    await ctx.app.run();

    ctx.handlers['SIGINT']!();
    await flush();

    expect(ctx.db.close).toHaveBeenCalled();
    expect(process.exitCode).toBe(0);
    expect(ctx.exitSpy).not.toHaveBeenCalled();
  });

  it('treats ERR_SERVER_NOT_RUNNING from server.close as success', async () => {
    const ctx = setup((cb) => cb(Object.assign(new Error('not running'), { code: 'ERR_SERVER_NOT_RUNNING' })));
    await ctx.app.run();

    ctx.handlers['SIGTERM']!();
    await flush();

    expect(process.exitCode).toBe(0);
    expect(ctx.exitSpy).not.toHaveBeenCalled();
  });

  it('forces exit(1) when server.close fails with a real error', async () => {
    const ctx = setup((cb) => cb(Object.assign(new Error('boom'), { code: 'EADDRINUSE' })));
    await ctx.app.run();

    ctx.handlers['SIGTERM']!();
    await flush();

    expect(ctx.exitSpy).toHaveBeenCalledWith(1);
    expect(ctx.logger.error).toHaveBeenCalledWith("[shutdown] errore durante l'arresto", expect.anything());
  });

  it('forces exit(1) when db.close rejects', async () => {
    const ctx = setup();
    ctx.db.close.mockRejectedValueOnce(new Error('db stuck'));
    await ctx.app.run();

    ctx.handlers['SIGTERM']!();
    await flush();

    expect(ctx.exitSpy).toHaveBeenCalledWith(1);
  });

  it('on force-timeout: destroys remaining sockets and exits(1)', async () => {
    // close() non richiama mai il callback → il drain resta appeso.
    const ctx = setup(() => { /* never calls cb */ });
    await ctx.app.run();

    ctx.handlers['SIGTERM']!();
    await flush();
    expect(ctx.exitSpy).not.toHaveBeenCalled(); // non ancora: il drain è appeso

    await vi.advanceTimersByTimeAsync(TIMEOUT_MS);

    expect(ctx.fakeServer.closeAllConnections).toHaveBeenCalled();
    expect(ctx.exitSpy).toHaveBeenCalledWith(1);
  });

  it('on uncaughtException: fatal shutdown exits(1)', async () => {
    const ctx = setup();
    await ctx.app.run();

    ctx.handlers['uncaughtException']!(new Error('kaboom'));
    await flush();

    expect(ctx.db.close).toHaveBeenCalled();
    expect(ctx.exitSpy).toHaveBeenCalledWith(1);
  });

  it('on unhandledRejection: fatal shutdown exits(1)', async () => {
    const ctx = setup();
    await ctx.app.run();

    ctx.handlers['unhandledRejection']!('some reason');
    await flush();

    expect(ctx.exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits(1) when startup fails (DB unreachable)', async () => {
    const ctx = setup();
    ctx.db.testConnection.mockRejectedValueOnce(new Error('no db'));

    await ctx.app.run();

    expect(ctx.logger.error).toHaveBeenCalledWith('Impossibile avviare il server', expect.anything());
    expect(ctx.exitSpy).toHaveBeenCalledWith(1);
  });

  it('on fatal shutdown with a hanging drain: force-timeout destroys sockets and exits(1)', async () => {
    const ctx = setup(() => { /* close never calls cb → drain appeso anche nel path fatale */ });
    await ctx.app.run();

    ctx.handlers['uncaughtException']!(new Error('kaboom'));
    await flush();

    await vi.advanceTimersByTimeAsync(TIMEOUT_MS);

    expect(ctx.fakeServer.closeAllConnections).toHaveBeenCalled();
    expect(ctx.exitSpy).toHaveBeenCalledWith(1);
  });
});
