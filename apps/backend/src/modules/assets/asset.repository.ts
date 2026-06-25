import { inject, injectable } from 'tsyringe';
import { and, eq, isNotNull, sql } from 'drizzle-orm';
import { DatabaseConnection } from '#infrastructure/database/database.connection.js';
import { assets, type AssetRow } from '#models/schema.js';
import { Asset } from './asset.domain.js';
import type { IAssetRepository, NotarizeAssetInput } from './interfaces/i-asset.repository.js';

@injectable()
export class DrizzleAssetRepository implements IAssetRepository {
  constructor(@inject(DatabaseConnection) private readonly dbConn: DatabaseConnection) {}

  private get db() { return this.dbConn.getDb(); }

  private rowToDomain(row: AssetRow): Asset {
    return Asset.reconstitute({
      assetId:          row.assetId,
      contentHash:      row.contentHash,
      status:           row.status,
      txHash:           row.txHash ?? null,
      blockNumber:      row.blockNumber ?? null,
      notarizedAt:      row.notarizedAt,
      confirmedAt:      row.confirmedAt ?? null,
      totalViewsMirror: row.totalViewsMirror,
    });
  }

  async findById(assetId: string): Promise<Asset | null> {
    const rows = await this.db.select().from(assets).where(eq(assets.assetId, assetId)).limit(1);
    const row = rows[0];
    return row ? this.rowToDomain(row) : null;
  }

  async create(input: NotarizeAssetInput): Promise<Asset> {
    const [row] = await this.db
      .insert(assets)
      .values({
        assetId:     input.assetId,
        contentHash: input.contentHash,
        status:      'PENDING',
      })
      .returning();
    if (!row) throw new Error('[AssetRepo] insert returned no rows');
    return this.rowToDomain(row);
  }

  async markSubmitted(assetId: string, txHash: string): Promise<void> {
    await this.db.update(assets).set({ txHash }).where(eq(assets.assetId, assetId));
  }

  async markConfirmed(assetId: string, blockNumber: number, confirmedAt: Date): Promise<void> {
    await this.db
      .update(assets)
      .set({ status: 'CONFIRMED', blockNumber, confirmedAt })
      .where(eq(assets.assetId, assetId));
  }

  async markFailed(assetId: string): Promise<void> {
    await this.db.update(assets).set({ status: 'FAILED' }).where(eq(assets.assetId, assetId));
  }

  async incrementMirrorViews(assetId: string, delta: number): Promise<void> {
    await this.db
      .update(assets)
      .set({ totalViewsMirror: sql`${assets.totalViewsMirror} + ${delta}` })
      .where(eq(assets.assetId, assetId));
  }

  async findPendingWithTx(): Promise<Asset[]> {
    const rows = await this.db
      .select()
      .from(assets)
      .where(and(eq(assets.status, 'PENDING'), isNotNull(assets.txHash)));
    return rows.map((row) => this.rowToDomain(row));
  }
}
