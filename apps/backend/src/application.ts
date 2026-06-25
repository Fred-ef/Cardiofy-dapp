import { inject, injectable } from 'tsyringe';
import type { Server } from 'node:http';
import { DI_TOKENS } from '#infrastructure/di/tokens.js';
import { DatabaseConnection } from '#infrastructure/database/database.connection.js';
import { ExpressApi } from '#src/express.api.js';
import { BatchJob } from '#modules/batches/batch.job.js';
import { ReconcileJob } from '#modules/reconciliation/reconciliation.job.js';
import type { AppConfig } from '#infrastructure/config/index.js';
import type { ILoggerService } from '#infrastructure/logger/interfaces/i-logger.service.js';

@injectable()
export class Application {
  private httpServer: Server | null = null;

  constructor(
    @inject(DatabaseConnection)         private readonly db: DatabaseConnection,
    @inject(ExpressApi)                 private readonly server: ExpressApi,
    @inject(DI_TOKENS.AppConfig)        private readonly config: AppConfig,
    @inject(DI_TOKENS.ILoggerService)   private readonly logger: ILoggerService,
    @inject(BatchJob)                   private readonly batchJob: BatchJob,
    @inject(ReconcileJob)               private readonly reconcileJob: ReconcileJob,
  ) {}

  public async run(): Promise<void> {
    try {
      this.setupProcessHandlers();
      await this.db.testConnection();

      this.batchJob.start();
      this.reconcileJob.start();

      this.httpServer = this.server.app.listen(this.config.env.SERVER.PORT, () => {
        this.logger.info(`Server in ascolto su porta ${this.config.env.SERVER.PORT}`);
      });
    } catch (error) {
      this.logger.error('Impossibile avviare il server', error);
      process.exit(1);
    }
  }

  private setupProcessHandlers(): void {
    process.on('uncaughtException',  (e) => void this.fatalShutdown('uncaughtException', e));
    process.on('unhandledRejection', (r) => void this.fatalShutdown('unhandledRejection', r));
    process.on('SIGTERM', () => this.gracefulExit('SIGTERM'));
    process.on('SIGINT',  () => this.gracefulExit('SIGINT'));
  }

  private async fatalShutdown(signal: string, err: unknown): Promise<void> {
    const error = err instanceof Error ? err : new Error(String(err));
    this.logger.error(`[${signal}] errore non gestito — arresto fatale`, error);
    const force = setTimeout(() => process.exit(1), this.config.env.SERVER.SHUTDOWN_TIMEOUT_MS);
    force.unref();
    await this.gracefulShutdown().catch(() => {});
    clearTimeout(force);
    process.exit(1);
  }

  private gracefulExit(signal: string): void {
    this.logger.info(`[shutdown] ricevuto ${signal}, arresto graceful...`);
    const force = setTimeout(() => {
      this.logger.error('[shutdown] timeout superato, arresto forzato');
      process.exit(1);
    }, this.config.env.SERVER.SHUTDOWN_TIMEOUT_MS);
    force.unref();

    void this.gracefulShutdown()
      .then(() => { clearTimeout(force); process.exit(0); })
      .catch((e: unknown) => {
        this.logger.error("[shutdown] errore durante l'arresto", e);
        process.exit(1);
      });
  }

  private async gracefulShutdown(): Promise<void> {
    if (this.httpServer) {
      await new Promise<void>((resolve, reject) => {
        this.httpServer!.close((err) => {
          if (err && (err as NodeJS.ErrnoException).code !== 'ERR_SERVER_NOT_RUNNING') {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    }
    this.batchJob.stop();
    this.reconcileJob.stop();
    await this.db.close();
  }
}
