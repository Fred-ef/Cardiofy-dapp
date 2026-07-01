import { inject, injectable } from 'tsyringe';
import { and, eq, isNotNull } from 'drizzle-orm';
import { DatabaseConnection } from '#infrastructure/database/database.connection.js';
import { batches, batchChunks, type BatchRow, type BatchChunkRow } from '#models/schema.js';
import { Batch, BatchChunk, type BatchUpdate } from './batch.domain.js';
import type { IBatchRepository, CreatePendingBatchInput } from './interfaces/i-batch.repository.js';

@injectable()
export class DrizzleBatchRepository implements IBatchRepository {
  constructor(@inject(DatabaseConnection) private readonly dbConn: DatabaseConnection) {}

  private get db() { return this.dbConn.getDb(); }

  private rowToDomain(row: BatchRow): Batch {
    return Batch.reconstitute({
      periodId:    row.periodId,
      assetCount:  row.assetCount,
      viewsTotal:  row.viewsTotal,
      status:      row.status,
      txHash:      row.txHash ?? null,
      blockNumber: row.blockNumber ?? null,
      createdAt:     row.createdAt,
      confirmedAt:   row.confirmedAt ?? null,
      payload:       (row.payload as BatchUpdate[] | null) ?? [],
      mirrorApplied: row.mirrorApplied,
    });
  }

  private chunkRowToDomain(row: BatchChunkRow): BatchChunk {
    return BatchChunk.reconstitute({
      periodId:    row.periodId,
      chunkIndex:  row.chunkIndex,
      payload:     row.payload as BatchUpdate[],
      status:      row.status,
      txHash:      row.txHash ?? null,
      blockNumber: row.blockNumber ?? null,
      createdAt:   row.createdAt,
      confirmedAt: row.confirmedAt ?? null,
    });
  }

  async findByPeriodId(periodId: number): Promise<Batch | null> {
    const rows = await this.db.select().from(batches).where(eq(batches.periodId, periodId)).limit(1);
    const row = rows[0];
    return row ? this.rowToDomain(row) : null;
  }

  async createPending(input: CreatePendingBatchInput): Promise<Batch> {
    const [row] = await this.db
      .insert(batches)
      .values({
        periodId:   input.periodId,
        assetCount: input.assetCount,
        viewsTotal: input.viewsTotal,
        payload:    input.payload,
        status:     'PENDING',
      })
      .returning();
    if (!row) throw new Error('[BatchRepo] insert returned no rows');
    return this.rowToDomain(row);
  }

  async markSubmitted(periodId: number, txHash: string): Promise<void> {
    await this.db.update(batches).set({ txHash }).where(eq(batches.periodId, periodId));
  }

  async markConfirmed(periodId: number, blockNumber: number, confirmedAt: Date): Promise<void> {
    await this.db
      .update(batches)
      .set({ status: 'CONFIRMED', blockNumber, confirmedAt })
      .where(eq(batches.periodId, periodId));
  }

  async markFailed(periodId: number): Promise<void> {
    await this.db.update(batches).set({ status: 'FAILED' }).where(eq(batches.periodId, periodId));
  }

  async markMirrorApplied(periodId: number): Promise<void> {
    await this.db.update(batches).set({ mirrorApplied: true }).where(eq(batches.periodId, periodId));
  }

  async findPendingBatches(): Promise<Batch[]> {
    const rows = await this.db.select().from(batches).where(eq(batches.status, 'PENDING'));
    return rows.map((row) => this.rowToDomain(row));
  }

  // ─── Chunk ──────────────────────────────────────────────────────────────────

  async ensureChunks(periodId: number, slices: BatchUpdate[][]): Promise<void> {
    if (slices.length === 0) return;
    await this.db
      .insert(batchChunks)
      .values(slices.map((payload, chunkIndex) => ({ periodId, chunkIndex, payload })))
      .onConflictDoNothing();
  }

  async findChunks(periodId: number): Promise<BatchChunk[]> {
    const rows = await this.db
      .select()
      .from(batchChunks)
      .where(eq(batchChunks.periodId, periodId))
      .orderBy(batchChunks.chunkIndex);
    return rows.map((row) => this.chunkRowToDomain(row));
  }

  async findPendingChunksWithTx(): Promise<BatchChunk[]> {
    const rows = await this.db
      .select()
      .from(batchChunks)
      .where(and(eq(batchChunks.status, 'PENDING'), isNotNull(batchChunks.txHash)));
    return rows.map((row) => this.chunkRowToDomain(row));
  }

  async markChunkSubmitted(periodId: number, chunkIndex: number, txHash: string): Promise<void> {
    await this.db
      .update(batchChunks)
      .set({ txHash, status: 'PENDING' })
      .where(and(eq(batchChunks.periodId, periodId), eq(batchChunks.chunkIndex, chunkIndex)));
  }

  async markChunkFailed(periodId: number, chunkIndex: number): Promise<void> {
    await this.db
      .update(batchChunks)
      .set({ status: 'FAILED' })
      .where(and(eq(batchChunks.periodId, periodId), eq(batchChunks.chunkIndex, chunkIndex)));
  }

  async markChunkConfirmed(periodId: number, chunkIndex: number, blockNumber: number, confirmedAt: Date): Promise<void> {
    await this.db
      .update(batchChunks)
      .set({ status: 'CONFIRMED', blockNumber, confirmedAt })
      .where(and(eq(batchChunks.periodId, periodId), eq(batchChunks.chunkIndex, chunkIndex)));
  }
}
