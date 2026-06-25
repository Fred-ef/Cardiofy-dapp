import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReconciliationService } from './reconciliation.service.js';
import {
  makeAssetRepoMock,
  makeContractRepoMock,
  makeBatchRepoMock,
  makeNotaryGatewayMock,
  makeLoggerMock,
  makeAppConfigMock,
} from '#tests/support/mocks.js';
import { fixtures } from '#tests/support/fixtures.js';
import type { IAssetRepository } from '#modules/assets/interfaces/i-asset.repository.js';
import type { IContractRepository } from '#modules/contracts/interfaces/i-contract.repository.js';
import type { IBatchRepository } from '#modules/batches/interfaces/i-batch.repository.js';
import type { INotaryGateway } from '#modules/notary/interfaces/i-notary.gateway.js';
import type { ILoggerService } from '#infrastructure/logger/interfaces/i-logger.service.js';

const CONFIRMATION_DEPTH = 3;
const TX = '0x' + 'dd'.repeat(32);

describe('ReconciliationService', () => {
  let assets:    IAssetRepository;
  let contracts: IContractRepository;
  let batches:   IBatchRepository;
  let gateway:   INotaryGateway;
  let logger:    ILoggerService;
  let service:   ReconciliationService;

  beforeEach(() => {
    assets    = makeAssetRepoMock();
    contracts = makeContractRepoMock();
    batches   = makeBatchRepoMock();
    gateway   = makeNotaryGatewayMock();
    logger    = makeLoggerMock();
    const cfg = makeAppConfigMock({
      NOTARY: {
        RPC_URL: 'http://x',
        PRIVATE_KEY: '0x' + '11'.repeat(32),
        CONTRACT_ADDRESS: '0x' + '22'.repeat(20),
        DEPLOY_BLOCK: 0,
        CHAIN_ID: 11155111,
        CONFIRMATIONS: CONFIRMATION_DEPTH,
      },
    });
    service = new ReconciliationService(contracts, assets, batches, gateway, cfg, logger);
  });

  describe('reconcileAll — confirmation logic', () => {
    it('marks an asset as CONFIRMED once confirmations reach the threshold', async () => {
      vi.mocked(assets.findPendingWithTx).mockResolvedValueOnce([
        fixtures.asset({ assetId: 'asset-1', txHash: TX }),
      ]);
      vi.mocked(gateway.confirmations).mockResolvedValueOnce({
        confirmations: CONFIRMATION_DEPTH,
        blockNumber: 1234,
      });

      const summary = await service.reconcileAll();

      expect(assets.markConfirmed).toHaveBeenCalledWith('asset-1', 1234, expect.any(Date));
      expect(summary.assets.confirmed).toBe(1);
      expect(summary.assets.stillPending).toBe(0);
    });

    it('leaves an asset PENDING when confirmations are below threshold', async () => {
      vi.mocked(assets.findPendingWithTx).mockResolvedValueOnce([
        fixtures.asset({ assetId: 'asset-1', txHash: TX }),
      ]);
      vi.mocked(gateway.confirmations).mockResolvedValueOnce({
        confirmations: CONFIRMATION_DEPTH - 1,
        blockNumber: 1234,
      });

      const summary = await service.reconcileAll();

      expect(assets.markConfirmed).not.toHaveBeenCalled();
      expect(summary.assets.stillPending).toBe(1);
    });

    it('handles confirmations() throwing without aborting the run (Promise.allSettled)', async () => {
      vi.mocked(contracts.findPendingWithTx).mockResolvedValueOnce([
        fixtures.contract({ contractId: 'c1', txHash: TX }),
        fixtures.contract({ contractId: 'c2', txHash: TX }),
      ]);
      vi.mocked(gateway.confirmations)
        .mockRejectedValueOnce(new Error('RPC down'))
        .mockResolvedValueOnce({ confirmations: CONFIRMATION_DEPTH, blockNumber: 99 });

      const summary = await service.reconcileAll();

      expect(summary.contracts.failed).toBe(1);
      expect(summary.contracts.confirmed).toBe(1);
      expect(logger.error).toHaveBeenCalled();
    });

    it('reconciles batches as well as assets and contracts', async () => {
      vi.mocked(batches.findPendingWithTx).mockResolvedValueOnce([
        fixtures.batch({ periodId: 1_700_000_000, txHash: TX }),
      ]);
      vi.mocked(gateway.confirmations).mockResolvedValueOnce({
        confirmations: CONFIRMATION_DEPTH * 2,
        blockNumber: 5000,
      });

      const summary = await service.reconcileAll();
      expect(batches.markConfirmed).toHaveBeenCalledWith(1_700_000_000, 5000, expect.any(Date));
      expect(summary.batches.confirmed).toBe(1);
    });

    it('TB-9b: keeps a batch PENDING when on-chain totalViews mismatches the local mirror', async () => {
      vi.mocked(batches.findPendingWithTx).mockResolvedValueOnce([
        fixtures.batch({ periodId: 1_700_000_000, txHash: TX }),
      ]);
      vi.mocked(gateway.confirmations).mockResolvedValueOnce({
        confirmations: CONFIRMATION_DEPTH,
        blockNumber: 5000,
      });
      // fixture.batch ha payload con asset-test-1 (3 view) e asset-test-2 (2 view).
      // Local mirror per asset-test-1 = 10; on-chain ritorna 99 → mismatch.
      vi.mocked(gateway.getAssetTotalViews).mockResolvedValueOnce(99n);
      vi.mocked(assets.findById).mockResolvedValueOnce(
        fixtures.asset({ assetId: 'asset-test-1', totalViewsMirror: 10 }),
      );

      const summary = await service.reconcileAll();

      expect(batches.markConfirmed).not.toHaveBeenCalled();
      expect(summary.batches.stillPending).toBe(1);
      expect(summary.batches.confirmed).toBe(0);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('mismatch'),
        undefined,
        expect.objectContaining({ assetId: 'asset-test-1' }),
      );
    });

    it('TB-9b: confirms the batch when on-chain returns null for every asset (skip silenzioso)', async () => {
      vi.mocked(batches.findPendingWithTx).mockResolvedValueOnce([
        fixtures.batch({ periodId: 1_700_000_000, txHash: TX }),
      ]);
      vi.mocked(gateway.confirmations).mockResolvedValueOnce({
        confirmations: CONFIRMATION_DEPTH,
        blockNumber: 5000,
      });
      vi.mocked(gateway.getAssetTotalViews).mockResolvedValue(null);

      const summary = await service.reconcileAll();
      expect(batches.markConfirmed).toHaveBeenCalled();
      expect(summary.batches.confirmed).toBe(1);
    });

    it('leaves a batch PENDING when confirmations are below threshold', async () => {
      vi.mocked(batches.findPendingWithTx).mockResolvedValueOnce([
        fixtures.batch({ periodId: 1_700_000_000, txHash: TX }),
      ]);
      vi.mocked(gateway.confirmations).mockResolvedValueOnce({
        confirmations: CONFIRMATION_DEPTH - 1,
        blockNumber: 5000,
      });

      const summary = await service.reconcileAll();
      expect(batches.markConfirmed).not.toHaveBeenCalled();
      expect(summary.batches.stillPending).toBe(1);
      expect(summary.batches.confirmed).toBe(0);
    });

    it('counts a batch as failed (and logs) when confirmations() throws', async () => {
      vi.mocked(batches.findPendingWithTx).mockResolvedValueOnce([
        fixtures.batch({ periodId: 1_700_000_000, txHash: TX }),
      ]);
      vi.mocked(gateway.confirmations).mockRejectedValueOnce(new Error('RPC down'));

      const summary = await service.reconcileAll();
      expect(summary.batches.failed).toBe(1);
      expect(logger.error).toHaveBeenCalledWith(
        '[Reconciliation] batch failed',
        expect.any(Error),
        expect.objectContaining({ periodId: 1_700_000_000 }),
      );
    });

    it('returns zero counters when nothing is pending', async () => {
      const summary = await service.reconcileAll();
      expect(summary).toEqual({
        contracts: { scanned: 0, confirmed: 0, stillPending: 0, failed: 0 },
        assets:    { scanned: 0, confirmed: 0, stillPending: 0, failed: 0 },
        batches:   { scanned: 0, confirmed: 0, stillPending: 0, failed: 0 },
      });
      expect(gateway.confirmations).not.toHaveBeenCalled();
    });
  });
});
