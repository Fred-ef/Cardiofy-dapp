import { inject, injectable } from 'tsyringe';
import { and, eq, isNotNull } from 'drizzle-orm';
import { DatabaseConnection } from '#infrastructure/database/database.connection.js';
import { batches, type BatchRow } from '#models/schema.js';
import { Batch, type BatchUpdate } from './batch.domain.js';
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
      createdAt:   row.createdAt,
      confirmedAt: row.confirmedAt ?? null,
      payload:     (row.payload as BatchUpdate[] | null) ?? [],
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

  async findPendingWithTx(): Promise<Batch[]> {
    const rows = await this.db
      .select()
      .from(batches)
      .where(and(eq(batches.status, 'PENDING'), isNotNull(batches.txHash)));
    return rows.map((row) => this.rowToDomain(row));
  }
}
