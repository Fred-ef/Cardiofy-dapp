import { inject, injectable } from 'tsyringe';
import { Cron } from 'croner';
import { DI_TOKENS } from '#infrastructure/di/tokens.js';
import type { AppConfig } from '#infrastructure/config/index.js';
import type { ILoggerService } from '#infrastructure/logger/interfaces/i-logger.service.js';
import type { IBatchService } from './interfaces/i-batch.service.js';

/**
 * Schedula la pubblicazione del batch giornaliero.
 * Default: 00:00 UTC (BATCH_CRON='0 0 * * *'). Pubblica gli aggregati del giorno
 * precedente. Si avvia solo se la configurazione on-chain (RPC/KEY/CONTRACT) è
 * presente; altrimenti rimane disabilitato.
 */
@injectable()
export class BatchJob {
  private cron: Cron | null = null;

  constructor(
    @inject(DI_TOKENS.IBatchService)  private readonly service: IBatchService,
    @inject(DI_TOKENS.AppConfig)      private readonly config: AppConfig,
    @inject(DI_TOKENS.ILoggerService) private readonly logger: ILoggerService,
  ) {}

  start(): void {
    const { RPC_URL, PRIVATE_KEY, CONTRACT_ADDRESS } = this.config.env.NOTARY;
    if (!RPC_URL || !PRIVATE_KEY || !CONTRACT_ADDRESS) {
      this.logger.info('[BatchJob] configurazione on-chain assente — job disabilitato');
      return;
    }
    const expression = this.config.env.SCHEDULE.BATCH_CRON;
    this.logger.info(`[BatchJob] avvio: cron '${expression}'`);
    this.cron = new Cron(expression, { protect: true }, () => this.runOnce());
  }

  stop(): void {
    if (this.cron) this.cron.stop();
  }

  private runOnce(): void {
    const periodId = this.service.yesterdayPeriodId();
    this.service
      .publishBatchFor(periodId)
      .then((batch) => {
        if (batch) this.logger.info(`[BatchJob] tick: pubblicato batch periodId=${batch.periodId}`);
      })
      .catch((err: unknown) => {
        this.logger.error('[BatchJob] tick fallito', err);
      });
  }
}
