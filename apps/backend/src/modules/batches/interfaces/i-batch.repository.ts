import type { Batch, BatchUpdate } from '../batch.domain.js';

export interface CreatePendingBatchInput {
  periodId:   number;
  assetCount: number;
  viewsTotal: number;
  payload:    BatchUpdate[];
}

export interface IBatchRepository {
  findByPeriodId(periodId: number): Promise<Batch | null>;
  createPending(input: CreatePendingBatchInput): Promise<Batch>;
  markSubmitted(periodId: number, txHash: string): Promise<void>;
  markConfirmed(periodId: number, blockNumber: number, confirmedAt: Date): Promise<void>;
  markFailed(periodId: number): Promise<void>;
  /** Batch in attesa di conferma on-chain (PENDING con txHash valorizzato). */
  findPendingWithTx(): Promise<Batch[]>;
}
