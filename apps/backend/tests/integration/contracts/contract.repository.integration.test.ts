import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startTestDb, type TestDb } from '#tests/support/test-db.js';
import { DrizzleContractRepository } from '#modules/contracts/contract.repository.js';

const HASH_A = '0x' + 'aa'.repeat(32);
const HASH_B = '0x' + 'bb'.repeat(32);
const TX     = '0x' + 'cc'.repeat(32);

describe('DrizzleContractRepository (integration)', () => {
  let db: TestDb;
  let repo: DrizzleContractRepository;

  beforeAll(async () => {
    db = await startTestDb();
    repo = new DrizzleContractRepository(db.connection);
  });

  afterAll(async () => {
    await db.stop();
  });

  beforeEach(async () => {
    await db.truncateAll();
  });

  it('persists a contract and finds it by id', async () => {
    const created = await repo.create({ contractId: 'contract-1', contentHash: HASH_A });
    expect(created.status).toBe('PENDING');
    const fetched = await repo.findById('contract-1');
    expect(fetched?.contentHash).toBe(HASH_A);
  });

  it('rejects duplicate contractId', async () => {
    await repo.create({ contractId: 'contract-1', contentHash: HASH_A });
    await expect(repo.create({ contractId: 'contract-1', contentHash: HASH_B }))
      .rejects.toThrow();
  });

  it('markSubmitted then markConfirmed advances status with blockNumber + confirmedAt', async () => {
    await repo.create({ contractId: 'contract-1', contentHash: HASH_A });
    await repo.markSubmitted('contract-1', TX);
    expect((await repo.findById('contract-1'))?.txHash).toBe(TX);

    const when = new Date('2026-06-22T02:00:00Z');
    await repo.markConfirmed('contract-1', 42, when);
    const fetched = await repo.findById('contract-1');
    expect(fetched?.status).toBe('CONFIRMED');
    expect(fetched?.blockNumber).toBe(42);
    expect(fetched?.confirmedAt?.toISOString()).toBe(when.toISOString());
  });

  it('findPendingWithTx returns only PENDING + txHash rows', async () => {
    await repo.create({ contractId: 'no-tx', contentHash: HASH_A });
    await repo.create({ contractId: 'with-tx', contentHash: HASH_A });
    await repo.markSubmitted('with-tx', TX);
    await repo.create({ contractId: 'confirmed', contentHash: HASH_A });
    await repo.markSubmitted('confirmed', TX);
    await repo.markConfirmed('confirmed', 1, new Date());

    const pending = await repo.findPendingWithTx();
    expect(pending.map((c) => c.contractId)).toEqual(['with-tx']);
  });
});
