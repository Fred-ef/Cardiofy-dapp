import type { Asset } from '../asset.domain.js';

export interface NotarizeAssetInput {
  assetId: string;
  contentHash: string;
}

export interface IAssetRepository {
  findById(assetId: string): Promise<Asset | null>;
  create(input: NotarizeAssetInput): Promise<Asset>;
  markSubmitted(assetId: string, txHash: string): Promise<void>;
  markConfirmed(assetId: string, blockNumber: number, confirmedAt: Date): Promise<void>;
  markFailed(assetId: string): Promise<void>;
  incrementMirrorViews(assetId: string, delta: number): Promise<void>;
  /** Notarizzazioni in attesa di conferma on-chain (PENDING con txHash valorizzato). */
  findPendingWithTx(): Promise<Asset[]>;
}
