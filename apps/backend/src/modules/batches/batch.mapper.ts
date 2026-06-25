import type { BatchDto } from '@cardiofy/shared';
import type { Batch } from './batch.domain.js';

export function toBatchDto(batch: Batch, chainId: number): BatchDto {
  return {
    periodId:    batch.periodId,
    assetCount:  batch.assetCount,
    viewsTotal:  batch.viewsTotal,
    status:      batch.status,
    createdAt:   batch.createdAt.toISOString(),
    confirmedAt: batch.confirmedAt?.toISOString() ?? null,
    txHash:      batch.txHash,
    anchoring: {
      txHash:      batch.txHash,
      blockNumber: batch.blockNumber,
      chainId,
    },
    payload: batch.payload.map((u) => ({
      assetId:       u.assetId,
      viewsInPeriod: u.viewsInPeriod,
    })),
  };
}
