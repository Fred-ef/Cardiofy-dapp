import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BatchService } from './batch.service.js';
import { NotFoundError } from '#errors/not-found.error.js';
import {
  makeBatchRepoMock,
  makeViewRepoMock,
  makeNotaryGatewayMock,
  makeLoggerMock,
  makeAppConfigMock,
} from '#tests/support/mocks.js';
import { fixtures } from '#tests/support/fixtures.js';
import type { IBatchRepository } from './interfaces/i-batch.repository.js';
import type { IViewRepository } from '#modules/views/interfaces/i-view.repository.js';
import type { INotaryGateway } from '#modules/notary/interfaces/i-notary.gateway.js';
import type { ILoggerService } from '#infrastructure/logger/interfaces/i-logger.service.js';
import type { AppConfig } from '#infrastructure/config/index.js';

describe('BatchService', () => {
  let batchRepo: IBatchRepository;
  let viewRepo:  IViewRepository;
  let gateway:   INotaryGateway;
  let logger:    ILoggerService;
  let service:   BatchService;

  function makeService(cfg: AppConfig = makeAppConfigMock()): BatchService {
    return new BatchService(batchRepo, viewRepo, gateway, cfg, logger);
  }

  beforeEach(() => {
    batchRepo = makeBatchRepoMock();
    viewRepo  = makeViewRepoMock();
    gateway   = makeNotaryGatewayMock();
    logger    = makeLoggerMock();
    service   = makeService();
  });

  describe('previousPeriodId', () => {
    it('returns the unix timestamp of the previous UTC midnight (default BATCH_PERIOD_SECONDS=86400)', () => {
      const now      = new Date();
      const midnight = Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 1000);
      const expected = midnight - 86_400;
      expect(service.previousPeriodId()).toBe(expected);
    });

    it('honors a configured BATCH_PERIOD_SECONDS narrower than a day', () => {
      const periodSeconds = 300; // 5 minuti
      const cfg = makeAppConfigMock();
      cfg.env.SCHEDULE.BATCH_PERIOD_SECONDS = periodSeconds;
      const svc = makeService(cfg);

      const nowSeconds     = Math.floor(Date.now() / 1000);
      const currentBucket  = Math.floor(nowSeconds / periodSeconds) * periodSeconds;
      const expected       = currentBucket - periodSeconds;
      expect(svc.previousPeriodId()).toBe(expected);
    });
  });

  describe('publishBatchFor', () => {
    const periodId = 1_750_636_800;
    const aggregates = [
      { assetId: 'asset-A', viewsInPeriod: 3 },
      { assetId: 'asset-B', viewsInPeriod: 2 },
    ];

    it('returns null when the period has no views', async () => {
      vi.mocked(viewRepo.aggregatesForPeriod).mockResolvedValueOnce([]);
      const result = await service.publishBatchFor(periodId);
      expect(result).toBeNull();
      expect(batchRepo.ensureChunks).not.toHaveBeenCalled();
      expect(gateway.publishBatch).not.toHaveBeenCalled();
    });

    it('returns existing batch when already CONFIRMED (no work)', async () => {
      const existing = fixtures.batch({ periodId, status: 'CONFIRMED' });
      vi.mocked(batchRepo.findByPeriodId).mockResolvedValueOnce(existing);

      const result = await service.publishBatchFor(periodId);
      expect(result).toBe(existing);
      expect(viewRepo.aggregatesForPeriod).not.toHaveBeenCalled();
      expect(gateway.publishBatch).not.toHaveBeenCalled();
    });

    it('creates the period, ensures one chunk and submits it (single chunk)', async () => {
      vi.mocked(viewRepo.aggregatesForPeriod).mockResolvedValueOnce(aggregates);
      vi.mocked(batchRepo.createPending).mockResolvedValueOnce(fixtures.batch({ periodId }));
      vi.mocked(batchRepo.findChunks).mockResolvedValueOnce([
        fixtures.batchChunk({ periodId, chunkIndex: 0, txHash: null, payload: aggregates }),
      ]);
      vi.mocked(gateway.publishBatch).mockResolvedValueOnce({ txHash: fixtures.txHash });

      await service.publishBatchFor(periodId);

      expect(batchRepo.createPending).toHaveBeenCalledWith({
        periodId, assetCount: 2, viewsTotal: 5, payload: aggregates,
      });
      expect(batchRepo.ensureChunks).toHaveBeenCalledWith(periodId, [aggregates]);
      expect(gateway.publishBatch).toHaveBeenCalledWith(periodId, aggregates);
      expect(batchRepo.markChunkSubmitted).toHaveBeenCalledWith(periodId, 0, fixtures.txHash);
      expect(batchRepo.markSubmitted).toHaveBeenCalledWith(periodId, fixtures.txHash);
      // mirror + anchoring NON avvengono qui: sono a carico della riconciliazione
      expect(viewRepo.markPeriodAnchored).not.toHaveBeenCalled();
    });

    it('splits into multiple chunks when over BATCH_MAX_CHUNK', async () => {
      const cfg = makeAppConfigMock();
      cfg.env.SCHEDULE.BATCH_MAX_CHUNK = 2;
      const svc = makeService(cfg);
      const three = [
        { assetId: 'a', viewsInPeriod: 1 },
        { assetId: 'b', viewsInPeriod: 1 },
        { assetId: 'c', viewsInPeriod: 1 },
      ];
      vi.mocked(viewRepo.aggregatesForPeriod).mockResolvedValueOnce(three);
      vi.mocked(batchRepo.createPending).mockResolvedValueOnce(fixtures.batch({ periodId }));
      vi.mocked(batchRepo.findChunks).mockResolvedValueOnce([
        fixtures.batchChunk({ periodId, chunkIndex: 0, txHash: null, payload: [three[0]!, three[1]!] }),
        fixtures.batchChunk({ periodId, chunkIndex: 1, txHash: null, payload: [three[2]!] }),
      ]);
      vi.mocked(gateway.publishBatch).mockResolvedValue({ txHash: fixtures.txHash });

      await svc.publishBatchFor(periodId);

      expect(batchRepo.ensureChunks).toHaveBeenCalledWith(periodId, [[three[0], three[1]], [three[2]]]);
      expect(gateway.publishBatch).toHaveBeenCalledTimes(2);
      expect(batchRepo.markChunkSubmitted).toHaveBeenCalledTimes(2);
      expect(batchRepo.markSubmitted).toHaveBeenCalledTimes(1); // txHash di periodo solo dal primo chunk
    });

    it('resume: sends only unsent chunks, never re-sends a submitted one (anti double-count)', async () => {
      const existing = fixtures.batch({ periodId, status: 'PENDING', txHash: 'tx0' });
      vi.mocked(batchRepo.findByPeriodId).mockResolvedValueOnce(existing);
      vi.mocked(viewRepo.aggregatesForPeriod).mockResolvedValueOnce(aggregates);
      vi.mocked(batchRepo.findChunks).mockResolvedValueOnce([
        fixtures.batchChunk({ periodId, chunkIndex: 0, status: 'CONFIRMED', txHash: 'tx0', payload: [aggregates[0]!] }),
        fixtures.batchChunk({ periodId, chunkIndex: 1, status: 'PENDING', txHash: null, payload: [aggregates[1]!] }),
      ]);
      vi.mocked(gateway.publishBatch).mockResolvedValueOnce({ txHash: fixtures.txHash });

      await service.publishBatchFor(periodId);

      expect(batchRepo.createPending).not.toHaveBeenCalled();
      expect(gateway.publishBatch).toHaveBeenCalledTimes(1);
      expect(gateway.publishBatch).toHaveBeenCalledWith(periodId, [aggregates[1]]);
      expect(batchRepo.markChunkSubmitted).toHaveBeenCalledWith(periodId, 1, fixtures.txHash);
      expect(batchRepo.markSubmitted).not.toHaveBeenCalled(); // periodo già con txHash
    });

    it('a chunk send error marks it FAILED without blocking others or throwing', async () => {
      vi.mocked(viewRepo.aggregatesForPeriod).mockResolvedValueOnce(aggregates);
      vi.mocked(batchRepo.createPending).mockResolvedValueOnce(fixtures.batch({ periodId }));
      vi.mocked(batchRepo.findChunks).mockResolvedValueOnce([
        fixtures.batchChunk({ periodId, chunkIndex: 0, txHash: null, payload: [aggregates[0]!] }),
        fixtures.batchChunk({ periodId, chunkIndex: 1, txHash: null, payload: [aggregates[1]!] }),
      ]);
      vi.mocked(gateway.publishBatch)
        .mockRejectedValueOnce(new Error('chain unreachable'))
        .mockResolvedValueOnce({ txHash: fixtures.txHash });

      await expect(service.publishBatchFor(periodId)).resolves.not.toThrow();

      expect(batchRepo.markChunkFailed).toHaveBeenCalledWith(periodId, 0);
      expect(batchRepo.markChunkSubmitted).toHaveBeenCalledWith(periodId, 1, fixtures.txHash);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('get', () => {
    it('returns the batch when found', async () => {
      vi.mocked(batchRepo.findByPeriodId).mockResolvedValueOnce(fixtures.batch());
      const b = await service.get(1_750_636_800);
      expect(b).toBeDefined();
    });

    it('throws NotFoundError when missing', async () => {
      vi.mocked(batchRepo.findByPeriodId).mockResolvedValueOnce(null);
      await expect(service.get(999)).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
