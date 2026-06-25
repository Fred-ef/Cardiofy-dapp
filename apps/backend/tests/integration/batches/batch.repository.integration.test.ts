import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startTestDb, type TestDb } from '#tests/support/test-db.js';
import { DrizzleBatchRepository } from '#modules/batches/batch.repository.js';

const PERIOD = 1_750_636_800;
const TX     = '0x' + 'dd'.repeat(32);

describe('DrizzleBatchRepository (integration)', () => {
  let db: TestDb;
  let repo: DrizzleBatchRepository;

  beforeAll(async () => {
    db = await startTestDb();
    repo = new DrizzleBatchRepository(db.connection);
  });

  afterAll(async () => {
    await db.stop();
  });

  beforeEach(async () => {
    await db.truncateAll();
  });

  it('createPending stores payload as JSON and starts in PENDING', async () => {
    const payload = [
      { assetId: 'asset-A', viewsInPeriod: 3 },
      { assetId: 'asset-B', viewsInPeriod: 2 },
    ];
    const created = await repo.createPending({
      periodId:   PERIOD,
      assetCount: payload.length,
      viewsTotal: 5,
      payload,
    });
    expect(created.status).toBe('PENDING');
    expect(created.payload).toEqual(payload);
  });

  it('rejects duplicate periodId as primary key', async () => {
    await repo.createPending({ periodId: PERIOD, assetCount: 0, viewsTotal: 0, payload: [] });
    await expect(
      repo.createPending({ periodId: PERIOD, assetCount: 0, viewsTotal: 0, payload: [] }),
    ).rejects.toThrow();
  });

  it('markSubmitted then markConfirmed advances status correctly', async () => {
    await repo.createPending({ periodId: PERIOD, assetCount: 1, viewsTotal: 1, payload: [] });
    await repo.markSubmitted(PERIOD, TX);
    expect((await repo.findByPeriodId(PERIOD))?.txHash).toBe(TX);

    const when = new Date('2026-06-22T03:00:00Z');
    await repo.markConfirmed(PERIOD, 99, when);
    const fetched = await repo.findByPeriodId(PERIOD);
    expect(fetched?.status).toBe('CONFIRMED');
    expect(fetched?.blockNumber).toBe(99);
    expect(fetched?.confirmedAt?.toISOString()).toBe(when.toISOString());
  });

  it('findPendingWithTx returns only PENDING + txHash batches', async () => {
    await repo.createPending({ periodId: PERIOD, assetCount: 0, viewsTotal: 0, payload: [] });
    // No tx → not returned.
    await repo.createPending({ periodId: PERIOD + 86_400, assetCount: 0, viewsTotal: 0, payload: [] });
    await repo.markSubmitted(PERIOD + 86_400, TX);
    // Submitted then confirmed → not returned.
    await repo.createPending({ periodId: PERIOD + 172_800, assetCount: 0, viewsTotal: 0, payload: [] });
    await repo.markSubmitted(PERIOD + 172_800, TX);
    await repo.markConfirmed(PERIOD + 172_800, 1, new Date());

    const pending = await repo.findPendingWithTx();
    expect(pending.map((b) => b.periodId)).toEqual([PERIOD + 86_400]);
  });
});
