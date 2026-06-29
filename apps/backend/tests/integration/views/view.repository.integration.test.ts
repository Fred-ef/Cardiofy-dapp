import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startTestDb, type TestDb } from '#tests/support/test-db.js';
import { DrizzleViewRepository } from '#modules/views/view.repository.js';

const PERIOD_A = 1_750_636_800;
const PERIOD_B = PERIOD_A + 86_400;

function baseView(input: Partial<{ id: string; idempotencyKey: string; assetId: string; periodId: number }> = {}) {
  return {
    id:             input.id ?? `view-${Math.random().toString(36).slice(2, 10)}`,
    idempotencyKey: input.idempotencyKey ?? `idem-${Math.random().toString(36).slice(2, 10)}`,
    assetId:        input.assetId ?? 'asset-1',
    occurredAt:     new Date('2026-06-22T12:00:00Z'),
    periodId:       input.periodId ?? PERIOD_A,
  };
}

describe('DrizzleViewRepository (integration)', () => {
  let db: TestDb;
  let repo: DrizzleViewRepository;

  beforeAll(async () => {
    db = await startTestDb();
    repo = new DrizzleViewRepository(db.connection);
  });

  afterAll(async () => {
    await db.stop();
  });

  beforeEach(async () => {
    await db.truncateAll();
  });

  it('create + findByIdempotencyKey round-trip', async () => {
    const created = await repo.create(baseView({ id: 'v1', idempotencyKey: 'idem-1' }));
    const fetched = await repo.findByIdempotencyKey('idem-1');
    expect(fetched?.id).toBe('v1');
    expect(fetched?.assetId).toBe(created.assetId);
    expect(fetched?.anchored).toBe(false);
  });

  it('enforces UNIQUE on idempotency_key', async () => {
    await repo.create(baseView({ id: 'v1', idempotencyKey: 'idem-1' }));
    await expect(repo.create(baseView({ id: 'v2', idempotencyKey: 'idem-1' })))
      .rejects.toThrow();
  });

  it('aggregatesForPeriod groups by assetId and counts views', async () => {
    await repo.create(baseView({ id: 'v1', idempotencyKey: 'i1', assetId: 'asset-A', periodId: PERIOD_A }));
    await repo.create(baseView({ id: 'v2', idempotencyKey: 'i2', assetId: 'asset-A', periodId: PERIOD_A }));
    await repo.create(baseView({ id: 'v3', idempotencyKey: 'i3', assetId: 'asset-B', periodId: PERIOD_A }));
    // Diverso periodo, non deve apparire.
    await repo.create(baseView({ id: 'v4', idempotencyKey: 'i4', assetId: 'asset-A', periodId: PERIOD_B }));

    const aggregates = await repo.aggregatesForPeriod(PERIOD_A);
    const map = new Map(aggregates.map((a) => [a.assetId, a.viewsInPeriod]));
    expect(map.get('asset-A')).toBe(2);
    expect(map.get('asset-B')).toBe(1);
    expect(aggregates).toHaveLength(2);
  });

  it('markPeriodAnchored flips anchored=true for all views of the period', async () => {
    await repo.create(baseView({ id: 'v1', idempotencyKey: 'i1', periodId: PERIOD_A }));
    await repo.create(baseView({ id: 'v2', idempotencyKey: 'i2', periodId: PERIOD_A }));
    await repo.create(baseView({ id: 'v3', idempotencyKey: 'i3', periodId: PERIOD_B }));

    const touched = await repo.markPeriodAnchored(PERIOD_A);
    expect(touched).toBe(2);

    const stillUnanchored = await repo.findByIdempotencyKey('i3');
    expect(stillUnanchored?.anchored).toBe(false);
  });

  it('aggregatesForPeriod returns empty array when no views in the period', async () => {
    expect(await repo.aggregatesForPeriod(PERIOD_A)).toEqual([]);
  });
});
