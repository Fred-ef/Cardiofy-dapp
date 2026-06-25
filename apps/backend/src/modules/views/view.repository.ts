import { inject, injectable } from 'tsyringe';
import { eq, sql } from 'drizzle-orm';
import { DatabaseConnection } from '#infrastructure/database/database.connection.js';
import { views, type ViewRow } from '#models/schema.js';
import { View } from './view.domain.js';
import type { IViewRepository, RegisterViewInput, AssetAggregate } from './interfaces/i-view.repository.js';

@injectable()
export class DrizzleViewRepository implements IViewRepository {
  constructor(@inject(DatabaseConnection) private readonly dbConn: DatabaseConnection) {}

  private get db() { return this.dbConn.getDb(); }

  private rowToDomain(row: ViewRow): View {
    return View.reconstitute({
      id:             row.id,
      idempotencyKey: row.idempotencyKey,
      assetId:        row.assetId,
      readerHash:     row.readerHash,
      sessionId:      row.sessionId ?? null,
      occurredAt:     row.occurredAt,
      receivedAt:     row.receivedAt,
      periodId:       row.periodId,
      evidence:       (row.evidence as Record<string, unknown> | null) ?? null,
      anchored:       row.anchored === 1,
      batchPeriodId:  row.batchPeriodId ?? null,
    });
  }

  async findByIdempotencyKey(key: string): Promise<View | null> {
    const rows = await this.db.select().from(views).where(eq(views.idempotencyKey, key)).limit(1);
    const row = rows[0];
    return row ? this.rowToDomain(row) : null;
  }

  async create(input: RegisterViewInput): Promise<View> {
    const [row] = await this.db
      .insert(views)
      .values({
        id:             input.id,
        idempotencyKey: input.idempotencyKey,
        assetId:        input.assetId,
        readerHash:     input.readerHash,
        sessionId:      input.sessionId,
        occurredAt:     input.occurredAt,
        periodId:       input.periodId,
        evidence:       input.evidence,
      })
      .returning();
    if (!row) throw new Error('[ViewRepo] insert returned no rows');
    return this.rowToDomain(row);
  }

  async aggregatesForPeriod(periodId: number): Promise<AssetAggregate[]> {
    const rows = await this.db
      .select({
        assetId: views.assetId,
        viewsInPeriod: sql<number>`count(*)::int`.as('views_in_period'),
      })
      .from(views)
      .where(eq(views.periodId, periodId))
      .groupBy(views.assetId);

    return rows.map((r) => ({ assetId: r.assetId, viewsInPeriod: Number(r.viewsInPeriod) }));
  }

  async markPeriodAnchored(periodId: number): Promise<number> {
    const result = await this.db
      .update(views)
      .set({ anchored: 1, batchPeriodId: periodId })
      .where(eq(views.periodId, periodId))
      .returning({ id: views.id });
    return result.length;
  }
}
