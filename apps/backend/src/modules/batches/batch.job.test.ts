import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BatchJob } from './batch.job.js';
import { makeAppConfigMock, makeLoggerMock, makeBatchServiceMock } from '#tests/support/mocks.js';
import type { IBatchService } from './interfaces/i-batch.service.js';
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

describe('BatchJob', () => {
  let service: IBatchService;
  let logger: ILoggerService;

  beforeEach(() => {
    service = makeBatchServiceMock();
    logger = makeLoggerMock();
  });

  it('stays disabled (no cron) when on-chain config is absent', () => {
    const job = new BatchJob(service, makeAppConfigMock(noChain()), logger);
    job.start();
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('disabilitato'));
    expect(() => job.stop()).not.toThrow(); // stop() è no-op safe se non avviato
  });

  it('starts the cron when on-chain config is present', () => {
    const job = new BatchJob(service, makeAppConfigMock(), logger);
    job.start();
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('avvio'));
    job.stop();
  });

  it('runOnce logs success when a batch is published', async () => {
    vi.mocked(service.previousPeriodId).mockReturnValue(123);
    vi.mocked(service.publishBatchFor).mockResolvedValue({ periodId: 123 } as never);
    const job = new BatchJob(service, makeAppConfigMock(), logger);

    (job as unknown as { runOnce(): void }).runOnce();

    await vi.waitFor(() => expect(service.publishBatchFor).toHaveBeenCalledWith(123));
    await vi.waitFor(() =>
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('pubblicato batch')),
    );
  });

  it('runOnce catches and logs a rejected tick (no unhandled rejection)', async () => {
    vi.mocked(service.publishBatchFor).mockRejectedValue(new Error('chain down'));
    const job = new BatchJob(service, makeAppConfigMock(), logger);

    (job as unknown as { runOnce(): void }).runOnce();

    await vi.waitFor(() =>
      expect(logger.error).toHaveBeenCalledWith('[BatchJob] tick fallito', expect.any(Error)),
    );
  });
});
