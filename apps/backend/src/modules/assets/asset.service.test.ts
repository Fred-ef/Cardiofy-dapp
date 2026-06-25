import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AssetService } from './asset.service.js';
import { ConflictError } from '#errors/conflict.error.js';
import { NotFoundError } from '#errors/not-found.error.js';
import {
  makeAssetRepoMock,
  makeNotaryGatewayMock,
  makeLoggerMock,
  makeAppConfigMock,
} from '#tests/support/mocks.js';
import { fixtures } from '#tests/support/fixtures.js';
import type { IAssetRepository } from './interfaces/i-asset.repository.js';
import type { INotaryGateway } from '#modules/notary/interfaces/i-notary.gateway.js';
import type { ILoggerService } from '#infrastructure/logger/interfaces/i-logger.service.js';

describe('AssetService', () => {
  let repo:    IAssetRepository;
  let gateway: INotaryGateway;
  let logger:  ILoggerService;
  let service: AssetService;

  beforeEach(() => {
    repo    = makeAssetRepoMock();
    gateway = makeNotaryGatewayMock();
    logger  = makeLoggerMock();
    service = new AssetService(repo, gateway, makeAppConfigMock(), logger);
  });

  describe('notarize', () => {
    it('persists asset, dispatches to gateway, and returns receipt', async () => {
      const expected = fixtures.asset();
      vi.mocked(repo.findById).mockResolvedValueOnce(null);
      vi.mocked(repo.create).mockResolvedValueOnce(expected);
      vi.mocked(gateway.notarizeAsset).mockResolvedValueOnce({ txHash: fixtures.txHash });

      const result = await service.notarize(expected.assetId, expected.contentHash);

      expect(repo.create).toHaveBeenCalledWith({
        assetId:     expected.assetId,
        contentHash: expected.contentHash,
      });
      expect(gateway.notarizeAsset).toHaveBeenCalledWith(expected.assetId, expected.contentHash);
      expect(repo.markSubmitted).toHaveBeenCalledWith(expected.assetId, fixtures.txHash);
      expect(result.asset.assetId).toBe(expected.assetId);
      expect(result.txHash).toBe(fixtures.txHash);
      expect(result.chainId).toBe(11155111);
    });

    it('throws ConflictError if the asset already exists', async () => {
      vi.mocked(repo.findById).mockResolvedValueOnce(fixtures.asset());

      await expect(service.notarize('asset-test-1', fixtures.hashA))
        .rejects.toBeInstanceOf(ConflictError);
      expect(repo.create).not.toHaveBeenCalled();
      expect(gateway.notarizeAsset).not.toHaveBeenCalled();
    });

    it('marks the row as FAILED if the gateway throws', async () => {
      vi.mocked(repo.findById).mockResolvedValueOnce(null);
      vi.mocked(repo.create).mockResolvedValueOnce(fixtures.asset());
      vi.mocked(gateway.notarizeAsset).mockRejectedValueOnce(new Error('RPC down'));

      await expect(service.notarize('asset-test-1', fixtures.hashA)).rejects.toThrow('RPC down');
      expect(repo.markFailed).toHaveBeenCalledWith('asset-test-1');
      expect(repo.markSubmitted).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('requireExists / get', () => {
    it('returns the asset when found', async () => {
      vi.mocked(repo.findById).mockResolvedValueOnce(fixtures.asset());
      const result = await service.requireExists('asset-test-1');
      expect(result.assetId).toBe('asset-test-1');
    });

    it('throws NotFoundError when missing', async () => {
      vi.mocked(repo.findById).mockResolvedValueOnce(null);
      await expect(service.requireExists('ghost')).rejects.toBeInstanceOf(NotFoundError);
      await expect(service.get('ghost')).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
