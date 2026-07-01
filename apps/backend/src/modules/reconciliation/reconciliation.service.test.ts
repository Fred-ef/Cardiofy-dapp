import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReconciliationService } from './reconciliation.service.js';
import {
  makeAssetRepoMock,
  makeContractRepoMock,
  makeBatchRepoMock,
  makeViewRepoMock,
  makeNotaryGatewayMock,
  makeLoggerMock,
  makeAppConfigMock,
} from '#tests/support/mocks.js';
import { fixtures } from '#tests/support/fixtures.js';
import type { IAssetRepository } from '#modules/assets/interfaces/i-asset.repository.js';
import type { IContractRepository } from '#modules/contracts/interfaces/i-contract.repository.js';
import type { IBatchRepository } from '#modules/batches/interfaces/i-batch.repository.js';
import type { IViewRepository } from '#modules/views/interfaces/i-view.repository.js';
import type { INotaryGateway } from '#modules/notary/interfaces/i-notary.gateway.js';
import type { ILoggerService } from '#infrastructure/logger/interfaces/i-logger.service.js';

const CONFIRMATION_DEPTH = 3;
const TX = '0x' + 'dd'.repeat(32);
const PERIOD = 1_700_000_000;

describe('ReconciliationService', () => {
  let assets:    IAssetRepository;
  let contracts: IContractRepository;
  let batches:   IBatchRepository;
  let views:     IViewRepository;
  let gateway:   INotaryGateway;
  let logger:    ILoggerService;
  let service:   ReconciliationService;

  beforeEach(() => {
    assets    = makeAssetRepoMock();
    contracts = makeContractRepoMock();
    batches   = makeBatchRepoMock();
    views     = makeViewRepoMock();
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
    service = new ReconciliationService(contracts, assets, batches, views, gateway, cfg, logger);
  });

  describe('contracts & assets', () => {
    it('marks an asset as CONFIRMED once confirmations reach the threshold', async () => {
      vi.mocked(assets.findPendingWithTx).mockResolvedValueOnce([fixtures.asset({ assetId: 'asset-1', txHash: TX })]);
      vi.mocked(gateway.confirmations).mockResolvedValueOnce({ confirmations: CONFIRMATION_DEPTH, blockNumber: 1234 });

      const summary = await service.reconcileAll();

      expect(assets.markConfirmed).toHaveBeenCalledWith('asset-1', 1234, expect.any(Date));
      expect(summary.assets.confirmed).toBe(1);
    });

    it('leaves an asset PENDING when confirmations are below threshold', async () => {
      vi.mocked(assets.findPendingWithTx).mockResolvedValueOnce([fixtures.asset({ assetId: 'asset-1', txHash: TX })]);
      vi.mocked(gateway.confirmations).mockResolvedValueOnce({ confirmations: CONFIRMATION_DEPTH - 1, blockNumber: 1234 });

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
  });

  describe('batches — chunk confirmation (phase a)', () => {
    it('confirms a chunk that reached the threshold', async () => {
      vi.mocked(batches.findPendingChunksWithTx).mockResolvedValueOnce([
        fixtures.batchChunk({ periodId: PERIOD, chunkIndex: 0, status: 'PENDING', txHash: TX }),
      ]);
      vi.mocked(gateway.confirmations).mockResolvedValueOnce({ confirmations: CONFIRMATION_DEPTH, blockNumber: 5000 });

      await service.reconcileAll();
      expect(batches.markChunkConfirmed).toHaveBeenCalledWith(PERIOD, 0, 5000, expect.any(Date));
    });

    it('leaves a chunk PENDING when confirmations are below threshold', async () => {
      vi.mocked(batches.findPendingChunksWithTx).mockResolvedValueOnce([
        fixtures.batchChunk({ periodId: PERIOD, chunkIndex: 0, status: 'PENDING', txHash: TX }),
      ]);
      vi.mocked(gateway.confirmations).mockResolvedValueOnce({ confirmations: CONFIRMATION_DEPTH - 1, blockNumber: 5000 });

      await service.reconcileAll();
      expect(batches.markChunkConfirmed).not.toHaveBeenCalled();
    });

    it('a chunk confirmation error does not abort the run', async () => {
      vi.mocked(batches.findPendingChunksWithTx).mockResolvedValueOnce([
        fixtures.batchChunk({ periodId: PERIOD, chunkIndex: 0, status: 'PENDING', txHash: TX }),
      ]);
      vi.mocked(gateway.confirmations).mockRejectedValueOnce(new Error('RPC down'));

      await service.reconcileAll();
      expect(batches.markChunkConfirmed).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        '[Reconciliation] chunk confirm failed',
        expect.any(Error),
        expect.objectContaining({ periodId: PERIOD }),
      );
    });
  });

  describe('batches — period finalization (phase b)', () => {
    it('finalizes a period when all chunks are confirmed: mirror once + confirm + anchor', async () => {
      vi.mocked(batches.findPendingBatches).mockResolvedValueOnce([fixtures.batch({ periodId: PERIOD, mirrorApplied: false })]);
      vi.mocked(batches.findChunks).mockResolvedValueOnce([
        fixtures.batchChunk({ periodId: PERIOD, chunkIndex: 0, status: 'CONFIRMED', blockNumber: 5000 }),
      ]);
      vi.mocked(gateway.getAssetTotalViews).mockResolvedValue(null); // nessun mismatch

      const summary = await service.reconcileAll();

      expect(assets.incrementMirrorViews).toHaveBeenCalledWith('asset-test-1', 3);
      expect(assets.incrementMirrorViews).toHaveBeenCalledWith('asset-test-2', 2);
      expect(batches.markMirrorApplied).toHaveBeenCalledWith(PERIOD);
      expect(batches.markConfirmed).toHaveBeenCalledWith(PERIOD, 5000, expect.any(Date));
      expect(views.markPeriodAnchored).toHaveBeenCalledWith(PERIOD);
      expect(summary.batches.confirmed).toBe(1);
    });

    it('does not finalize a period with a chunk still pending', async () => {
      vi.mocked(batches.findPendingBatches).mockResolvedValueOnce([fixtures.batch({ periodId: PERIOD })]);
      vi.mocked(batches.findChunks).mockResolvedValueOnce([
        fixtures.batchChunk({ periodId: PERIOD, chunkIndex: 0, status: 'CONFIRMED', blockNumber: 5000 }),
        fixtures.batchChunk({ periodId: PERIOD, chunkIndex: 1, status: 'PENDING', txHash: TX }),
      ]);

      const summary = await service.reconcileAll();
      expect(batches.markConfirmed).not.toHaveBeenCalled();
      expect(assets.incrementMirrorViews).not.toHaveBeenCalled();
      expect(summary.batches.stillPending).toBe(1);
    });

    it('TB-9b: keeps a period PENDING on counter mismatch (mirror applied once, not confirmed)', async () => {
      vi.mocked(batches.findPendingBatches).mockResolvedValueOnce([fixtures.batch({ periodId: PERIOD, mirrorApplied: false })]);
      vi.mocked(batches.findChunks).mockResolvedValueOnce([
        fixtures.batchChunk({ periodId: PERIOD, chunkIndex: 0, status: 'CONFIRMED', blockNumber: 5000 }),
      ]);
      vi.mocked(gateway.getAssetTotalViews).mockResolvedValueOnce(99n); // asset-test-1 on-chain
      vi.mocked(assets.findById).mockResolvedValueOnce(fixtures.asset({ assetId: 'asset-test-1', totalViewsMirror: 10 }));

      const summary = await service.reconcileAll();

      expect(batches.markMirrorApplied).toHaveBeenCalledWith(PERIOD);
      expect(batches.markConfirmed).not.toHaveBeenCalled();
      expect(summary.batches.stillPending).toBe(1);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('mismatch'),
        undefined,
        expect.objectContaining({ assetId: 'asset-test-1' }),
      );
    });

    it('does not re-apply the mirror when already applied (exactly-once)', async () => {
      vi.mocked(batches.findPendingBatches).mockResolvedValueOnce([fixtures.batch({ periodId: PERIOD, mirrorApplied: true })]);
      vi.mocked(batches.findChunks).mockResolvedValueOnce([
        fixtures.batchChunk({ periodId: PERIOD, chunkIndex: 0, status: 'CONFIRMED', blockNumber: 5000 }),
      ]);
      vi.mocked(gateway.getAssetTotalViews).mockResolvedValue(null);

      const summary = await service.reconcileAll();
      expect(assets.incrementMirrorViews).not.toHaveBeenCalled();
      expect(batches.markMirrorApplied).not.toHaveBeenCalled();
      expect(batches.markConfirmed).toHaveBeenCalledWith(PERIOD, 5000, expect.any(Date));
      expect(summary.batches.confirmed).toBe(1);
    });
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
