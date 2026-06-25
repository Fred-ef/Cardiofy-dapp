import { inject, injectable } from 'tsyringe';
import { DI_TOKENS } from '#infrastructure/di/tokens.js';
import type { AppConfig } from '#infrastructure/config/index.js';
import type { ILoggerService } from '#infrastructure/logger/interfaces/i-logger.service.js';
import type { INotaryGateway } from '#modules/notary/interfaces/i-notary.gateway.js';
import type { IAssetRepository } from '#modules/assets/interfaces/i-asset.repository.js';
import type { IContractRepository } from '#modules/contracts/interfaces/i-contract.repository.js';
import type { IBatchRepository } from '#modules/batches/interfaces/i-batch.repository.js';
import type {
  IReconciliationService,
  ReconciliationRunSummary,
  ReconciliationCounters,
} from './interfaces/i-reconciliation.service.js';

/** Primo mismatch contatore-viste rilevato fra valore on-chain e mirror locale. */
interface AssetCounterMismatch {
  assetId:  string;
  onchain:  bigint;
  dbMirror: bigint;
}

@injectable()
export class ReconciliationService implements IReconciliationService {
  private readonly confirmationDepth: number;

  constructor(
    @inject(DI_TOKENS.IContractRepository) private readonly contracts: IContractRepository,
    @inject(DI_TOKENS.IAssetRepository)    private readonly assets: IAssetRepository,
    @inject(DI_TOKENS.IBatchRepository)    private readonly batches: IBatchRepository,
    @inject(DI_TOKENS.INotaryGateway)      private readonly gateway: INotaryGateway,
    @inject(DI_TOKENS.AppConfig)           config: AppConfig,
    @inject(DI_TOKENS.ILoggerService)      private readonly logger: ILoggerService,
  ) {
    this.confirmationDepth = config.env.NOTARY.CONFIRMATIONS;
  }

  async reconcileAll(): Promise<ReconciliationRunSummary> {
    const [contractsSummary, assetsSummary, batchesSummary] = await Promise.all([
      this.reconcileContracts(),
      this.reconcileAssets(),
      this.reconcileBatches(),
    ]);
    const summary: ReconciliationRunSummary = {
      contracts: contractsSummary,
      assets:    assetsSummary,
      batches:   batchesSummary,
    };
    this.logger.info('[Reconciliation] tick completato', { summary });
    return summary;
  }

  private async reconcileContracts(): Promise<ReconciliationCounters> {
    const pending = await this.contracts.findPendingWithTx();
    const counter: ReconciliationCounters = { scanned: pending.length, confirmed: 0, stillPending: 0, failed: 0 };
    await Promise.allSettled(pending.map(async (c) => {
      if (c.txHash === null) { counter.stillPending++; return; }
      try {
        const { confirmations, blockNumber } = await this.gateway.confirmations(c.txHash);
        if (confirmations >= this.confirmationDepth && blockNumber !== null) {
          await this.contracts.markConfirmed(c.contractId, blockNumber, new Date());
          counter.confirmed++;
        } else {
          counter.stillPending++;
        }
      } catch (err) {
        counter.failed++;
        this.logger.error('[Reconciliation] contract failed', err, { contractId: c.contractId });
      }
    }));
    return counter;
  }

  private async reconcileAssets(): Promise<ReconciliationCounters> {
    const pending = await this.assets.findPendingWithTx();
    const counter: ReconciliationCounters = { scanned: pending.length, confirmed: 0, stillPending: 0, failed: 0 };
    await Promise.allSettled(pending.map(async (a) => {
      if (a.txHash === null) { counter.stillPending++; return; }
      try {
        const { confirmations, blockNumber } = await this.gateway.confirmations(a.txHash);
        if (confirmations >= this.confirmationDepth && blockNumber !== null) {
          await this.assets.markConfirmed(a.assetId, blockNumber, new Date());
          counter.confirmed++;
        } else {
          counter.stillPending++;
        }
      } catch (err) {
        counter.failed++;
        this.logger.error('[Reconciliation] asset failed', err, { assetId: a.assetId });
      }
    }));
    return counter;
  }

  private async reconcileBatches(): Promise<ReconciliationCounters> {
    const pending = await this.batches.findPendingWithTx();
    const counter: ReconciliationCounters = { scanned: pending.length, confirmed: 0, stillPending: 0, failed: 0 };
    await Promise.allSettled(pending.map(async (b) => {
      if (b.txHash === null) { counter.stillPending++; return; }
      try {
        const { confirmations, blockNumber } = await this.gateway.confirmations(b.txHash);
        if (confirmations < this.confirmationDepth || blockNumber === null) {
          counter.stillPending++;
          return;
        }

        // Verifica difensiva (TB-9b): per ciascun asset toccato dal batch,
        // confrontiamo il contatore on-chain col mirror locale. Mismatch ⇒
        // alert + non marcare CONFIRMED (resta PENDING, sarà ritentato).
        const mismatch = await this.detectAssetCounterMismatch(b.payload);
        if (mismatch) {
          counter.stillPending++;
          this.logger.error(
            '[Reconciliation] batch counter mismatch on-chain vs DB — non confermato',
            undefined,
            {
              periodId: b.periodId,
              assetId:  mismatch.assetId,
              onchain:  mismatch.onchain.toString(),
              dbMirror: mismatch.dbMirror.toString(),
            },
          );
          return;
        }

        await this.batches.markConfirmed(b.periodId, blockNumber, new Date());
        counter.confirmed++;
      } catch (err) {
        counter.failed++;
        this.logger.error('[Reconciliation] batch failed', err, { periodId: b.periodId });
      }
    }));
    return counter;
  }

  /**
   * Confronta `Notary.assets(id).totalViews` (chain) col mirror locale
   * `asset.totalViewsMirror` per ogni asset del payload del batch. Ritorna
   * il primo mismatch trovato, oppure null se tutto combacia.
   *
   * Asset che non sono ancora visibili on-chain (`getAssetTotalViews → null`) sono
   * trattati come "skip" (es. NullNotaryGateway in dev locale).
   */
  private async detectAssetCounterMismatch(
    payload: Array<{ assetId: string; viewsInPeriod: number }>,
  ): Promise<AssetCounterMismatch | null> {
    for (const update of payload) {
      const onchain = await this.gateway.getAssetTotalViews(update.assetId);
      if (onchain === null) continue;
      const local = await this.assets.findById(update.assetId);
      if (local === null) continue;
      const dbMirror = BigInt(local.totalViewsMirror);
      if (onchain !== dbMirror) {
        return { assetId: update.assetId, onchain, dbMirror };
      }
    }
    return null;
  }
}
