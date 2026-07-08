import { inject, injectable } from 'tsyringe';
import { DI_TOKENS } from '#infrastructure/di/tokens.js';
import { NotFoundError } from '#errors/not-found.error.js';
import type { AppConfig } from '#infrastructure/config/index.js';
import type { ILoggerService } from '#infrastructure/logger/interfaces/i-logger.service.js';
import type { INotaryGateway } from '#modules/notary/interfaces/i-notary.gateway.js';
import { periodIdOf } from '#modules/views/view.domain.js';
import type { IViewRepository } from '#modules/views/interfaces/i-view.repository.js';
import type { Batch, BatchUpdate } from './batch.domain.js';
import type { IBatchRepository } from './interfaces/i-batch.repository.js';
import type { IBatchService } from './interfaces/i-batch.service.js';

/** Taglia un array in slice di al più `size` elementi. */
function chunkBy<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

@injectable()
export class BatchService implements IBatchService {
  constructor(
    @inject(DI_TOKENS.IBatchRepository) private readonly repo: IBatchRepository,
    @inject(DI_TOKENS.IViewRepository) private readonly views: IViewRepository,
    @inject(DI_TOKENS.INotaryGateway) private readonly gateway: INotaryGateway,
    @inject(DI_TOKENS.AppConfig) private readonly config: AppConfig,
    @inject(DI_TOKENS.ILoggerService) private readonly logger: ILoggerService,
  ) { }

  /** Periodo corrente meno un  */
  previousPeriodId(): number {
    const periodSeconds = this.config.env.SCHEDULE.BATCH_PERIOD_SECONDS;
    return periodIdOf(new Date(), periodSeconds) - periodSeconds;
  }

  /**
   * Pubblica il batch di un periodo in uno o più chunk (sotto al gas-limit di blocco)
   * (inviando solo i chunk mai sottomessi)
   */
  async publishBatchFor(periodId: number): Promise<Batch | null> {
    const existing = await this.repo.findByPeriodId(periodId);
    if (existing && existing.status === 'CONFIRMED') {
      this.logger.info(`[BatchService] periodo ${periodId} già confermato`);
      return existing;
    }

    const aggregates = await this.views.aggregatesForPeriod(periodId);
    if (aggregates.length === 0) {
      this.logger.info(`[BatchService] periodo ${periodId}: nessuna view da pubblicare`);
      return null;
    }

    // Chunk deterministici: ordina per assetId e taglia a `BATCH_MAX_CHUNK`. Lo stesso periodo
    // produce sempre gli stessi slice → un retry rimanda esattamente lo stesso chunk.
    const maxChunk = this.config.env.SCHEDULE.BATCH_MAX_CHUNK;
    const sorted = [...aggregates].sort((a, b) => a.assetId.localeCompare(b.assetId));
    const slices: BatchUpdate[][] = chunkBy(sorted, maxChunk);

    const viewsTotal = sorted.reduce((acc, a) => acc + a.viewsInPeriod, 0);
    const batch =
      existing ??
      (await this.repo.createPending({ periodId, assetCount: sorted.length, viewsTotal, payload: sorted }));
    await this.repo.ensureChunks(periodId, slices); // idempotente su (periodId, chunkIndex)

    // Invia SOLO i chunk mai sottomessi (txHash null). Un chunk PENDING-con-txHash NON si re-invia:
    // potrebbe essere in mempool o già applicato → lo risolve la riconciliazione
    const chunks = await this.repo.findChunks(periodId);
    let periodTxSet = Boolean(existing?.txHash);
    let sent = 0;
    for (const c of chunks) {
      if (c.txHash !== null) continue;
      try {
        const { txHash } = await this.gateway.publishBatch(periodId, c.payload);
        await this.repo.markChunkSubmitted(periodId, c.chunkIndex, txHash);
        sent++;
        if (!periodTxSet) {
          await this.repo.markSubmitted(periodId, txHash); // txHash rappresentativo del periodo (primo chunk)
          periodTxSet = true;
        }
      } catch (err) {
        await this.repo.markChunkFailed(periodId, c.chunkIndex);
        this.logger.error('[BatchService] invio chunk fallito', err, { periodId, chunkIndex: c.chunkIndex });
        // non rilancio: gli altri chunk proseguono; il periodo resta PENDING e verrà ritentato
      }
    }
    this.logger.info(`[BatchService] periodo ${periodId}: ${slices.length} chunk, ${sent} inviati in questo tick`);
    return batch;
  }

  async get(periodId: number): Promise<Batch> {
    const b = await this.repo.findByPeriodId(periodId);
    if (!b) throw new NotFoundError(`Batch periodId=${periodId} not found`);
    return b;
  }
}
