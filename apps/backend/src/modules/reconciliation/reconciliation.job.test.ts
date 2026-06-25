import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReconcileJob } from './reconciliation.job.js';
import { makeAppConfigMock, makeLoggerMock } from '#tests/support/mocks.js';
import type { IReconciliationService } from './interfaces/i-reconciliation.service.js';
import type { ILoggerService } from '#infrastructure/logger/interfaces/i-logger.service.js';
import type { AppConfig } from '#infrastructure/config/index.js';

const noChain = (): Partial<AppConfig['env']> => ({
  NOTARY: {
    RPC_URL:          undefined as unknown as string,
    PRIVATE_KEY:      undefined as unknown as string,
    CONTRACT_ADDRESS: undefined as unknown as string,
    DEPLOY_BLOCK:     undefined as unknown as number,
    CHAIN_ID:         11155111,
    CONFIRMATIONS:    1,
  },
});

function makeReconcileServiceMock(): IReconciliationService {
  return { reconcileAll: vi.fn().mockResolvedValue(undefined) };
}

describe('ReconcileJob', () => {
  let service: IReconciliationService;
  let logger: ILoggerService;

  beforeEach(() => {
    service = makeReconcileServiceMock();
    logger = makeLoggerMock();
  });

  it('stays disabled (no cron) when on-chain config is absent', () => {
    const job = new ReconcileJob(service, makeAppConfigMock(noChain()), logger);
    job.start();
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('disabilitato'));
    expect(() => job.stop()).not.toThrow();
  });

  it('starts the cron when on-chain config is present', () => {
    const job = new ReconcileJob(service, makeAppConfigMock(), logger);
    job.start();
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('avvio'));
    job.stop();
  });

  it('runOnce runs reconciliation without logging an error on success', async () => {
    const job = new ReconcileJob(service, makeAppConfigMock(), logger);
    (job as unknown as { runOnce(): void }).runOnce();
    await vi.waitFor(() => expect(service.reconcileAll).toHaveBeenCalled());
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('runOnce catches and logs a rejected tick (no unhandled rejection)', async () => {
    vi.mocked(service.reconcileAll).mockRejectedValue(new Error('rpc down'));
    const job = new ReconcileJob(service, makeAppConfigMock(), logger);

    (job as unknown as { runOnce(): void }).runOnce();

    await vi.waitFor(() =>
      expect(logger.error).toHaveBeenCalledWith('[ReconcileJob] tick fallito', expect.any(Error)),
    );
  });
});
