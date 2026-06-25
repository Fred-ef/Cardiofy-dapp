import { inject, injectable } from 'tsyringe';
import { Cron } from 'croner';
import { DI_TOKENS } from '#infrastructure/di/tokens.js';
import type { AppConfig } from '#infrastructure/config/index.js';
import type { ILoggerService } from '#infrastructure/logger/interfaces/i-logger.service.js';
import type { IReconciliationService } from './interfaces/i-reconciliation.service.js';

/**
 * Cron periodico (default `*\/5 * * * *`) che riconcilia le entità in stato PENDING
 * con la blockchain. Si avvia solo se la configurazione on-chain è presente;
 * `{ protect: true }` impedisce sovrapposizioni di tick.
 */
@injectable()
export class ReconcileJob {
  private cron: Cron | null = null;

  constructor(
    @inject(DI_TOKENS.IReconciliationService) private readonly service: IReconciliationService,
    @inject(DI_TOKENS.AppConfig)              private readonly config: AppConfig,
    @inject(DI_TOKENS.ILoggerService)         private readonly logger: ILoggerService,
  ) {}

  start(): void {
    const { RPC_URL, PRIVATE_KEY, CONTRACT_ADDRESS } = this.config.env.NOTARY;
    if (!RPC_URL || !PRIVATE_KEY || !CONTRACT_ADDRESS) {
      this.logger.info('[ReconcileJob] configurazione on-chain assente — job disabilitato');
      return;
    }
    const expression = this.config.env.SCHEDULE.RECONCILE_CRON;
    this.logger.info(`[ReconcileJob] avvio: cron '${expression}'`);
    this.cron = new Cron(expression, { protect: true }, () => this.runOnce());
  }

  stop(): void {
    if (this.cron) this.cron.stop();
  }

  private runOnce(): void {
    this.service.reconcileAll().catch((err: unknown) => {
      this.logger.error('[ReconcileJob] tick fallito', err);
    });
  }
}
