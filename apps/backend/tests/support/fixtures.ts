/**
 * Fixture deterministiche per gli unit test.
 */
import { Asset } from '#modules/assets/asset.domain.js';
import { Contract } from '#modules/contracts/contract.domain.js';
import { View } from '#modules/views/view.domain.js';
import { Batch, BatchChunk } from '#modules/batches/batch.domain.js';

const HASH_A   = '0x' + 'aa'.repeat(32);
const HASH_B   = '0x' + 'bb'.repeat(32);
const TX_HASH  = '0x' + 'cc'.repeat(32);

export const fixtures = {
  hashA: HASH_A,
  hashB: HASH_B,
  txHash: TX_HASH,

  asset(overrides?: Partial<{
    assetId: string;
    contentHash: string;
    totalViewsMirror: number;
    status: 'PENDING' | 'CONFIRMED' | 'FAILED';
    txHash: string | null;
    blockNumber: number | null;
  }>): Asset {
    return Asset.reconstitute({
      assetId:          overrides?.assetId          ?? 'asset-test-1',
      contentHash:      overrides?.contentHash      ?? HASH_A,
      status:           overrides?.status           ?? 'PENDING',
      txHash:           overrides?.txHash           ?? null,
      blockNumber:      overrides?.blockNumber      ?? null,
      notarizedAt:      new Date('2026-06-22T00:00:00Z'),
      confirmedAt:      null,
      totalViewsMirror: overrides?.totalViewsMirror ?? 0,
    });
  },

  contract(overrides?: Partial<{
    contractId: string;
    contentHash: string;
    txHash: string | null;
    status: 'PENDING' | 'CONFIRMED' | 'FAILED';
  }>): Contract {
    return Contract.reconstitute({
      contractId:  overrides?.contractId  ?? 'contract-test-1',
      contentHash: overrides?.contentHash ?? HASH_A,
      status:      overrides?.status      ?? 'PENDING',
      txHash:      overrides?.txHash      ?? null,
      blockNumber: null,
      notarizedAt: new Date('2026-06-22T00:00:00Z'),
      confirmedAt: null,
    });
  },

  view(overrides?: Partial<{
    id: string;
    assetId: string;
    idempotencyKey: string;
    periodId: number;
    occurredAt: Date;
  }>): View {
    const occurredAt = overrides?.occurredAt ?? new Date('2026-06-22T14:00:00Z');
    return View.reconstitute({
      id:             overrides?.id             ?? 'view-1',
      idempotencyKey: overrides?.idempotencyKey ?? 'idem-1',
      assetId:        overrides?.assetId        ?? 'asset-test-1',
      occurredAt,
      receivedAt:     occurredAt,
      periodId:       overrides?.periodId       ?? 1750636800,
      anchored:       false,
      batchPeriodId:  null,
    });
  },

  batch(overrides?: Partial<{
    periodId: number;
    assetCount: number;
    viewsTotal: number;
    status: 'PENDING' | 'CONFIRMED' | 'FAILED';
    txHash: string | null;
    mirrorApplied: boolean;
  }>): Batch {
    return Batch.reconstitute({
      periodId:      overrides?.periodId   ?? 1750636800,
      assetCount:    overrides?.assetCount ?? 2,
      viewsTotal:    overrides?.viewsTotal ?? 5,
      status:        overrides?.status     ?? 'PENDING',
      txHash:        overrides?.txHash     ?? null,
      blockNumber:   null,
      createdAt:     new Date('2026-06-22T00:05:00Z'),
      confirmedAt:   null,
      payload:       [
        { assetId: 'asset-test-1', viewsInPeriod: 3 },
        { assetId: 'asset-test-2', viewsInPeriod: 2 },
      ],
      mirrorApplied: overrides?.mirrorApplied ?? false,
    });
  },

  batchChunk(overrides?: Partial<{
    periodId: number;
    chunkIndex: number;
    payload: { assetId: string; viewsInPeriod: number }[];
    status: 'PENDING' | 'CONFIRMED' | 'FAILED';
    txHash: string | null;
    blockNumber: number | null;
  }>): BatchChunk {
    return BatchChunk.reconstitute({
      periodId:    overrides?.periodId    ?? 1750636800,
      chunkIndex:  overrides?.chunkIndex  ?? 0,
      payload:     overrides?.payload     ?? [{ assetId: 'asset-test-1', viewsInPeriod: 3 }],
      status:      overrides?.status      ?? 'PENDING',
      txHash:      overrides?.txHash      ?? null,
      blockNumber: overrides?.blockNumber ?? null,
      createdAt:   new Date('2026-06-22T00:05:00Z'),
      confirmedAt: null,
    });
  },
};
