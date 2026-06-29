import { inject, injectable } from 'tsyringe';
import { DI_TOKENS } from '#infrastructure/di/tokens.js';
import { NotFoundError } from '#errors/not-found.error.js';
import type { AppConfig } from '#infrastructure/config/index.js';
import type { ILoggerService } from '#infrastructure/logger/interfaces/i-logger.service.js';
import type { INotaryGateway } from '#modules/notary/interfaces/i-notary.gateway.js';
import type { IViewRepository } from '#modules/views/interfaces/i-view.repository.js';
import type { IAssetRepository } from '#modules/assets/interfaces/i-asset.repository.js';
import type { Batch } from './batch.domain.js';
import type { IBatchRepository } from './interfaces/i-batch.repository.js';
import type { IBatchService } from './interfaces/i-batch.service.js';

@injectable()
export class BatchService implements IBatchService {
  constructor(
    @inject(DI_TOKENS.IBatchRepository) private readonly repo: IBatchRepository,
    @inject(DI_TOKENS.IViewRepository)  private readonly views: IViewRepository,
    @inject(DI_TOKENS.IAssetRepository) private readonly assets: IAssetRepository,
    @inject(DI_TOKENS.INotaryGateway)   private readonly gateway: INotaryGateway,
    @inject(DI_TOKENS.AppConfig)        private readonly config: AppConfig,
    @inject(DI_TOKENS.ILoggerService)   private readonly logger: ILoggerService,
  ) {}

  yesterdayPeriodId(): number {
    const now = new Date();
    const ms = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0);
    return Math.floor(ms / 1000) - 86_400;
  }

  async publishBatchFor(periodId: number): Promise<Batch | null> {
    const existing = await this.repo.findByPeriodId(periodId);
    if (existing && existing.status !== 'FAILED') {
      this.logger.info(`[BatchService] periodo ${periodId} già pubblicato (status=${existing.status})`);
      return existing;
    }

    const aggregates = await this.views.aggregatesForPeriod(periodId);
    if (aggregates.length === 0) {
      this.logger.info(`[BatchService] periodo ${periodId}: nessuna view da pubblicare`);
      return null;
    }

    // Guard anti-oversize: una singola `publishBatch` con troppi asset esaurirebbe il gas-limit
    // di blocco (~500 asset su Gnosis). Finché il chunking checkpointed non è implementato,
    // falliamo in modo esplicito e azionabile invece di inviare una tx destinata a fallire on-chain.
    // Vedi ai-context/future-tasks/batch-chunking-plan.md.
    const maxChunk = this.config.env.SCHEDULE.BATCH_MAX_CHUNK;
    if (aggregates.length > maxChunk) {
      this.logger.error(
        '[BatchService] batch oltre la soglia sicura per singola transazione — richiesto chunking',
        undefined,
        { periodId, assetCount: aggregates.length, max: maxChunk },
      );
      throw new Error(
        `Batch ${periodId}: ${aggregates.length} asset > soglia ${maxChunk}; chunking non ancora attivo`,
      );
    }

    const viewsTotal = aggregates.reduce((acc, a) => acc + a.viewsInPeriod, 0);
    const batch = await this.repo.createPending({
      periodId,
      assetCount: aggregates.length,
      viewsTotal,
      payload: aggregates,
    });

    try {
      const { txHash } = await this.gateway.publishBatch(periodId, aggregates);
      await this.repo.markSubmitted(periodId, txHash);
      // Mirror locale: aggiorna il contatore di ogni asset attivo nel periodo.
      // (in produzione, da affiancare a riconciliazione via eventi on-chain).
      for (const agg of aggregates) {
        await this.assets.incrementMirrorViews(agg.assetId, agg.viewsInPeriod);
      }
      await this.views.markPeriodAnchored(periodId);
      this.logger.info(`[BatchService] batch periodo ${periodId} pubblicato tx=${txHash}`);
      return batch;
    } catch (err) {
      await this.repo.markFailed(periodId);
      this.logger.error('[BatchService] publishBatch on-chain failed', err, { periodId });
      throw err;
    }
  }

  async get(periodId: number): Promise<Batch> {
    const b = await this.repo.findByPeriodId(periodId);
    if (!b) throw new NotFoundError(`Batch periodId=${periodId} not found`);
    return b;
  }
}
