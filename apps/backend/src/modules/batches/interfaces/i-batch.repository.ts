import type { Batch, BatchChunk, BatchUpdate } from '../batch.domain.js';

export interface CreatePendingBatchInput {
  periodId:   number;
  assetCount: number;
  viewsTotal: number;
  payload:    BatchUpdate[];
}

export interface IBatchRepository {
  // ─── Record di periodo (riepilogo) ────────────────────────────────────────
  findByPeriodId(periodId: number): Promise<Batch | null>;
  createPending(input: CreatePendingBatchInput): Promise<Batch>;
  /** Imposta il txHash rappresentativo del periodo (quello del primo chunk inviato). */
  markSubmitted(periodId: number, txHash: string): Promise<void>;
  markConfirmed(periodId: number, blockNumber: number, confirmedAt: Date): Promise<void>;
  markFailed(periodId: number): Promise<void>;
  /** Marca il mirror locale come applicato per il periodo (idempotenza: esattamente una volta). */
  markMirrorApplied(periodId: number): Promise<void>;
  /** Tutti i batch ancora PENDING (per la finalizzazione a periodo completo). */
  findPendingBatches(): Promise<Batch[]>;

  // ─── Chunk (unità transazionali) ──────────────────────────────────────────
  /** Crea i chunk mancanti (idempotente su (periodId, chunkIndex)). */
  ensureChunks(periodId: number, slices: BatchUpdate[][]): Promise<void>;
  findChunks(periodId: number): Promise<BatchChunk[]>;
  /** Chunk PENDING con txHash valorizzato (per la conferma in riconciliazione). */
  findPendingChunksWithTx(): Promise<BatchChunk[]>;
  markChunkSubmitted(periodId: number, chunkIndex: number, txHash: string): Promise<void>;
  markChunkFailed(periodId: number, chunkIndex: number): Promise<void>;
  markChunkConfirmed(periodId: number, chunkIndex: number, blockNumber: number, confirmedAt: Date): Promise<void>;
}
