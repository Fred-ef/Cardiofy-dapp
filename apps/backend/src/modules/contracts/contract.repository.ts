import { inject, injectable } from 'tsyringe';
import { and, eq, isNotNull } from 'drizzle-orm';
import { DatabaseConnection } from '#infrastructure/database/database.connection.js';
import { contracts, type ContractRow } from '#models/schema.js';
import { Contract } from './contract.domain.js';
import type { IContractRepository, NotarizeContractInput } from './interfaces/i-contract.repository.js';

@injectable()
export class DrizzleContractRepository implements IContractRepository {
  constructor(@inject(DatabaseConnection) private readonly dbConn: DatabaseConnection) {}

  private get db() { return this.dbConn.getDb(); }

  private rowToDomain(row: ContractRow): Contract {
    return Contract.reconstitute({
      contractId:  row.contractId,
      contentHash: row.contentHash,
      status:      row.status,
      txHash:      row.txHash ?? null,
      blockNumber: row.blockNumber ?? null,
      notarizedAt: row.notarizedAt,
      confirmedAt: row.confirmedAt ?? null,
    });
  }

  async findById(contractId: string): Promise<Contract | null> {
    const rows = await this.db.select().from(contracts).where(eq(contracts.contractId, contractId)).limit(1);
    const row = rows[0];
    return row ? this.rowToDomain(row) : null;
  }

  async create(input: NotarizeContractInput): Promise<Contract> {
    const [row] = await this.db
      .insert(contracts)
      .values({ contractId: input.contractId, contentHash: input.contentHash, status: 'PENDING' })
      .returning();
    if (!row) throw new Error('[ContractRepo] insert returned no rows');
    return this.rowToDomain(row);
  }

  async markSubmitted(contractId: string, txHash: string): Promise<void> {
    await this.db.update(contracts).set({ txHash }).where(eq(contracts.contractId, contractId));
  }

  async markConfirmed(contractId: string, blockNumber: number, confirmedAt: Date): Promise<void> {
    await this.db
      .update(contracts)
      .set({ status: 'CONFIRMED', blockNumber, confirmedAt })
      .where(eq(contracts.contractId, contractId));
  }

  async markFailed(contractId: string): Promise<void> {
    await this.db.update(contracts).set({ status: 'FAILED' }).where(eq(contracts.contractId, contractId));
  }

  async findPendingWithTx(): Promise<Contract[]> {
    const rows = await this.db
      .select()
      .from(contracts)
      .where(and(eq(contracts.status, 'PENDING'), isNotNull(contracts.txHash)));
    return rows.map((row) => this.rowToDomain(row));
  }
}
