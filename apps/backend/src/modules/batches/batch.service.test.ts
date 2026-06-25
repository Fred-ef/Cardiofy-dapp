import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BatchService } from './batch.service.js';
import { NotFoundError } from '#errors/not-found.error.js';
import {
  makeBatchRepoMock,
  makeViewRepoMock,
  makeAssetRepoMock,
  makeNotaryGatewayMock,
  makeLoggerMock,
} from '#tests/support/mocks.js';
import { fixtures } from '#tests/support/fixtures.js';
import type { IBatchRepository } from './interfaces/i-batch.repository.js';
import type { IViewRepository } from '#modules/views/interfaces/i-view.repository.js';
import type { IAssetRepository } from '#modules/assets/interfaces/i-asset.repository.js';
import type { INotaryGateway } from '#modules/notary/interfaces/i-notary.gateway.js';
import type { ILoggerService } from '#infrastructure/logger/interfaces/i-logger.service.js';

describe('BatchService', () => {
  let batchRepo: IBatchRepository;
  let viewRepo:  IViewRepository;
  let assetRepo: IAssetRepository;
  let gateway:   INotaryGateway;
  let logger:    ILoggerService;
  let service:   BatchService;

  beforeEach(() => {
    batchRepo = makeBatchRepoMock();
    viewRepo  = makeViewRepoMock();
    assetRepo = makeAssetRepoMock();
    gateway   = makeNotaryGatewayMock();
    logger    = makeLoggerMock();
    service   = new BatchService(batchRepo, viewRepo, assetRepo, gateway, logger);
  });

  describe('yesterdayPeriodId', () => {
    it('returns the unix timestamp of the previous UTC midnight', () => {
      const now      = new Date();
      const midnight = Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 1000);
      const expected = midnight - 86_400;
      expect(service.yesterdayPeriodId()).toBe(expected);
    });
  });

  describe('publishBatchFor', () => {
    const periodId = 1_750_636_800;

    it('returns null when the period has no views', async () => {
      vi.mocked(viewRepo.aggregatesForPeriod).mockResolvedValueOnce([]);
      const result = await service.publishBatchFor(periodId);
      expect(result).toBeNull();
      expect(gateway.publishBatch).not.toHaveBeenCalled();
      expect(batchRepo.createPending).not.toHaveBeenCalled();
    });

    it('publishes aggregates on-chain and updates mirrors', async () => {
      const aggregates = [
        { assetId: 'asset-A', viewsInPeriod: 3 },
        { assetId: 'asset-B', viewsInPeriod: 2 },
      ];
      vi.mocked(viewRepo.aggregatesForPeriod).mockResolvedValueOnce(aggregates);
      vi.mocked(batchRepo.createPending).mockResolvedValueOnce(fixtures.batch({ periodId }));
      vi.mocked(gateway.publishBatch).mockResolvedValueOnce({ txHash: fixtures.txHash });

      await service.publishBatchFor(periodId);

      expect(batchRepo.createPending).toHaveBeenCalledWith({
        periodId,
        assetCount: 2,
        viewsTotal: 5,
        payload:    aggregates,
      });
      expect(gateway.publishBatch).toHaveBeenCalledWith(periodId, aggregates);
      expect(batchRepo.markSubmitted).toHaveBeenCalledWith(periodId, fixtures.txHash);
      expect(assetRepo.incrementMirrorViews).toHaveBeenCalledWith('asset-A', 3);
      expect(assetRepo.incrementMirrorViews).toHaveBeenCalledWith('asset-B', 2);
      expect(viewRepo.markPeriodAnchored).toHaveBeenCalledWith(periodId);
    });

    it('skips if a non-FAILED batch is already present (idempotency)', async () => {
      const existing = fixtures.batch({ periodId });
      vi.mocked(batchRepo.findByPeriodId).mockResolvedValueOnce(existing);

      const result = await service.publishBatchFor(periodId);
      expect(result).toBe(existing);
      expect(viewRepo.aggregatesForPeriod).not.toHaveBeenCalled();
      expect(gateway.publishBatch).not.toHaveBeenCalled();
    });

    it('marks FAILED and rethrows when gateway fails after createPending', async () => {
      vi.mocked(viewRepo.aggregatesForPeriod).mockResolvedValueOnce([{ assetId: 'asset-A', viewsInPeriod: 1 }]);
      vi.mocked(batchRepo.createPending).mockResolvedValueOnce(fixtures.batch({ periodId }));
      vi.mocked(gateway.publishBatch).mockRejectedValueOnce(new Error('chain unreachable'));

      await expect(service.publishBatchFor(periodId)).rejects.toThrow('chain unreachable');
      expect(batchRepo.markFailed).toHaveBeenCalledWith(periodId);
      expect(assetRepo.incrementMirrorViews).not.toHaveBeenCalled();
      expect(viewRepo.markPeriodAnchored).not.toHaveBeenCalled();
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
