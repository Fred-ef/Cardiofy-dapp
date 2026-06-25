import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContractService } from './contract.service.js';
import { ConflictError } from '#errors/conflict.error.js';
import { NotFoundError } from '#errors/not-found.error.js';
import {
  makeContractRepoMock,
  makeNotaryGatewayMock,
  makeLoggerMock,
  makeAppConfigMock,
} from '#tests/support/mocks.js';
import { fixtures } from '#tests/support/fixtures.js';
import type { IContractRepository } from './interfaces/i-contract.repository.js';
import type { INotaryGateway } from '#modules/notary/interfaces/i-notary.gateway.js';
import type { ILoggerService } from '#infrastructure/logger/interfaces/i-logger.service.js';

describe('ContractService', () => {
  let repo:    IContractRepository;
  let gateway: INotaryGateway;
  let logger:  ILoggerService;
  let service: ContractService;

  beforeEach(() => {
    repo    = makeContractRepoMock();
    gateway = makeNotaryGatewayMock();
    logger  = makeLoggerMock();
    service = new ContractService(repo, gateway, makeAppConfigMock(), logger);
  });

  describe('notarize', () => {
    it('persists, dispatches on-chain and returns receipt', async () => {
      const expected = fixtures.contract();
      vi.mocked(repo.findById).mockResolvedValueOnce(null);
      vi.mocked(repo.create).mockResolvedValueOnce(expected);
      vi.mocked(gateway.notarizeContract).mockResolvedValueOnce({ txHash: fixtures.txHash });

      const result = await service.notarize(expected.contractId, expected.contentHash);

      expect(repo.create).toHaveBeenCalledOnce();
      expect(gateway.notarizeContract).toHaveBeenCalledWith(expected.contractId, expected.contentHash);
      expect(repo.markSubmitted).toHaveBeenCalledWith(expected.contractId, fixtures.txHash);
      expect(result.txHash).toBe(fixtures.txHash);
      expect(result.chainId).toBe(11155111);
    });

    it('throws ConflictError on duplicate contractId', async () => {
      vi.mocked(repo.findById).mockResolvedValueOnce(fixtures.contract());
      await expect(service.notarize('contract-test-1', fixtures.hashA))
        .rejects.toBeInstanceOf(ConflictError);
      expect(repo.create).not.toHaveBeenCalled();
      expect(gateway.notarizeContract).not.toHaveBeenCalled();
    });

    it('marks FAILED and rethrows when gateway fails', async () => {
      vi.mocked(repo.findById).mockResolvedValueOnce(null);
      vi.mocked(repo.create).mockResolvedValueOnce(fixtures.contract());
      vi.mocked(gateway.notarizeContract).mockRejectedValueOnce(new Error('boom'));

      await expect(service.notarize('contract-test-1', fixtures.hashA)).rejects.toThrow('boom');
      expect(repo.markFailed).toHaveBeenCalledWith('contract-test-1');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('get', () => {
    it('returns the contract when found', async () => {
      vi.mocked(repo.findById).mockResolvedValueOnce(fixtures.contract());
      const c = await service.get('contract-test-1');
      expect(c.contractId).toBe('contract-test-1');
    });

    it('throws NotFoundError when not found', async () => {
      vi.mocked(repo.findById).mockResolvedValueOnce(null);
      await expect(service.get('ghost')).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
