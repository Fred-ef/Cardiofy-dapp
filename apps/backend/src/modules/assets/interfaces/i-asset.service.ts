import type { Asset } from '../asset.domain.js';

export interface NotarizeAssetResult {
  asset:   Asset;
  txHash:  string;
  chainId: number;
}

export interface IAssetService {
  notarize(assetId: string, contentHash: string): Promise<NotarizeAssetResult>;
  get(assetId: string): Promise<Asset>;
  requireExists(assetId: string): Promise<Asset>;
}
