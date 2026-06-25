import type { AssetDto, NotarizeAssetResponse } from '@cardiofy/shared';
import type { Asset } from './asset.domain.js';
import type { NotarizeAssetResult } from './interfaces/i-asset.service.js';

export function toNotarizeAssetResponse(result: NotarizeAssetResult): NotarizeAssetResponse {
  return {
    assetId:     result.asset.assetId,
    contentHash: result.asset.contentHash,
    txHash:      result.txHash,
    chainId:     result.chainId,
  };
}

export function toAssetDto(asset: Asset, chainId: number): AssetDto {
  return {
    assetId:     asset.assetId,
    contentHash: asset.contentHash,
    notarizedAt: asset.notarizedAt.toISOString(),
    confirmedAt: asset.confirmedAt?.toISOString() ?? null,
    status:      asset.status,
    totalViews:  asset.totalViewsMirror,
    anchoring: {
      txHash:      asset.txHash,
      blockNumber: asset.blockNumber,
      chainId,
    },
  };
}
