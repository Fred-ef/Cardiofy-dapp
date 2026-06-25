import { inject, injectable } from 'tsyringe';
import { DI_TOKENS } from '#infrastructure/di/tokens.js';
import { NotFoundError } from '#errors/not-found.error.js';
import { ConflictError } from '#errors/conflict.error.js';
import type { ILoggerService } from '#infrastructure/logger/interfaces/i-logger.service.js';
import type { AppConfig } from '#infrastructure/config/index.js';
import type { INotaryGateway } from '#modules/notary/interfaces/i-notary.gateway.js';
import type { Asset } from './asset.domain.js';
import type { IAssetRepository } from './interfaces/i-asset.repository.js';
import type { IAssetService, NotarizeAssetResult } from './interfaces/i-asset.service.js';

@injectable()
export class AssetService implements IAssetService {
  constructor(
    @inject(DI_TOKENS.IAssetRepository) private readonly repo: IAssetRepository,
    @inject(DI_TOKENS.INotaryGateway)   private readonly gateway: INotaryGateway,
    @inject(DI_TOKENS.AppConfig)        private readonly config: AppConfig,
    @inject(DI_TOKENS.ILoggerService)   private readonly logger: ILoggerService,
  ) {}

  async notarize(assetId: string, contentHash: string): Promise<NotarizeAssetResult> {
    const existing = await this.repo.findById(assetId);
    if (existing) throw new ConflictError(`Asset ${assetId} already notarized`);

    const created = await this.repo.create({ assetId, contentHash });
    try {
      const { txHash } = await this.gateway.notarizeAsset(assetId, contentHash);
      await this.repo.markSubmitted(assetId, txHash);
      return {
        asset:   created,
        txHash,
        chainId: this.config.env.NOTARY.CHAIN_ID,
      };
    } catch (err) {
      await this.repo.markFailed(assetId);
      this.logger.error('[AssetService] notarize on-chain failed', err, { assetId });
      throw err;
    }
  }

  async get(assetId: string): Promise<Asset> {
    return this.requireExists(assetId);
  }

  async requireExists(assetId: string): Promise<Asset> {
    const a = await this.repo.findById(assetId);
    if (!a) throw new NotFoundError(`Asset ${assetId} not notarized`);
    return a;
  }
}
