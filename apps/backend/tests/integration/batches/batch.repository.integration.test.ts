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

  it('markMirrorApplied sets the flag', async () => {
    await repo.createPending({ periodId: PERIOD, assetCount: 0, viewsTotal: 0, payload: [] });
    await repo.markMirrorApplied(PERIOD);
    expect((await repo.findByPeriodId(PERIOD))?.mirrorApplied).toBe(true);
  });

  it('findPendingBatches returns only PENDING batches', async () => {
    await repo.createPending({ periodId: PERIOD, assetCount: 0, viewsTotal: 0, payload: [] });
    await repo.createPending({ periodId: PERIOD + 86_400, assetCount: 0, viewsTotal: 0, payload: [] });
    await repo.markConfirmed(PERIOD + 86_400, 1, new Date());

    const pending = await repo.findPendingBatches();
    expect(pending.map((b) => b.periodId)).toEqual([PERIOD]);
  });

  it('ensureChunks is idempotent and findChunks returns chunks ordered by index', async () => {
    const slices = [
      [{ assetId: 'a', viewsInPeriod: 1 }, { assetId: 'b', viewsInPeriod: 2 }],
      [{ assetId: 'c', viewsInPeriod: 3 }],
    ];
    await repo.ensureChunks(PERIOD, slices);
    await repo.ensureChunks(PERIOD, slices); // idempotente: nessun duplicato

    const chunks = await repo.findChunks(PERIOD);
    expect(chunks.map((c) => c.chunkIndex)).toEqual([0, 1]);
    expect(chunks[0]?.payload).toEqual(slices[0]);
    expect(chunks.every((c) => c.status === 'PENDING')).toBe(true);
  });

  it('chunk lifecycle: submit → findPendingChunksWithTx → confirm', async () => {
    await repo.ensureChunks(PERIOD, [[{ assetId: 'a', viewsInPeriod: 1 }]]);
    await repo.markChunkSubmitted(PERIOD, 0, TX);

    const pendingWithTx = await repo.findPendingChunksWithTx();
    expect(pendingWithTx.map((c) => [c.periodId, c.chunkIndex])).toEqual([[PERIOD, 0]]);

    const when = new Date('2026-06-22T04:00:00Z');
    await repo.markChunkConfirmed(PERIOD, 0, 77, when);
    expect(await repo.findPendingChunksWithTx()).toEqual([]); // ora CONFIRMED, non più pending
    const [chunk] = await repo.findChunks(PERIOD);
    expect(chunk?.status).toBe('CONFIRMED');
    expect(chunk?.blockNumber).toBe(77);
  });
});
